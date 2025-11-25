import RBush from 'rbush';
import type { GeoPoint, IndexedItem, BoundingBox } from '../core/types.js';
import { radiusToBoundingBox } from './bounds.js';
import { haversineDistance } from './distance.js';

/**
 * Common interface for spatial indexes
 */
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

/**
 * Dynamic spatial index using RBush for datasets that change after initialization
 */
export class SpatialIndex<T extends GeoPoint> implements ISpatialIndex<T> {
  private tree: RBush<IndexedItem<T>>;
  private itemToIndexed: WeakMap<T, IndexedItem<T>>;

  constructor() {
    this.tree = new RBush<IndexedItem<T>>();
    this.itemToIndexed = new WeakMap();
  }

  /**
   * Creates an indexed item from a geographic point
   */
  private createIndexedItem(item: T): IndexedItem<T> {
    return {
      minX: item.lng,
      minY: item.lat,
      maxX: item.lng,
      maxY: item.lat,
      item,
    };
  }

  /**
   * Bulk loads items into the index (most efficient for initial load)
   *
   * @param items - Array of geographic points to index
   */
  load(items: T[]): void {
    const indexedItems = items.map((item) => {
      const indexed = this.createIndexedItem(item);
      this.itemToIndexed.set(item, indexed);
      return indexed;
    });
    this.tree.load(indexedItems);
  }

  /**
   * Adds a single item to the index
   *
   * @param item - Geographic point to add
   */
  add(item: T): void {
    const indexed = this.createIndexedItem(item);
    this.itemToIndexed.set(item, indexed);
    this.tree.insert(indexed);
  }

  /**
   * Adds multiple items to the index
   *
   * @param items - Array of geographic points to add
   */
  addMany(items: T[]): void {
    for (const item of items) {
      this.add(item);
    }
  }

  /**
   * Removes an item from the index
   *
   * @param item - Geographic point to remove
   * @returns True if item was found and removed
   */
  remove(item: T): boolean {
    const indexed = this.itemToIndexed.get(item);
    if (!indexed) {
      return false;
    }
    this.tree.remove(indexed);
    this.itemToIndexed.delete(item);
    return true;
  }

  /**
   * Clears all items from the index
   */
  clear(): void {
    this.tree.clear();
    this.itemToIndexed = new WeakMap();
  }

  /**
   * Returns the total number of items in the index
   */
  get size(): number {
    return this.tree.all().length;
  }

  /**
   * Returns all items in the index
   */
  all(): T[] {
    return this.tree.all().map((indexed) => indexed.item);
  }

  /**
   * Searches for items within a bounding box
   *
   * @param bounds - Bounding box to search within
   * @returns Array of items within the bounds
   */
  searchBounds(bounds: BoundingBox): T[] {
    const results = this.tree.search({
      minX: bounds.minLng,
      minY: bounds.minLat,
      maxX: bounds.maxLng,
      maxY: bounds.maxLat,
    });
    return results.map((indexed) => indexed.item);
  }

  /**
   * Searches for items within a radius of a center point
   * Uses two-phase approach: bbox filter then exact distance check
   *
   * @param center - Center point of the search
   * @param radiusKm - Radius in kilometers
   * @returns Array of items with their distances, sorted by distance
   */
  searchRadius(center: GeoPoint, radiusKm: number): Array<{ item: T; distance: number }> {
    // Phase 1: Quick bounding box filter
    const bbox = radiusToBoundingBox(center, radiusKm);
    const candidates = this.searchBounds(bbox);

    // Phase 2: Exact distance calculation and filtering
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
