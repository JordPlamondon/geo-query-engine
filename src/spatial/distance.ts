import type { GeoPoint } from '../core/types.js';

// Mean Earth radius in km. Could use 6378 (equatorial) or 6357 (polar),
// but 6371 is the standard for general-purpose calculations.
const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Haversine formula for great-circle distance. Accurate to ~0.5% which is
// good enough for most use cases. For sub-meter precision, use Vincenty.
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

// Squared Euclidean distance - useful for comparing relative distances
// without the sqrt overhead. Not geographically accurate.
export function squaredDistance(point1: GeoPoint, point2: GeoPoint): number {
  const dLat = point2.lat - point1.lat;
  const dLng = point2.lng - point1.lng;
  return dLat * dLat + dLng * dLng;
}
