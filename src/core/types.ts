/**
 * Core type definitions for geo-query-engine
 */

/**
 * Base interface for any geographic point with latitude and longitude
 */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * A geographic point with distance from a reference point
 */
export type WithDistance<T> = T & { distance: number };

/**
 * Filter operators for attribute filtering
 */
export type FilterOperator =
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
  | 'notIn';

/**
 * Sort order direction
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Sort criteria for ordering results
 */
export interface SortCriteria<T> {
  field: keyof T | 'distance';
  order: SortOrder;
}

/**
 * Filter condition for attribute filtering
 */
export interface FilterCondition<T> {
  field: keyof T;
  operator: FilterOperator;
  value: unknown;
}

/**
 * Geographic filter for radius-based searches
 */
export interface RadiusFilter {
  center: GeoPoint;
  radiusKm: number;
}

/**
 * Bounding box for geographic queries
 */
export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Query state that accumulates through the fluent API chain
 */
export interface QueryState<T extends GeoPoint> {
  radiusFilter?: RadiusFilter;
  boundsFilter?: BoundingBox;
  attributeFilters: FilterCondition<T>[];
  sortCriteria: SortCriteria<T & { distance?: number }>[];
  scoreFunction?: (item: T, distance?: number) => number;
  limitCount?: number;
  offsetCount: number;
}

/**
 * Result metadata returned with query results
 */
export interface QueryMetadata {
  totalMatches: number;
  returnedCount: number;
  queryTimeMs: number;
}

/**
 * Query result containing items and metadata
 */
export interface QueryResult<T> {
  items: T[];
  metadata: QueryMetadata;
}

/**
 * Internal item representation for rbush spatial index
 */
export interface IndexedItem<T extends GeoPoint> {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  item: T;
}

/**
 * Configuration options for GeoSearch
 */
export interface GeoSearchOptions {
  /**
   * Maximum number of items to load per bulk insert batch
   * @default 10000
   */
  batchSize?: number;
}
