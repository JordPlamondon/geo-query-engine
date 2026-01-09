import type { GeoPoint, BoundingBox } from '../core/types.js';

// 111.32 km per degree of latitude is constant everywhere on Earth
// (Earth's circumference / 360 degrees ≈ 40075 / 360)
export function kmToLatDegrees(km: number): number {
  return km / 111.32;
}

// Longitude degrees per km varies by latitude - at the equator it's ~111km,
// at the poles it approaches 0
export function kmToLngDegrees(km: number, latitude: number): number {
  const latRad = (latitude * Math.PI) / 180;
  const kmPerDegree = 111.32 * Math.cos(latRad);
  // Near poles, cos approaches 0 and this would blow up
  if (kmPerDegree < 0.001) {
    return 360;
  }
  return km / kmPerDegree;
}

// Creates a bounding box that fully contains a circle of the given radius.
// The box will be slightly larger than necessary at non-equator latitudes.
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

export function isPointInBounds(point: GeoPoint, bounds: BoundingBox): boolean {
  return (
    point.lat >= bounds.minLat &&
    point.lat <= bounds.maxLat &&
    point.lng >= bounds.minLng &&
    point.lng <= bounds.maxLng
  );
}

export function normalizeLongitude(lng: number): number {
  while (lng > 180) lng -= 360;
  while (lng < -180) lng += 360;
  return lng;
}

export function clampLatitude(lat: number): number {
  return Math.max(-90, Math.min(90, lat));
}
