export interface GeoPoint {
  lat: number;
  lng: number;
}

export type WithDistance<T> = T & { distance: number };

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

export type SortOrder = 'asc' | 'desc';

export interface SortCriteria<T> {
  field: keyof T | 'distance';
  order: SortOrder;
}

export interface FilterCondition<T> {
  field: keyof T;
  operator: FilterOperator;
  value: unknown;
}

export interface RadiusFilter {
  center: GeoPoint;
  radiusKm: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface QueryState<T extends GeoPoint> {
  radiusFilter?: RadiusFilter;
  boundsFilter?: BoundingBox;
  attributeFilters: FilterCondition<T>[];
  sortCriteria: SortCriteria<T & { distance?: number }>[];
  scoreFunction?: (item: T, distance?: number) => number;
  limitCount?: number;
  offsetCount: number;
}

export interface QueryMetadata {
  totalMatches: number;
  returnedCount: number;
  queryTimeMs: number;
}

export interface QueryResult<T> {
  items: T[];
  metadata: QueryMetadata;
}

export interface IndexedItem<T extends GeoPoint> {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  item: T;
}

export interface GeoSearchOptions {
  /** Use static mode (KDBush) for read-only datasets. Faster but no add/remove. */
  static?: boolean;
  /** Enable LRU query caching. */
  cache?: boolean;
  /** Max cached queries (default: 100). */
  cacheSize?: number;
}

export interface QueryMetadataWithCache extends QueryMetadata {
  cached: boolean;
}
