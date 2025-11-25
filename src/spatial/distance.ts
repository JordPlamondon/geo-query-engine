import type { GeoPoint } from '../core/types.js';

/**
 * Earth's mean radius in kilometers
 */
const EARTH_RADIUS_KM = 6371;

/**
 * Converts degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculates the Haversine distance between two geographic points
 *
 * The Haversine formula determines the great-circle distance between
 * two points on a sphere given their longitudes and latitudes.
 *
 * @param point1 - First geographic point
 * @param point2 - Second geographic point
 * @returns Distance in kilometers
 */
export function haversineDistance(point1: GeoPoint, point2: GeoPoint): number {
  const lat1 = toRadians(point1.lat);
  const lat2 = toRadians(point2.lat);
  const deltaLat = toRadians(point2.lat - point1.lat);
  const deltaLng = toRadians(point2.lng - point1.lng);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Calculates the squared Euclidean distance for quick comparisons
 * (avoids expensive sqrt operation when only comparing distances)
 *
 * Note: This is not geographically accurate but can be used for
 * quick filtering when points are close together.
 *
 * @param point1 - First geographic point
 * @param point2 - Second geographic point
 * @returns Squared distance (unitless, for comparison only)
 */
export function squaredDistance(point1: GeoPoint, point2: GeoPoint): number {
  const dLat = point2.lat - point1.lat;
  const dLng = point2.lng - point1.lng;
  return dLat * dLat + dLng * dLng;
}
