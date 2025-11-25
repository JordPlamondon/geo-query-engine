/**
 * Simple LRU (Least Recently Used) cache implementation
 *
 * Used to cache query results for instant repeated queries.
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private readonly maxSize: number;

  constructor(maxSize: number = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get a value from the cache
   * Moves the item to the end (most recently used)
   */
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  /**
   * Set a value in the cache
   * Evicts the least recently used item if at capacity
   */
  set(key: K, value: V): void {
    // Delete existing to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, value);
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the current size of the cache
   */
  get size(): number {
    return this.cache.size;
  }
}

/**
 * Recursively sorts object keys for consistent serialization
 */
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Generates a cache key from query state
 * Used to identify unique queries for caching
 */
export function generateCacheKey(state: Record<string, unknown>): string {
  return JSON.stringify(sortObjectKeys(state));
}
