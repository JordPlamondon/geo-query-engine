import { describe, it, expect, beforeEach } from 'vitest';
import { GeoSearch, haversineDistance } from '../src/index.js';
import type { GeoPoint } from '../src/index.js';

interface TestLocation extends GeoPoint {
  id: string;
  name: string;
  rating: number;
  tags: string[];
  price: number;
}

// Calgary city center
const CALGARY_CENTER = { lat: 51.0447, lng: -114.0719 };

// Test data: Gyms around Calgary
const testGyms: TestLocation[] = [
  {
    id: '1',
    name: 'Downtown Fitness',
    lat: 51.0453,
    lng: -114.0632,
    rating: 4.5,
    tags: ['squat rack', 'bench', 'cardio'],
    price: 50,
  },
  {
    id: '2',
    name: 'West End Gym',
    lat: 51.0398,
    lng: -114.1265,
    rating: 4.2,
    tags: ['squat rack', 'pool'],
    price: 60,
  },
  {
    id: '3',
    name: 'Kensington Athletic',
    lat: 51.0528,
    lng: -114.0892,
    rating: 4.8,
    tags: ['squat rack', 'bench', 'sauna'],
    price: 75,
  },
  {
    id: '4',
    name: 'Beltline CrossFit',
    lat: 51.0377,
    lng: -114.0695,
    rating: 4.0,
    tags: ['crossfit', 'cardio'],
    price: 80,
  },
  {
    id: '5',
    name: 'Far North Gym',
    lat: 51.1234,
    lng: -114.0719,
    rating: 3.5,
    tags: ['bench', 'cardio'],
    price: 30,
  },
];

describe('GeoSearch', () => {
  let search: GeoSearch<TestLocation>;

  beforeEach(() => {
    search = GeoSearch.from(testGyms);
  });

  describe('initialization', () => {
    it('should create an empty instance', () => {
      const emptySearch = new GeoSearch<TestLocation>();
      expect(emptySearch.size).toBe(0);
    });

    it('should load initial data', () => {
      expect(search.size).toBe(5);
    });

    it('should support static from() factory', () => {
      const fromSearch = GeoSearch.from(testGyms);
      expect(fromSearch.size).toBe(5);
    });
  });

  describe('dynamic updates', () => {
    it('should add a single item', () => {
      const newGym: TestLocation = {
        id: '6',
        name: 'New Gym',
        lat: 51.05,
        lng: -114.07,
        rating: 4.0,
        tags: ['new'],
        price: 40,
      };
      search.add(newGym);
      expect(search.size).toBe(6);
    });

    it('should add multiple items', () => {
      const newGyms: TestLocation[] = [
        { id: '6', name: 'Gym 6', lat: 51.05, lng: -114.07, rating: 4.0, tags: [], price: 40 },
        { id: '7', name: 'Gym 7', lat: 51.06, lng: -114.08, rating: 4.1, tags: [], price: 45 },
      ];
      search.addMany(newGyms);
      expect(search.size).toBe(7);
    });

    it('should remove an item', () => {
      const removed = search.remove(testGyms[0]!);
      expect(removed).toBe(true);
      expect(search.size).toBe(4);
    });

    it('should clear all items', () => {
      search.clear();
      expect(search.size).toBe(0);
    });
  });

  describe('radius search', () => {
    it('should find items within radius', () => {
      const results = search.near(CALGARY_CENTER, 5).execute();
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThan(testGyms.length);
    });

    it('should include distance in results', () => {
      const results = search.near(CALGARY_CENTER, 5).execute();
      expect(results[0]).toHaveProperty('distance');
      expect(typeof results[0]?.distance).toBe('number');
    });

    it('should exclude items outside radius', () => {
      // Far North Gym is ~8.7km away
      const results = search.near(CALGARY_CENTER, 5).execute();
      const farGym = results.find((r) => r.id === '5');
      expect(farGym).toBeUndefined();
    });

    it('should include items inside radius', () => {
      const results = search.near(CALGARY_CENTER, 10).execute();
      const farGym = results.find((r) => r.id === '5');
      expect(farGym).toBeDefined();
    });
  });

  describe('bounding box search', () => {
    it('should find items within bounds', () => {
      const results = search
        .withinBounds({
          minLat: 51.03,
          maxLat: 51.06,
          minLng: -114.13,
          maxLng: -114.06,
        })
        .execute();
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('attribute filtering', () => {
    it('should filter by equals', () => {
      const results = search.where('id', 'equals', '1').execute();
      expect(results.length).toBe(1);
      expect(results[0]?.name).toBe('Downtown Fitness');
    });

    it('should filter by greaterThan', () => {
      const results = search.where('rating', 'greaterThan', 4.0).execute();
      expect(results.length).toBe(3);
      results.forEach((r) => expect(r.rating).toBeGreaterThan(4.0));
    });

    it('should filter by lessThan', () => {
      const results = search.where('price', 'lessThan', 60).execute();
      expect(results.every((r) => r.price < 60)).toBe(true);
    });

    it('should filter by includes (array contains value)', () => {
      const results = search.where('tags', 'includes', 'squat rack').execute();
      expect(results.every((r) => r.tags.includes('squat rack'))).toBe(true);
    });

    it('should filter by includesAll (array contains all values)', () => {
      const results = search.where('tags', 'includesAll', ['squat rack', 'bench']).execute();
      expect(results.length).toBe(2);
      results.forEach((r) => {
        expect(r.tags).toContain('squat rack');
        expect(r.tags).toContain('bench');
      });
    });

    it('should filter by includesAny (array contains any value)', () => {
      const results = search.where('tags', 'includesAny', ['pool', 'sauna']).execute();
      expect(results.length).toBe(2);
    });

    it('should chain multiple filters', () => {
      const results = search
        .where('rating', 'greaterThan', 4.0)
        .where('tags', 'includes', 'squat rack')
        .execute();
      // Downtown Fitness (4.5), West End Gym (4.2), Kensington Athletic (4.8) all have rating > 4.0 and squat rack
      expect(results.length).toBe(3);
    });
  });

  describe('sorting', () => {
    it('should sort by single field ascending', () => {
      const results = search.sortBy([{ field: 'rating', order: 'asc' }]).execute();
      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.rating).toBeGreaterThanOrEqual(results[i - 1]!.rating);
      }
    });

    it('should sort by single field descending', () => {
      const results = search.sortBy([{ field: 'rating', order: 'desc' }]).execute();
      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.rating).toBeLessThanOrEqual(results[i - 1]!.rating);
      }
    });

    it('should sort by distance when using near()', () => {
      const results = search
        .near(CALGARY_CENTER, 10)
        .sortBy([{ field: 'distance', order: 'asc' }])
        .execute();

      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.distance).toBeGreaterThanOrEqual(results[i - 1]!.distance);
      }
    });

    it('should support multi-criteria sorting', () => {
      const results = search
        .near(CALGARY_CENTER, 10)
        .sortBy([
          { field: 'distance', order: 'asc' },
          { field: 'rating', order: 'desc' },
        ])
        .execute();

      expect(results.length).toBe(5);
    });
  });

  describe('limit and offset', () => {
    it('should limit results', () => {
      const results = search.sortBy([{ field: 'rating', order: 'desc' }]).limit(2).execute();
      expect(results.length).toBe(2);
    });

    it('should offset results', () => {
      const allResults = search.sortBy([{ field: 'rating', order: 'desc' }]).execute();
      const offsetResults = search.sortBy([{ field: 'rating', order: 'desc' }]).offset(2).execute();

      expect(offsetResults[0]?.id).toBe(allResults[2]?.id);
    });

    it('should combine limit and offset (pagination)', () => {
      const page1 = search.sortBy([{ field: 'rating', order: 'desc' }]).limit(2).execute();
      const page2 = search
        .sortBy([{ field: 'rating', order: 'desc' }])
        .offset(2)
        .limit(2)
        .execute();

      expect(page1.length).toBe(2);
      expect(page2.length).toBe(2);
      expect(page1[0]?.id).not.toBe(page2[0]?.id);
    });
  });

  describe('complex queries', () => {
    it('should handle combined geo + attribute + sort + limit', () => {
      const results = search
        .near(CALGARY_CENTER, 10)
        .where('rating', 'greaterThan', 4.0)
        .where('tags', 'includes', 'squat rack')
        .sortBy([{ field: 'distance', order: 'asc' }])
        .limit(5)
        .execute();

      expect(results.length).toBeLessThanOrEqual(5);
      results.forEach((r) => {
        expect(r.rating).toBeGreaterThan(4.0);
        expect(r.tags).toContain('squat rack');
        expect(r.distance).toBeDefined();
      });
    });
  });

  describe('executeWithMetadata', () => {
    it('should return metadata with results', () => {
      const { items, metadata } = search
        .near(CALGARY_CENTER, 10)
        .limit(2)
        .executeWithMetadata();

      expect(items.length).toBe(2);
      expect(metadata.totalMatches).toBe(5);
      expect(metadata.returnedCount).toBe(2);
      expect(typeof metadata.queryTimeMs).toBe('number');
    });
  });
});

describe('static mode', () => {
  it('should create instance in static mode', () => {
    const staticSearch = GeoSearch.from(testGyms, { static: true });
    expect(staticSearch.staticMode).toBe(true);
    expect(staticSearch.size).toBe(5);
  });

  it('should find items within radius in static mode', () => {
    const staticSearch = GeoSearch.from(testGyms, { static: true });
    const results = staticSearch.near(CALGARY_CENTER, 5).execute();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('distance');
  });

  it('should find items within bounds in static mode', () => {
    const staticSearch = GeoSearch.from(testGyms, { static: true });
    const results = staticSearch
      .withinBounds({
        minLat: 51.03,
        maxLat: 51.06,
        minLng: -114.13,
        maxLng: -114.06,
      })
      .execute();
    expect(results.length).toBeGreaterThan(0);
  });

  it('should throw error when adding to static index', () => {
    const staticSearch = GeoSearch.from(testGyms, { static: true });
    const newGym: TestLocation = {
      id: '6',
      name: 'New Gym',
      lat: 51.05,
      lng: -114.07,
      rating: 4.0,
      tags: ['new'],
      price: 40,
    };
    expect(() => staticSearch.add(newGym)).toThrow();
  });

  it('should throw error when removing from static index', () => {
    const staticSearch = GeoSearch.from(testGyms, { static: true });
    expect(() => staticSearch.remove(testGyms[0]!)).toThrow();
  });

  it('should apply attribute filters in static mode', () => {
    const staticSearch = GeoSearch.from(testGyms, { static: true });
    const results = staticSearch.where('rating', 'greaterThan', 4.0).execute();
    expect(results.length).toBe(3);
    results.forEach((r) => expect(r.rating).toBeGreaterThan(4.0));
  });

  it('should handle complex queries in static mode', () => {
    const staticSearch = GeoSearch.from(testGyms, { static: true });
    const results = staticSearch
      .near(CALGARY_CENTER, 10)
      .where('rating', 'greaterThan', 4.0)
      .where('tags', 'includes', 'squat rack')
      .sortBy([{ field: 'distance', order: 'asc' }])
      .limit(5)
      .execute();

    expect(results.length).toBeLessThanOrEqual(5);
    results.forEach((r) => {
      expect(r.rating).toBeGreaterThan(4.0);
      expect(r.tags).toContain('squat rack');
      expect(r.distance).toBeDefined();
    });
  });
});

describe('caching', () => {
  it('should create instance with caching enabled', () => {
    const cachedSearch = GeoSearch.from(testGyms, { cache: true });
    expect(cachedSearch.cacheEnabled).toBe(true);
    expect(cachedSearch.cacheSize).toBe(0);
  });

  it('should cache query results', () => {
    const cachedSearch = GeoSearch.from(testGyms, { cache: true });

    // Execute the same query twice
    cachedSearch.near(CALGARY_CENTER, 5).execute();
    expect(cachedSearch.cacheSize).toBe(1);

    cachedSearch.near(CALGARY_CENTER, 5).execute();
    expect(cachedSearch.cacheSize).toBe(1); // Still 1, served from cache
  });

  it('should report cache hit in metadata', () => {
    const cachedSearch = GeoSearch.from(testGyms, { cache: true });

    // First query - cache miss
    const { metadata: meta1 } = cachedSearch
      .near(CALGARY_CENTER, 5)
      .executeWithMetadata();
    expect(meta1.cached).toBe(false);

    // Second query - cache hit
    const { metadata: meta2 } = cachedSearch
      .near(CALGARY_CENTER, 5)
      .executeWithMetadata();
    expect(meta2.cached).toBe(true);
  });

  it('should invalidate cache on data change', () => {
    const cachedSearch = GeoSearch.from(testGyms, { cache: true });

    // Execute a query to populate cache
    cachedSearch.near(CALGARY_CENTER, 5).execute();
    expect(cachedSearch.cacheSize).toBe(1);

    // Add an item - should invalidate cache
    cachedSearch.add({
      id: '6',
      name: 'New Gym',
      lat: 51.05,
      lng: -114.07,
      rating: 4.0,
      tags: [],
      price: 40,
    });
    expect(cachedSearch.cacheSize).toBe(0);
  });

  it('should not cache queries with scoring functions', () => {
    const cachedSearch = GeoSearch.from(testGyms, { cache: true });

    // Query with scoring function - not cached
    cachedSearch
      .near(CALGARY_CENTER, 10)
      .score((item) => item.rating * 10)
      .execute();

    expect(cachedSearch.cacheSize).toBe(0);
  });

  it('should clear cache manually', () => {
    const cachedSearch = GeoSearch.from(testGyms, { cache: true });

    cachedSearch.near(CALGARY_CENTER, 5).execute();
    cachedSearch.where('rating', 'greaterThan', 4.0).execute();
    expect(cachedSearch.cacheSize).toBe(2);

    cachedSearch.clearCache();
    expect(cachedSearch.cacheSize).toBe(0);
  });

  it('should respect cache size limit', () => {
    const cachedSearch = GeoSearch.from(testGyms, { cache: true, cacheSize: 2 });

    // Fill cache with distinct queries
    cachedSearch.where('rating', 'greaterThan', 3.0).execute();
    cachedSearch.where('rating', 'greaterThan', 4.0).execute();
    expect(cachedSearch.cacheSize).toBe(2);

    // Add one more - should evict oldest
    cachedSearch.where('rating', 'greaterThan', 4.5).execute();
    expect(cachedSearch.cacheSize).toBe(2);
  });

  it('should work with static mode', () => {
    const search = GeoSearch.from(testGyms, { static: true, cache: true });
    expect(search.staticMode).toBe(true);
    expect(search.cacheEnabled).toBe(true);

    const { metadata: meta1 } = search.near(CALGARY_CENTER, 5).executeWithMetadata();
    expect(meta1.cached).toBe(false);

    const { metadata: meta2 } = search.near(CALGARY_CENTER, 5).executeWithMetadata();
    expect(meta2.cached).toBe(true);
  });
});

describe('haversineDistance', () => {
  it('should calculate correct distance', () => {
    // Calgary to Edmonton is approximately 299km
    const calgary = { lat: 51.0447, lng: -114.0719 };
    const edmonton = { lat: 53.5461, lng: -113.4938 };

    const distance = haversineDistance(calgary, edmonton);
    expect(distance).toBeGreaterThan(270);
    expect(distance).toBeLessThan(300);
  });

  it('should return 0 for same point', () => {
    const point = { lat: 51.0447, lng: -114.0719 };
    const distance = haversineDistance(point, point);
    expect(distance).toBe(0);
  });
});
