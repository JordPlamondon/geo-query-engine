/**
 * geo-query-engine
 *
 * A high-performance client-side geospatial search and filtering engine
 * for location-based applications.
 *
 * @packageDocumentation
 */

// Main entry point
export { GeoSearch } from './core/GeoSearch.js';
export { QueryBuilder } from './core/QueryBuilder.js';

// Types
export type {
  GeoPoint,
  WithDistance,
  FilterOperator,
  SortOrder,
  SortCriteria,
  FilterCondition,
  RadiusFilter,
  BoundingBox,
  QueryState,
  QueryMetadata,
  QueryMetadataWithCache,
  QueryResult,
  GeoSearchOptions,
} from './core/types.js';

// Spatial utilities (for advanced usage)
export { haversineDistance } from './spatial/distance.js';
export {
  radiusToBoundingBox,
  isPointInBounds,
  kmToLatDegrees,
  kmToLngDegrees,
} from './spatial/bounds.js';

// Filter utilities (for advanced usage)
export { filterOperators, evaluateFilter } from './filters/index.js';
