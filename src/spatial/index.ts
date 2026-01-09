import RBush from 'rbush';
import type { GeoPoint, IndexedItem, BoundingBox } from '../core/types.js';
import { radiusToBoundingBox } from './bounds.js';
import { haversineDistance } from './distance.js';

export interface ISpatialIndex<T extends GeoPoint> {
  load(items: T[]): void;
  add(item: T): void;
  addMany(items: T[]): void;
  remove(item: T): boolean;
  clear(): void;
  readonly size: number;
  all(): T[];
  searchBounds(bounds: BoundingBox): T[];
  searchRadius(center: GeoPoint, radiusKm: number): Array<{ item: T; distance: number }>;
}

// Dynamic index using RBush - supports add/remove but slower than KDBush.
// Use this when your dataset changes after initialization.
export class SpatialIndex<T extends GeoPoint> implements ISpatialIndex<T> {
  private tree: RBush<IndexedItem<T>>;
  // WeakMap allows items to be garbage collected when removed from user's array,
  // even if they forget to call remove()
  private itemToIndexed: WeakMap<T, IndexedItem<T>>;

  constructor() {
    this.tree = new RBush<IndexedItem<T>>();
    this.itemToIndexed = new WeakMap();
  }

  private createIndexedItem(item: T): IndexedItem<T> {
    // RBush expects minX/maxX/minY/maxY - for points these are identical
    return {
      minX: item.lng,
      minY: item.lat,
      maxX: item.lng,
      maxY: item.lat,
      item,
    };
  }

  load(items: T[]): void {
    const indexedItems = items.map((item) => {
      const indexed = this.createIndexedItem(item);
      this.itemToIndexed.set(item, indexed);
      return indexed;
    });
    this.tree.load(indexedItems);
  }

  add(item: T): void {
    const indexed = this.createIndexedItem(item);
    this.itemToIndexed.set(item, indexed);
    this.tree.insert(indexed);
  }

  addMany(items: T[]): void {
    for (const item of items) {
      this.add(item);
    }
  }

  remove(item: T): boolean {
    const indexed = this.itemToIndexed.get(item);
    if (!indexed) {
      return false;
    }
    this.tree.remove(indexed);
    this.itemToIndexed.delete(item);
    return true;
  }

  clear(): void {
    this.tree.clear();
    this.itemToIndexed = new WeakMap();
  }

  get size(): number {
    return this.tree.all().length;
  }

  all(): T[] {
    return this.tree.all().map((indexed) => indexed.item);
  }

  searchBounds(bounds: BoundingBox): T[] {
    const results = this.tree.search({
      minX: bounds.minLng,
      minY: bounds.minLat,
      maxX: bounds.maxLng,
      maxY: bounds.maxLat,
    });
    return results.map((indexed) => indexed.item);
  }

  searchRadius(center: GeoPoint, radiusKm: number): Array<{ item: T; distance: number }> {
    // Two-phase search: fast bbox filter, then accurate haversine check.
    // Bbox is rough but uses the spatial index; haversine is accurate but O(n).
    const bbox = radiusToBoundingBox(center, radiusKm);
    const candidates = this.searchBounds(bbox);

    const results: Array<{ item: T; distance: number }> = [];

    for (const item of candidates) {
      const distance = haversineDistance(center, item);
      if (distance <= radiusKm) {
        results.push({ item, distance });
      }
    }

    return results;
  }
}

export { haversineDistance } from './distance.js';
export { radiusToBoundingBox, isPointInBounds, kmToLatDegrees, kmToLngDegrees } from './bounds.js';
export { StaticSpatialIndex } from './StaticSpatialIndex.js';
