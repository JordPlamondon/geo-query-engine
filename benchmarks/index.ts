/**
 * Performance benchmarks for geo-query-engine
 *
 * Tests query performance with varying dataset sizes to validate
 * the <50ms target for 10k+ points.
 *
 * Compares: Dynamic (RBush) vs Static (KDBush) modes
 * Tests: Query caching performance
 */

import { GeoSearch, haversineDistance } from '../src/index.js';
import type { GeoPoint } from '../src/index.js';

interface BenchmarkLocation extends GeoPoint {
  id: string;
  name: string;
  rating: number;
  tags: string[];
  price: number;
}

// Generate random points within a bounding box
function generateRandomPoints(count: number, bounds: {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}): BenchmarkLocation[] {
  const tags = ['gym', 'pool', 'sauna', 'cardio', 'weights', 'crossfit', 'yoga', 'spa'];

  return Array.from({ length: count }, (_, i) => ({
    id: `loc-${i}`,
    name: `Location ${i}`,
    lat: bounds.minLat + Math.random() * (bounds.maxLat - bounds.minLat),
    lng: bounds.minLng + Math.random() * (bounds.maxLng - bounds.minLng),
    rating: 1 + Math.random() * 4, // 1-5
    price: 20 + Math.random() * 80, // 20-100
    tags: tags.filter(() => Math.random() > 0.6), // Random subset of tags
  }));
}

// Benchmark runner
function runBenchmark(name: string, iterations: number, fn: () => void): { avgMs: number; minMs: number; maxMs: number } {
  const times: number[] = [];

  // Warmup
  for (let i = 0; i < 3; i++) {
    fn();
  }

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }

  const avgMs = times.reduce((a, b) => a + b, 0) / times.length;
  const minMs = Math.min(...times);
  const maxMs = Math.max(...times);

  return { avgMs, minMs, maxMs };
}

function formatResult(result: { avgMs: number; minMs: number; maxMs: number }): string {
  return `avg: ${result.avgMs.toFixed(2)}ms, min: ${result.minMs.toFixed(2)}ms, max: ${result.maxMs.toFixed(2)}ms`;
}

console.log('='.repeat(70));
console.log('geo-query-engine Performance Benchmarks v0.2.0');
console.log('='.repeat(70));
console.log('');

// Calgary area bounds
const calgaryBounds = {
  minLat: 50.85,
  maxLat: 51.20,
  minLng: -114.30,
  maxLng: -113.90,
};

const center = { lat: 51.0447, lng: -114.0719 };
const iterations = 100;

// Test different dataset sizes
const sizes = [10000, 50000, 100000];

for (const size of sizes) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`Dataset Size: ${size.toLocaleString()} points`);
  console.log('═'.repeat(70));

  const data = generateRandomPoints(size, calgaryBounds);

  // ═══════════════════════════════════════════════════════════════════════════
  // DYNAMIC MODE (RBush)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`\n${'─'.repeat(35)}`);
  console.log('DYNAMIC MODE (RBush)');
  console.log('─'.repeat(35));

  let dynamicSearch: GeoSearch<BenchmarkLocation>;
  const dynamicIndexResult = runBenchmark('Index Creation', 10, () => {
    dynamicSearch = GeoSearch.from(data);
  });
  dynamicSearch = GeoSearch.from(data);
  console.log(`Index Creation:     ${formatResult(dynamicIndexResult)}`);

  const dynamicRadiusResult = runBenchmark('Radius Search 5km', iterations, () => {
    dynamicSearch.near(center, 5).execute();
  });
  console.log(`Radius Search 5km:  ${formatResult(dynamicRadiusResult)}`);

  const dynamicComplexResult = runBenchmark('Complex Query', iterations, () => {
    dynamicSearch
      .near(center, 10)
      .where('rating', 'greaterThan', 3.0)
      .where('price', 'lessThan', 80)
      .sortBy([
        { field: 'distance', order: 'asc' },
        { field: 'rating', order: 'desc' },
      ])
      .limit(20)
      .execute();
  });
  console.log(`Complex Query:      ${formatResult(dynamicComplexResult)}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // STATIC MODE (KDBush)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`\n${'─'.repeat(35)}`);
  console.log('STATIC MODE (KDBush)');
  console.log('─'.repeat(35));

  let staticSearch: GeoSearch<BenchmarkLocation>;
  const staticIndexResult = runBenchmark('Index Creation', 10, () => {
    staticSearch = GeoSearch.from(data, { static: true });
  });
  staticSearch = GeoSearch.from(data, { static: true });
  console.log(`Index Creation:     ${formatResult(staticIndexResult)}`);

  const staticRadiusResult = runBenchmark('Radius Search 5km', iterations, () => {
    staticSearch.near(center, 5).execute();
  });
  console.log(`Radius Search 5km:  ${formatResult(staticRadiusResult)}`);

  const staticComplexResult = runBenchmark('Complex Query', iterations, () => {
    staticSearch
      .near(center, 10)
      .where('rating', 'greaterThan', 3.0)
      .where('price', 'lessThan', 80)
      .sortBy([
        { field: 'distance', order: 'asc' },
        { field: 'rating', order: 'desc' },
      ])
      .limit(20)
      .execute();
  });
  console.log(`Complex Query:      ${formatResult(staticComplexResult)}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // CACHED MODE
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`\n${'─'.repeat(35)}`);
  console.log('CACHED MODE (Static + Cache)');
  console.log('─'.repeat(35));

  const cachedSearch = GeoSearch.from(data, { static: true, cache: true });

  // First query (cold cache)
  const coldCacheResult = runBenchmark('Cold Cache Query', 10, () => {
    // Clear cache before each run to measure cold performance
    cachedSearch.clearCache();
    cachedSearch
      .near(center, 10)
      .where('rating', 'greaterThan', 3.0)
      .sortBy([{ field: 'distance', order: 'asc' }])
      .limit(20)
      .execute();
  });
  console.log(`Cold Cache Query:   ${formatResult(coldCacheResult)}`);

  // Warm up cache with the query
  cachedSearch.clearCache();
  cachedSearch
    .near(center, 10)
    .where('rating', 'greaterThan', 3.0)
    .sortBy([{ field: 'distance', order: 'asc' }])
    .limit(20)
    .execute();

  // Repeated queries (warm cache)
  const warmCacheResult = runBenchmark('Warm Cache Query', iterations, () => {
    cachedSearch
      .near(center, 10)
      .where('rating', 'greaterThan', 3.0)
      .sortBy([{ field: 'distance', order: 'asc' }])
      .limit(20)
      .execute();
  });
  console.log(`Warm Cache Query:   ${formatResult(warmCacheResult)}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPARISON SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`\n${'─'.repeat(35)}`);
  console.log('COMPARISON');
  console.log('─'.repeat(35));

  const indexSpeedup = dynamicIndexResult.avgMs / staticIndexResult.avgMs;
  const querySpeedup = dynamicComplexResult.avgMs / staticComplexResult.avgMs;
  const cacheSpeedup = staticComplexResult.avgMs / warmCacheResult.avgMs;

  console.log(`Index Creation:  Static is ${indexSpeedup.toFixed(1)}x faster than Dynamic`);
  console.log(`Complex Query:   Static is ${querySpeedup.toFixed(1)}x faster than Dynamic`);
  console.log(`With Cache:      Cache is ${cacheSpeedup.toFixed(0)}x faster than uncached`);

  // Performance check
  const passed = staticComplexResult.avgMs < 50;
  console.log(`\n✓ Performance Target (<50ms): ${passed ? 'PASSED' : 'FAILED'}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Additional benchmarks
// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(70)}`);
console.log('Additional Benchmarks');
console.log('═'.repeat(70));

// Haversine distance calculation benchmark
const point1 = { lat: 51.0447, lng: -114.0719 };
const point2 = { lat: 53.5461, lng: -113.4938 };

const haversineResult = runBenchmark('Haversine Distance (1M calls)', 10, () => {
  for (let i = 0; i < 1_000_000; i++) {
    haversineDistance(point1, point2);
  }
});
console.log(`\nHaversine (1M):    ${formatResult(haversineResult)}`);

// Dynamic operations benchmark
console.log(`\n${'─'.repeat(35)}`);
console.log('Dynamic Operations (10k dataset)');
console.log('─'.repeat(35));

const dynamicData = generateRandomPoints(10000, calgaryBounds);
const dynamicOpsSearch = GeoSearch.from(dynamicData);

// Single add
const addResult = runBenchmark('Add Single Item', iterations, () => {
  const newItem: BenchmarkLocation = {
    id: 'new-item',
    name: 'New Location',
    lat: 51.05,
    lng: -114.07,
    rating: 4.5,
    tags: ['gym'],
    price: 50,
  };
  dynamicOpsSearch.add(newItem);
  dynamicOpsSearch.remove(newItem);
});
console.log(`Add/Remove Single:  ${formatResult(addResult)}`);

console.log(`\n${'═'.repeat(70)}`);
console.log('Benchmark Complete');
console.log('═'.repeat(70));
