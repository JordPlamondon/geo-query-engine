import type {
  GeoPoint,
  QueryState,
  FilterCondition,
  SortCriteria,
  FilterOperator,
  BoundingBox,
  WithDistance,
  QueryMetadataWithCache,
} from './types.js';
import type { ISpatialIndex } from '../spatial/index.js';
import { evaluateFilter } from '../filters/index.js';
import type { LRUCache } from '../utils/LRUCache.js';
import { generateCacheKey } from '../utils/LRUCache.js';

// Immutable query builder - each method returns a new instance.
// This enables safe query reuse: baseQuery.where(...) doesn't mutate baseQuery
export class QueryBuilder<T extends GeoPoint, HasDistance extends boolean = false> {
  private readonly spatialIndex: ISpatialIndex<T>;
  private readonly state: QueryState<T>;
  private readonly cache: LRUCache<string, unknown> | null;

  constructor(
    spatialIndex: ISpatialIndex<T>,
    state?: Partial<QueryState<T>>,
    cache?: LRUCache<string, unknown> | null
  ) {
    this.spatialIndex = spatialIndex;
    this.cache = cache ?? null;
    this.state = {
      attributeFilters: [],
      sortCriteria: [],
      offsetCount: 0,
      ...state,
    };
  }

  private clone<NewHasDistance extends boolean = HasDistance>(
    updates: Partial<QueryState<T>>
  ): QueryBuilder<T, NewHasDistance> {
    return new QueryBuilder<T, NewHasDistance>(
      this.spatialIndex,
      {
        ...this.state,
        ...updates,
      },
      this.cache
    );
  }

  private getCacheKey(): string {
    // Only cache serializable state - functions can't be reliably hashed
    const cacheableState = {
      radiusFilter: this.state.radiusFilter,
      boundsFilter: this.state.boundsFilter,
      attributeFilters: this.state.attributeFilters,
      sortCriteria: this.state.sortCriteria,
      limitCount: this.state.limitCount,
      offsetCount: this.state.offsetCount,
    };
    return generateCacheKey(cacheableState);
  }

  near(center: GeoPoint, radiusKm: number): QueryBuilder<T, true> {
    return this.clone<true>({
      radiusFilter: { center, radiusKm },
    });
  }

  withinBounds(bounds: BoundingBox): QueryBuilder<T, HasDistance> {
    return this.clone({
      boundsFilter: bounds,
    });
  }

  where<K extends keyof T>(
    field: K,
    operator: FilterOperator,
    value: unknown
  ): QueryBuilder<T, HasDistance> {
    const newFilter: FilterCondition<T> = {
      field,
      operator,
      value,
    };

    return this.clone({
      attributeFilters: [...this.state.attributeFilters, newFilter],
    });
  }

  sortBy(
    criteria: HasDistance extends true
      ? SortCriteria<T & { distance: number }>[]
      : SortCriteria<T>[]
  ): QueryBuilder<T, HasDistance> {
    return this.clone({
      sortCriteria: criteria as SortCriteria<T & { distance?: number }>[],
    });
  }

  score(fn: (item: T, distance?: number) => number): QueryBuilder<T, HasDistance> {
    return this.clone({
      scoreFunction: fn,
    });
  }

  limit(count: number): QueryBuilder<T, HasDistance> {
    return this.clone({
      limitCount: count,
    });
  }

  offset(count: number): QueryBuilder<T, HasDistance> {
    return this.clone({
      offsetCount: count,
    });
  }

  private executeInternal(): HasDistance extends true ? WithDistance<T>[] : T[] {
    let candidates: Array<{ item: T; distance?: number }>;

    // Spatial filter first - uses R-tree/KD-tree to narrow candidates quickly
    // before expensive attribute filtering
    if (this.state.radiusFilter) {
      candidates = this.spatialIndex.searchRadius(
        this.state.radiusFilter.center,
        this.state.radiusFilter.radiusKm
      );
    } else if (this.state.boundsFilter) {
      const items = this.spatialIndex.searchBounds(this.state.boundsFilter);
      candidates = items.map((item) => ({ item }));
    } else {
      const items = this.spatialIndex.all();
      candidates = items.map((item) => ({ item }));
    }

    // Attribute filters applied sequentially - each filter reduces the set
    // for the next, so order can affect performance on large datasets
    let filtered = candidates;
    for (const filter of this.state.attributeFilters) {
      filtered = filtered.filter((candidate) =>
        evaluateFilter(candidate.item, filter.field, filter.operator, filter.value)
      );
    }

    if (this.state.scoreFunction) {
      filtered = filtered.map((candidate) => ({
        ...candidate,
        score: this.state.scoreFunction!(candidate.item, candidate.distance),
      }));
    }

    if (this.state.sortCriteria.length > 0) {
      filtered.sort((a, b) => {
        for (const criterion of this.state.sortCriteria) {
          const field = criterion.field;
          let aVal: unknown;
          let bVal: unknown;

          if (field === 'distance') {
            aVal = a.distance ?? Infinity;
            bVal = b.distance ?? Infinity;
          } else if (field === 'score' && 'score' in a && 'score' in b) {
            aVal = (a as { score: number }).score;
            bVal = (b as { score: number }).score;
          } else {
            aVal = a.item[field as keyof T];
            bVal = b.item[field as keyof T];
          }

          if (aVal === bVal) continue;

          const comparison = aVal! < bVal! ? -1 : 1;
          return criterion.order === 'asc' ? comparison : -comparison;
        }
        return 0;
      });
    }

    // Offset/limit applied after sorting - pagination requires stable order
    let results = filtered;
    if (this.state.offsetCount > 0) {
      results = results.slice(this.state.offsetCount);
    }
    if (this.state.limitCount !== undefined) {
      results = results.slice(0, this.state.limitCount);
    }

    const formattedResults = results.map((candidate) => {
      if (this.state.radiusFilter && candidate.distance !== undefined) {
        return { ...candidate.item, distance: candidate.distance };
      }
      return candidate.item;
    });

    return formattedResults as HasDistance extends true ? WithDistance<T>[] : T[];
  }

  execute(): HasDistance extends true ? WithDistance<T>[] : T[] {
    // Skip cache for queries with score functions - they're not serializable
    // and likely unique per invocation anyway
    const canCache = this.cache && !this.state.scoreFunction;

    if (canCache) {
      const cacheKey = this.getCacheKey();
      const cached = this.cache!.get(cacheKey);
      if (cached !== undefined) {
        return cached as HasDistance extends true ? WithDistance<T>[] : T[];
      }

      const results = this.executeInternal();
      this.cache!.set(cacheKey, results);
      return results;
    }

    return this.executeInternal();
  }

  executeWithMetadata(): {
    items: HasDistance extends true ? WithDistance<T>[] : T[];
    metadata: QueryMetadataWithCache;
  } {
    const startTime = performance.now();
    const canCache = this.cache && !this.state.scoreFunction;
    let cached = false;

    if (canCache) {
      const cacheKey = this.getCacheKey();
      const cachedResult = this.cache!.get(cacheKey);
      if (cachedResult !== undefined) {
        cached = true;
        const queryTimeMs = performance.now() - startTime;
        const items = cachedResult as HasDistance extends true ? WithDistance<T>[] : T[];
        return {
          items,
          metadata: {
            totalMatches: items.length,
            returnedCount: items.length,
            queryTimeMs,
            cached: true,
          },
        };
      }
    }

    // Count total matches before limit/offset for pagination info
    let totalCandidates: Array<{ item: T; distance?: number }>;

    if (this.state.radiusFilter) {
      totalCandidates = this.spatialIndex.searchRadius(
        this.state.radiusFilter.center,
        this.state.radiusFilter.radiusKm
      );
    } else if (this.state.boundsFilter) {
      const items = this.spatialIndex.searchBounds(this.state.boundsFilter);
      totalCandidates = items.map((item) => ({ item }));
    } else {
      const items = this.spatialIndex.all();
      totalCandidates = items.map((item) => ({ item }));
    }

    let totalFiltered = totalCandidates;
    for (const filter of this.state.attributeFilters) {
      totalFiltered = totalFiltered.filter((candidate) =>
        evaluateFilter(candidate.item, filter.field, filter.operator, filter.value)
      );
    }

    const totalMatches = totalFiltered.length;
    const items = this.executeInternal();

    if (canCache) {
      const cacheKey = this.getCacheKey();
      this.cache!.set(cacheKey, items);
    }

    const queryTimeMs = performance.now() - startTime;

    return {
      items,
      metadata: {
        totalMatches,
        returnedCount: items.length,
        queryTimeMs,
        cached,
      },
    };
  }
}
