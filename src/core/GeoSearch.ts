import type { GeoPoint, GeoSearchOptions } from './types.js';
import { SpatialIndex, StaticSpatialIndex, type ISpatialIndex } from '../spatial/index.js';
import { QueryBuilder } from './QueryBuilder.js';
import { LRUCache, generateCacheKey } from '../utils/LRUCache.js';

export class GeoSearch<T extends GeoPoint> {
  private spatialIndex: ISpatialIndex<T>;
  private cache: LRUCache<string, unknown> | null = null;
  private readonly isStatic: boolean;

  constructor(items: T[] = [], options: GeoSearchOptions = {}) {
    this.isStatic = options.static ?? false;

    // Two index strategies: RBush (dynamic) allows add/remove but slower,
    // KDBush (static) is 5-8x faster but immutable after creation
    if (this.isStatic) {
      this.spatialIndex = new StaticSpatialIndex<T>();
    } else {
      this.spatialIndex = new SpatialIndex<T>();
    }

    if (options.cache) {
      this.cache = new LRUCache<string, unknown>(options.cacheSize ?? 100);
    }

    if (items.length > 0) {
      this.spatialIndex.load(items);
    }
  }

  static from<T extends GeoPoint>(items: T[], options?: GeoSearchOptions): GeoSearch<T> {
    return new GeoSearch<T>(items, options);
  }

  add(item: T): this {
    this.spatialIndex.add(item);
    this.invalidateCache();
    return this;
  }

  addMany(items: T[]): this {
    this.spatialIndex.addMany(items);
    this.invalidateCache();
    return this;
  }

  remove(item: T): boolean {
    const result = this.spatialIndex.remove(item);
    if (result) {
      this.invalidateCache();
    }
    return result;
  }

  clear(): this {
    this.spatialIndex.clear();
    this.invalidateCache();
    return this;
  }

  // Any mutation invalidates the entire cache - partial invalidation would be
  // complex and error-prone for minimal gain in typical usage patterns
  private invalidateCache(): void {
    if (this.cache) {
      this.cache.clear();
    }
  }

  get size(): number {
    return this.spatialIndex.size;
  }

  get staticMode(): boolean {
    return this.isStatic;
  }

  get cacheEnabled(): boolean {
    return this.cache !== null;
  }

  get cacheSize(): number {
    return this.cache?.size ?? 0;
  }

  clearCache(): void {
    this.cache?.clear();
  }

  near(center: GeoPoint, radiusKm: number): QueryBuilder<T, true> {
    return new QueryBuilder<T, false>(this.spatialIndex, undefined, this.cache).near(center, radiusKm);
  }

  withinBounds(bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  }): QueryBuilder<T, false> {
    return new QueryBuilder<T, false>(this.spatialIndex, undefined, this.cache).withinBounds(bounds);
  }

  where<K extends keyof T>(
    field: K,
    operator:
      | 'equals'
      | 'notEquals'
      | 'greaterThan'
      | 'greaterThanOrEqual'
      | 'lessThan'
      | 'lessThanOrEqual'
      | 'includes'
      | 'includesAll'
      | 'includesAny'
      | 'startsWith'
      | 'endsWith'
      | 'contains'
      | 'between'
      | 'in'
      | 'notIn',
    value: unknown
  ): QueryBuilder<T, false> {
    return new QueryBuilder<T, false>(this.spatialIndex, undefined, this.cache).where(field, operator, value);
  }

  sortBy(criteria: Array<{ field: keyof T; order: 'asc' | 'desc' }>): QueryBuilder<T, false> {
    return new QueryBuilder<T, false>(this.spatialIndex, undefined, this.cache).sortBy(criteria);
  }

  all(): T[] {
    return this.spatialIndex.all();
  }

  query(): QueryBuilder<T, false> {
    return new QueryBuilder<T, false>(this.spatialIndex, undefined, this.cache);
  }
}

export { generateCacheKey };
