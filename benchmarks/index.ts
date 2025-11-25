/**
 * Performance benchmarks for geo-query-engine
 *
 * Tests query performance with varying dataset sizes to validate
 * the <50ms target for 10k+ points.
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

console.log('='.repeat(60));
console.log('geo-query-engine Performance Benchmarks');
console.log('='.repeat(60));
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
const sizes = [1000, 5000, 10000, 25000, 50000, 100000];

for (const size of sizes) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Dataset Size: ${size.toLocaleString()} points`);
  console.log('─'.repeat(60));

  const data = generateRandomPoints(size, calgaryBounds);

  // Benchmark: Index creation (bulk load)
  let search: GeoSearch<BenchmarkLocation>;
  const indexResult = runBenchmark('Index Creation', 10, () => {
    search = GeoSearch.from(data);
  });
  search = GeoSearch.from(data);
  console.log(`Index Creation:     ${formatResult(indexResult)}`);

  // Benchmark: Radius search (5km)
  const radiusResult = runBenchmark('Radius Search 5km', iterations, () => {
    search.near(center, 5).execute();
  });
  console.log(`Radius Search 5km:  ${formatResult(radiusResult)}`);

  // Benchmark: Radius search (10km)
  const radius10Result = runBenchmark('Radius Search 10km', iterations, () => {
    search.near(center, 10).execute();
  });
  console.log(`Radius Search 10km: ${formatResult(radius10Result)}`);

  // Benchmark: Radius + single filter
  const filterResult = runBenchmark('Radius + Filter', iterations, () => {
    search.near(center, 5).where('rating', 'greaterThan', 3.5).execute();
  });
  console.log(`Radius + Filter:    ${formatResult(filterResult)}`);

  // Benchmark: Radius + multiple filters
  const multiFilterResult = runBenchmark('Radius + Multi Filter', iterations, () => {
    search
      .near(center, 5)
      .where('rating', 'greaterThan', 3.5)
      .where('price', 'lessThan', 60)
      .execute();
  });
  console.log(`Radius + Multi:     ${formatResult(multiFilterResult)}`);

  // Benchmark: Radius + filter + sort
  const sortResult = runBenchmark('Radius + Filter + Sort', iterations, () => {
    search
      .near(center, 5)
      .where('rating', 'greaterThan', 3.5)
      .sortBy([{ field: 'distance', order: 'asc' }])
      .execute();
  });
  console.log(`With Sort:          ${formatResult(sortResult)}`);

  // Benchmark: Complex query (radius + filter + sort + limit)
  const complexResult = runBenchmark('Complex Query', iterations, () => {
    search
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
  console.log(`Complex Query:      ${formatResult(complexResult)}`);

  // Performance check
  const passed = complexResult.avgMs < 50;
  console.log(`\n✓ Performance Target (<50ms): ${passed ? 'PASSED' : 'FAILED'}`);
}

// Additional benchmarks
console.log(`\n${'='.repeat(60)}`);
console.log('Additional Benchmarks');
console.log('='.repeat(60));

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
console.log(`\n${'─'.repeat(60)}`);
console.log('Dynamic Operations (10k dataset)');
console.log('─'.repeat(60));

const dynamicData = generateRandomPoints(10000, calgaryBounds);
const dynamicSearch = GeoSearch.from(dynamicData);

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
  dynamicSearch.add(newItem);
  dynamicSearch.remove(newItem);
});
console.log(`Add/Remove Single:  ${formatResult(addResult)}`);

console.log(`\n${'='.repeat(60)}`);
console.log('Benchmark Complete');
console.log('='.repeat(60));
