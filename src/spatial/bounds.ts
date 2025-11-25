import type { GeoPoint, BoundingBox } from '../core/types.js';

/**
 * Converts kilometers to degrees of latitude
 * 1 degree of latitude is approximately 111.32 km at any point on Earth
 *
 * @param km - Distance in kilometers
 * @returns Approximate degrees of latitude
 */
export function kmToLatDegrees(km: number): number {
  return km / 111.32;
}

/**
 * Converts kilometers to degrees of longitude at a given latitude
 * 1 degree of longitude varies based on latitude
 *
 * @param km - Distance in kilometers
 * @param latitude - Latitude in degrees where the conversion is needed
 * @returns Approximate degrees of longitude
 */
export function kmToLngDegrees(km: number, latitude: number): number {
  const latRad = (latitude * Math.PI) / 180;
  const kmPerDegree = 111.32 * Math.cos(latRad);
  // Prevent division by zero near poles
  if (kmPerDegree < 0.001) {
    return 360; // At poles, any longitude change is minimal
  }
  return km / kmPerDegree;
}

/**
 * Creates a bounding box around a center point with a given radius
 * This is an approximation that ensures the actual radius circle
 * is fully contained within the bounding box
 *
 * @param center - Center point of the search area
 * @param radiusKm - Radius in kilometers
 * @returns Bounding box containing the circular search area
 */
export function radiusToBoundingBox(center: GeoPoint, radiusKm: number): BoundingBox {
  const latDelta = kmToLatDegrees(radiusKm);
  const lngDelta = kmToLngDegrees(radiusKm, center.lat);

  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}

/**
 * Checks if a point is within a bounding box
 *
 * @param point - Point to check
 * @param bounds - Bounding box
 * @returns True if point is within bounds
 */
export function isPointInBounds(point: GeoPoint, bounds: BoundingBox): boolean {
  return (
    point.lat >= bounds.minLat &&
    point.lat <= bounds.maxLat &&
    point.lng >= bounds.minLng &&
    point.lng <= bounds.maxLng
  );
}

/**
 * Normalizes longitude to be within -180 to 180 range
 *
 * @param lng - Longitude value
 * @returns Normalized longitude
 */
export function normalizeLongitude(lng: number): number {
  while (lng > 180) lng -= 360;
  while (lng < -180) lng += 360;
  return lng;
}

/**
 * Clamps latitude to valid range (-90 to 90)
 *
 * @param lat - Latitude value
 * @returns Clamped latitude
 */
export function clampLatitude(lat: number): number {
  return Math.max(-90, Math.min(90, lat));
}
