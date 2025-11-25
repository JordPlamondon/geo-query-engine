import KDBush from 'kdbush';
import * as geokdbush from 'geokdbush';
import type { GeoPoint, BoundingBox } from '../core/types.js';

/**
 * Static spatial index using KDBush for read-only datasets
 *
 * 5-8x faster indexing and 2x less memory than RBush,
 * but does not support add/remove after initialization.
 */
export class StaticSpatialIndex<T extends GeoPoint> {
  private index: KDBush;
  private items: T[];
  private _size: number;

  constructor() {
    this.items = [];
    this._size = 0;
    // Index will be created on load()
    this.index = new KDBush(0);
  }

  /**
   * Bulk loads items into the index
   * This is the only way to add items to a static index
   */
  load(items: T[]): void {
    this.items = items;
    this._size = items.length;

    // Create KDBush index with longitude (x) and latitude (y)
    this.index = new KDBush(items.length);
    for (const item of items) {
      this.index.add(item.lng, item.lat);
    }
    this.index.finish();
  }

  /**
   * Static index does not support add - throws error
   */
  add(_item: T): void {
    throw new Error('StaticSpatialIndex does not support add(). Use load() for bulk loading or switch to dynamic mode.');
  }

  /**
   * Static index does not support addMany - throws error
   */
  addMany(_items: T[]): void {
    throw new Error('StaticSpatialIndex does not support addMany(). Use load() for bulk loading or switch to dynamic mode.');
  }

  /**
   * Static index does not support remove - throws error
   */
  remove(_item: T): boolean {
    throw new Error('StaticSpatialIndex does not support remove(). Switch to dynamic mode if you need to remove items.');
  }

  /**
   * Static index does not support clear - throws error
   */
  clear(): void {
    throw new Error('StaticSpatialIndex does not support clear(). Create a new instance instead.');
  }

  /**
   * Returns the total number of items in the index
   */
  get size(): number {
    return this._size;
  }

  /**
   * Returns all items in the index
   */
  all(): T[] {
    return this.items;
  }

  /**
   * Searches for items within a bounding box
   */
  searchBounds(bounds: BoundingBox): T[] {
    const indices = this.index.range(
      bounds.minLng,
      bounds.minLat,
      bounds.maxLng,
      bounds.maxLat
    );
    return indices.map(i => this.items[i]!);
  }

  /**
   * Searches for items within a radius of a center point
   * Uses geokdbush for efficient geographic queries with Haversine distance
   */
  searchRadius(center: GeoPoint, radiusKm: number): Array<{ item: T; distance: number }> {
    // geokdbush.around returns items sorted by distance
    const results = geokdbush.around(
      this.index,
      center.lng,
      center.lat,
      undefined, // maxResults - undefined means all
      radiusKm   // maxDistance in km
    );

    // Map indices back to items with distances
    return results.map(idx => {
      const item = this.items[idx]!;
      // Calculate exact distance for the result
      const distance = geokdbush.distance(center.lng, center.lat, item.lng, item.lat);
      return { item, distance };
    });
  }
}
