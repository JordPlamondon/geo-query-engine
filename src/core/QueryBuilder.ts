import type {
  GeoPoint,
  QueryState,
  FilterCondition,
  SortCriteria,
  FilterOperator,
  BoundingBox,
  WithDistance,
} from './types.js';
import { SpatialIndex } from '../spatial/index.js';
import { evaluateFilter } from '../filters/index.js';

/**
 * Immutable query builder for geographic searches
 *
 * Each method returns a new QueryBuilder instance, preserving immutability
 * and enabling type-safe method chaining.
 *
 * @template T - The type of geographic point being queried
 * @template HasDistance - Whether distance has been computed (via .near())
 */
export class QueryBuilder<T extends GeoPoint, HasDistance extends boolean = false> {
  private readonly spatialIndex: SpatialIndex<T>;
  private readonly state: QueryState<T>;

  constructor(spatialIndex: SpatialIndex<T>, state?: Partial<QueryState<T>>) {
    this.spatialIndex = spatialIndex;
    this.state = {
      attributeFilters: [],
      sortCriteria: [],
      offsetCount: 0,
      ...state,
    };
  }

  /**
   * Creates a new QueryBuilder with updated state (immutable)
   */
  private clone<NewHasDistance extends boolean = HasDistance>(
    updates: Partial<QueryState<T>>
  ): QueryBuilder<T, NewHasDistance> {
    return new QueryBuilder<T, NewHasDistance>(this.spatialIndex, {
      ...this.state,
      ...updates,
    });
  }

  /**
   * Filters points within a radius of a center point
   *
   * @param center - Center point for the search
   * @param radiusKm - Maximum distance in kilometers
   * @returns New QueryBuilder with distance field available
   */
  near(center: GeoPoint, radiusKm: number): QueryBuilder<T, true> {
    return this.clone<true>({
      radiusFilter: { center, radiusKm },
    });
  }

  /**
   * Filters points within a bounding box
   *
   * @param bounds - Bounding box to filter within
   * @returns New QueryBuilder
   */
  withinBounds(bounds: BoundingBox): QueryBuilder<T, HasDistance> {
    return this.clone({
      boundsFilter: bounds,
    });
  }

  /**
   * Adds an attribute filter condition
   *
   * @param field - Field name to filter on
   * @param operator - Filter operator
   * @param value - Value to compare against
   * @returns New QueryBuilder with added filter
   */
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

  /**
   * Sets sorting criteria for results
   *
   * @param criteria - Array of sort criteria
   * @returns New QueryBuilder with sorting applied
   */
  sortBy(
    criteria: HasDistance extends true
      ? SortCriteria<T & { distance: number }>[]
      : SortCriteria<T>[]
  ): QueryBuilder<T, HasDistance> {
    return this.clone({
      sortCriteria: criteria as SortCriteria<T & { distance?: number }>[],
    });
  }

  /**
   * Sets a custom scoring function for results
   *
   * @param fn - Scoring function that takes item and optional distance
   * @returns New QueryBuilder with scoring function
   */
  score(fn: (item: T, distance?: number) => number): QueryBuilder<T, HasDistance> {
    return this.clone({
      scoreFunction: fn,
    });
  }

  /**
   * Limits the number of results returned
   *
   * @param count - Maximum number of results
   * @returns New QueryBuilder with limit applied
   */
  limit(count: number): QueryBuilder<T, HasDistance> {
    return this.clone({
      limitCount: count,
    });
  }

  /**
   * Skips a number of results (for pagination)
   *
   * @param count - Number of results to skip
   * @returns New QueryBuilder with offset applied
   */
  offset(count: number): QueryBuilder<T, HasDistance> {
    return this.clone({
      offsetCount: count,
    });
  }

  /**
   * Executes the query and returns results
   *
   * @returns Array of items matching the query criteria
   */
  execute(): HasDistance extends true ? WithDistance<T>[] : T[] {
    // Step 1: Get initial candidates based on geographic filters
    let candidates: Array<{ item: T; distance?: number }>;

    if (this.state.radiusFilter) {
      // Use radius search which returns items with distances
      candidates = this.spatialIndex.searchRadius(
        this.state.radiusFilter.center,
        this.state.radiusFilter.radiusKm
      );
    } else if (this.state.boundsFilter) {
      // Use bounds search
      const items = this.spatialIndex.searchBounds(this.state.boundsFilter);
      candidates = items.map((item) => ({ item }));
    } else {
      // No geographic filter - return all items
      const items = this.spatialIndex.all();
      candidates = items.map((item) => ({ item }));
    }

    // Step 2: Apply attribute filters
    let filtered = candidates;
    for (const filter of this.state.attributeFilters) {
      filtered = filtered.filter((candidate) =>
        evaluateFilter(candidate.item, filter.field, filter.operator, filter.value)
      );
    }

    // Step 3: Compute scores if scoring function is provided
    if (this.state.scoreFunction) {
      filtered = filtered.map((candidate) => ({
        ...candidate,
        score: this.state.scoreFunction!(candidate.item, candidate.distance),
      }));
    }

    // Step 4: Apply sorting
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

    // Step 5: Apply offset and limit
    let results = filtered;
    if (this.state.offsetCount > 0) {
      results = results.slice(this.state.offsetCount);
    }
    if (this.state.limitCount !== undefined) {
      results = results.slice(0, this.state.limitCount);
    }

    // Step 6: Format results
    const formattedResults = results.map((candidate) => {
      if (this.state.radiusFilter && candidate.distance !== undefined) {
        return { ...candidate.item, distance: candidate.distance };
      }
      return candidate.item;
    });

    return formattedResults as HasDistance extends true ? WithDistance<T>[] : T[];
  }

  /**
   * Executes the query and returns results with metadata
   *
   * @returns Query result with items and metadata
   */
  executeWithMetadata(): {
    items: HasDistance extends true ? WithDistance<T>[] : T[];
    metadata: {
      totalMatches: number;
      returnedCount: number;
      queryTimeMs: number;
    };
  } {
    const startTime = performance.now();

    // Get candidates for counting total matches
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

    // Apply attribute filters to get total matches
    let totalFiltered = totalCandidates;
    for (const filter of this.state.attributeFilters) {
      totalFiltered = totalFiltered.filter((candidate) =>
        evaluateFilter(candidate.item, filter.field, filter.operator, filter.value)
      );
    }

    const totalMatches = totalFiltered.length;

    // Execute the query with limits
    const items = this.execute();

    const queryTimeMs = performance.now() - startTime;

    return {
      items,
      metadata: {
        totalMatches,
        returnedCount: items.length,
        queryTimeMs,
      },
    };
  }
}
