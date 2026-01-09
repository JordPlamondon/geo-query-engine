export { GeoSearch } from './core/GeoSearch.js';
export { QueryBuilder } from './core/QueryBuilder.js';

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

export { haversineDistance } from './spatial/distance.js';
export {
  radiusToBoundingBox,
  isPointInBounds,
  kmToLatDegrees,
  kmToLngDegrees,
} from './spatial/bounds.js';

export { filterOperators, evaluateFilter } from './filters/index.js';
