import type { GeoPoint, GeoSearchOptions } from './types.js';
import { SpatialIndex, StaticSpatialIndex, type ISpatialIndex } from '../spatial/index.js';
import { QueryBuilder } from './QueryBuilder.js';
import { LRUCache, generateCacheKey } from '../utils/LRUCache.js';

/**
 * Main entry point for geospatial search and filtering
 *
 * GeoSearch provides a fluent API for querying geographic data points
 * with support for radius searches, bounding box filters, attribute
 * filtering, sorting, and custom scoring.
 *
 * @template T - The type of geographic point being stored/queried
 *
 * @example
 * ```typescript
 * interface Gym extends GeoPoint {
 *   id: string;
 *   name: string;
 *   rating: number;
 *   equipment: string[];
 * }
 *
 * // Dynamic mode (default) - supports add/remove
 * const search = GeoSearch.from<Gym>(gyms);
 *
 * // Static mode - 5-8x faster, but read-only
 * const search = GeoSearch.from<Gym>(gyms, { static: true });
 *
 * // With caching - instant repeated queries
 * const search = GeoSearch.from<Gym>(gyms, { cache: true });
 *
 * // Both optimizations
 * const search = GeoSearch.from<Gym>(gyms, { static: true, cache: true });
 *
 * const results = search
 *   .near({ lat: 51.0447, lng: -114.0719 }, 5)
 *   .where('rating', 'greaterThan', 4.0)
 *   .where('equipment', 'includesAll', ['squat rack', 'bench'])
 *   .sortBy([{ field: 'distance', order: 'asc' }])
 *   .limit(10)
 *   .execute();
 * ```
 */
export class GeoSearch<T extends GeoPoint> {
  private spatialIndex: ISpatialIndex<T>;
  private cache: LRUCache<string, unknown> | null = null;
  private readonly isStatic: boolean;

  /**
   * Creates a new GeoSearch instance
   *
   * @param items - Initial array of geographic points
   * @param options - Configuration options
   */
  constructor(items: T[] = [], options: GeoSearchOptions = {}) {
    this.isStatic = options.static ?? false;

    // Choose index based on mode
    if (this.isStatic) {
      this.spatialIndex = new StaticSpatialIndex<T>();
    } else {
      this.spatialIndex = new SpatialIndex<T>();
    }

    // Initialize cache if enabled
    if (options.cache) {
      this.cache = new LRUCache<string, unknown>(options.cacheSize ?? 100);
    }

    if (items.length > 0) {
      this.spatialIndex.load(items);
    }
  }

  /**
   * Creates a GeoSearch instance from an array of items
   *
   * @param items - Array of geographic points
   * @param options - Configuration options
   * @returns New GeoSearch instance
   */
  static from<T extends GeoPoint>(items: T[], options?: GeoSearchOptions): GeoSearch<T> {
    return new GeoSearch<T>(items, options);
  }

  /**
   * Adds a single item to the index
   * Note: Throws error in static mode
   *
   * @param item - Geographic point to add
   * @returns this for method chaining
   */
  add(item: T): this {
    this.spatialIndex.add(item);
    this.invalidateCache();
    return this;
  }

  /**
   * Adds multiple items to the index
   * Note: Throws error in static mode
   *
   * @param items - Array of geographic points to add
   * @returns this for method chaining
   */
  addMany(items: T[]): this {
    this.spatialIndex.addMany(items);
    this.invalidateCache();
    return this;
  }

  /**
   * Removes an item from the index
   * Note: Throws error in static mode
   *
   * @param item - Geographic point to remove
   * @returns true if item was found and removed
   */
  remove(item: T): boolean {
    const result = this.spatialIndex.remove(item);
    if (result) {
      this.invalidateCache();
    }
    return result;
  }

  /**
   * Clears all items from the index
   * Note: Throws error in static mode
   *
   * @returns this for method chaining
   */
  clear(): this {
    this.spatialIndex.clear();
    this.invalidateCache();
    return this;
  }

  /**
   * Invalidates the query cache (called on data changes)
   */
  private invalidateCache(): void {
    if (this.cache) {
      this.cache.clear();
    }
  }

  /**
   * Returns the number of items in the index
   */
  get size(): number {
    return this.spatialIndex.size;
  }

  /**
   * Returns whether this instance is in static mode
   */
  get staticMode(): boolean {
    return this.isStatic;
  }

  /**
   * Returns whether caching is enabled
   */
  get cacheEnabled(): boolean {
    return this.cache !== null;
  }

  /**
   * Returns the current cache size (number of cached queries)
   */
  get cacheSize(): number {
    return this.cache?.size ?? 0;
  }

  /**
   * Clears the query cache without affecting the data
   */
  clearCache(): void {
    this.cache?.clear();
  }

  /**
   * Starts a new query chain with a radius filter
   *
   * @param center - Center point for the search
   * @param radiusKm - Maximum distance in kilometers
   * @returns QueryBuilder with distance available
   */
  near(center: GeoPoint, radiusKm: number): QueryBuilder<T, true> {
    return new QueryBuilder<T, false>(this.spatialIndex, undefined, this.cache).near(center, radiusKm);
  }

  /**
   * Starts a new query chain with a bounding box filter
   *
   * @param bounds - Bounding box to filter within
   * @returns QueryBuilder
   */
  withinBounds(bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  }): QueryBuilder<T, false> {
    return new QueryBuilder<T, false>(this.spatialIndex, undefined, this.cache).withinBounds(bounds);
  }

  /**
   * Starts a new query chain with an attribute filter
   *
   * @param field - Field name to filter on
   * @param operator - Filter operator
   * @param value - Value to compare against
   * @returns QueryBuilder
   */
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

  /**
   * Starts a new query chain with sorting criteria
   *
   * @param criteria - Array of sort criteria
   * @returns QueryBuilder
   */
  sortBy(criteria: Array<{ field: keyof T; order: 'asc' | 'desc' }>): QueryBuilder<T, false> {
    return new QueryBuilder<T, false>(this.spatialIndex, undefined, this.cache).sortBy(criteria);
  }

  /**
   * Returns all items without any filtering
   *
   * @returns Array of all items
   */
  all(): T[] {
    return this.spatialIndex.all();
  }

  /**
   * Creates a query builder for more complex queries
   *
   * @returns QueryBuilder instance
   */
  query(): QueryBuilder<T, false> {
    return new QueryBuilder<T, false>(this.spatialIndex, undefined, this.cache);
  }
}

export { generateCacheKey };
