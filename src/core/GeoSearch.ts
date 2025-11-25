import type { GeoPoint, GeoSearchOptions } from './types.js';
import { SpatialIndex } from '../spatial/index.js';
import { QueryBuilder } from './QueryBuilder.js';

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
 * const search = GeoSearch.from<Gym>(gyms);
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
  private spatialIndex: SpatialIndex<T>;

  /**
   * Creates a new GeoSearch instance
   *
   * @param items - Initial array of geographic points
   * @param _options - Configuration options (reserved for future use)
   */
  constructor(items: T[] = [], _options: GeoSearchOptions = {}) {
    this.spatialIndex = new SpatialIndex<T>();

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
   *
   * @param item - Geographic point to add
   * @returns this for method chaining
   */
  add(item: T): this {
    this.spatialIndex.add(item);
    return this;
  }

  /**
   * Adds multiple items to the index
   *
   * @param items - Array of geographic points to add
   * @returns this for method chaining
   */
  addMany(items: T[]): this {
    this.spatialIndex.addMany(items);
    return this;
  }

  /**
   * Removes an item from the index
   *
   * @param item - Geographic point to remove
   * @returns true if item was found and removed
   */
  remove(item: T): boolean {
    return this.spatialIndex.remove(item);
  }

  /**
   * Clears all items from the index
   *
   * @returns this for method chaining
   */
  clear(): this {
    this.spatialIndex.clear();
    return this;
  }

  /**
   * Returns the number of items in the index
   */
  get size(): number {
    return this.spatialIndex.size;
  }

  /**
   * Starts a new query chain with a radius filter
   *
   * @param center - Center point for the search
   * @param radiusKm - Maximum distance in kilometers
   * @returns QueryBuilder with distance available
   */
  near(center: GeoPoint, radiusKm: number): QueryBuilder<T, true> {
    return new QueryBuilder<T, false>(this.spatialIndex).near(center, radiusKm);
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
    return new QueryBuilder<T, false>(this.spatialIndex).withinBounds(bounds);
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
    return new QueryBuilder<T, false>(this.spatialIndex).where(field, operator, value);
  }

  /**
   * Starts a new query chain with sorting criteria
   *
   * @param criteria - Array of sort criteria
   * @returns QueryBuilder
   */
  sortBy(criteria: Array<{ field: keyof T; order: 'asc' | 'desc' }>): QueryBuilder<T, false> {
    return new QueryBuilder<T, false>(this.spatialIndex).sortBy(criteria);
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
    return new QueryBuilder<T, false>(this.spatialIndex);
  }
}
