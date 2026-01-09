import KDBush from 'kdbush';
import * as geokdbush from 'geokdbush';
import type { GeoPoint, BoundingBox } from '../core/types.js';

// Static index using KDBush - 5-8x faster than RBush but immutable.
// KDBush uses a flat typed array internally, which is more cache-friendly
// and uses ~2x less memory than RBush's tree structure.
export class StaticSpatialIndex<T extends GeoPoint> {
  private index: KDBush;
  private items: T[];
  private _size: number;

  constructor() {
    this.items = [];
    this._size = 0;
    this.index = new KDBush(0);
  }

  load(items: T[]): void {
    this.items = items;
    this._size = items.length;

    // KDBush requires knowing the size upfront and uses add() + finish() pattern
    this.index = new KDBush(items.length);
    for (const item of items) {
      this.index.add(item.lng, item.lat);
    }
    this.index.finish();
  }

  add(_item: T): void {
    throw new Error('StaticSpatialIndex does not support add(). Use load() or switch to dynamic mode.');
  }

  addMany(_items: T[]): void {
    throw new Error('StaticSpatialIndex does not support addMany(). Use load() or switch to dynamic mode.');
  }

  remove(_item: T): boolean {
    throw new Error('StaticSpatialIndex does not support remove(). Switch to dynamic mode.');
  }

  clear(): void {
    throw new Error('StaticSpatialIndex does not support clear(). Create a new instance instead.');
  }

  get size(): number {
    return this._size;
  }

  all(): T[] {
    return this.items;
  }

  searchBounds(bounds: BoundingBox): T[] {
    const indices = this.index.range(
      bounds.minLng,
      bounds.minLat,
      bounds.maxLng,
      bounds.maxLat
    );
    return indices.map(i => this.items[i]!);
  }

  searchRadius(center: GeoPoint, radiusKm: number): Array<{ item: T; distance: number }> {
    // geokdbush.around handles haversine distance internally - no need for
    // our two-phase bbox+haversine approach. Returns indices sorted by distance.
    const results = geokdbush.around(
      this.index,
      center.lng,
      center.lat,
      undefined,
      radiusKm
    );

    return results.map(idx => {
      const item = this.items[idx]!;
      const distance = geokdbush.distance(center.lng, center.lat, item.lng, item.lat);
      return { item, distance };
    });
  }
}
