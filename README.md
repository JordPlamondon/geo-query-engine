# geo-query-engine

A high-performance client-side geospatial search and filtering engine for location-based applications. Provides a fluent API for filtering, sorting, and ranking geographic data points in the browser.

## Features

- **Radius Search**: Find points within a specified distance using Haversine formula
- **Bounding Box**: Filter points within geographic bounds
- **Attribute Filtering**: Generic filters with 14+ operators (equals, includes, greaterThan, etc.)
- **Multi-Criteria Sorting**: Sort by distance, rating, or any field
- **Custom Scoring**: Apply custom ranking functions
- **Dynamic Updates**: Add/remove points after initialization
- **High Performance**: <50ms queries on 100k+ points using R-tree spatial indexing
- **Type Safe**: Full TypeScript support with generics
- **Tiny Bundle**: ~5KB gzipped (library only)

## Installation

```bash
npm install geo-query-engine
```

## Quick Start

```typescript
import { GeoSearch } from 'geo-query-engine';

interface Gym {
  lat: number;
  lng: number;
  name: string;
  rating: number;
  equipment: string[];
  price: number;
}

const gyms: Gym[] = [
  { lat: 51.0453, lng: -114.0632, name: 'Downtown Fitness', rating: 4.5, equipment: ['squat rack', 'bench'], price: 50 },
  { lat: 51.0398, lng: -114.1265, name: 'West End Gym', rating: 4.2, equipment: ['squat rack', 'pool'], price: 60 },
  // ... more gyms
];

// Create search instance
const search = GeoSearch.from(gyms);

// Find gyms within 5km, with good ratings and specific equipment
const results = search
  .near({ lat: 51.0447, lng: -114.0719 }, 5) // 5km radius
  .where('rating', 'greaterThan', 4.0)
  .where('equipment', 'includesAll', ['squat rack', 'bench'])
  .sortBy([
    { field: 'distance', order: 'asc' },
    { field: 'rating', order: 'desc' }
  ])
  .limit(10)
  .execute();

// Results include distance from center
results.forEach(gym => {
  console.log(`${gym.name}: ${gym.distance.toFixed(2)}km away`);
});
```

## API Reference

### GeoSearch

Main entry point for creating and querying geographic datasets.

#### Static Methods

```typescript
// Create from array of points
const search = GeoSearch.from<T>(items: T[], options?: GeoSearchOptions);
```

#### Instance Methods

```typescript
// Add/remove items dynamically
search.add(item);
search.addMany(items);
search.remove(item);
search.clear();

// Start query chains
search.near(center, radiusKm);    // Radius search
search.withinBounds(bounds);       // Bounding box search
search.where(field, operator, value); // Attribute filter
search.sortBy(criteria);           // Sort results
search.all();                      // Get all items
```

### QueryBuilder

Immutable query builder returned by search methods. Chain methods to build complex queries.

```typescript
search
  .near(center, radiusKm)           // Geographic filter (adds distance to results)
  .withinBounds({ minLat, maxLat, minLng, maxLng })  // Bounding box filter
  .where(field, operator, value)    // Attribute filter (chainable)
  .sortBy([{ field, order }])       // Multi-criteria sort
  .score((item, distance) => number) // Custom scoring function
  .limit(count)                     // Limit results
  .offset(count)                    // Skip results (pagination)
  .execute();                       // Execute and return results
  .executeWithMetadata();           // Execute with query metadata
```

### Filter Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `equals` | Exact match | `.where('status', 'equals', 'active')` |
| `notEquals` | Not equal | `.where('status', 'notEquals', 'closed')` |
| `greaterThan` | Greater than | `.where('rating', 'greaterThan', 4.0)` |
| `greaterThanOrEqual` | Greater than or equal | `.where('price', 'greaterThanOrEqual', 50)` |
| `lessThan` | Less than | `.where('price', 'lessThan', 100)` |
| `lessThanOrEqual` | Less than or equal | `.where('price', 'lessThanOrEqual', 75)` |
| `includes` | Array contains value | `.where('tags', 'includes', 'wifi')` |
| `includesAll` | Array contains all values | `.where('equipment', 'includesAll', ['squat rack', 'bench'])` |
| `includesAny` | Array contains any value | `.where('features', 'includesAny', ['pool', 'sauna'])` |
| `startsWith` | String starts with | `.where('name', 'startsWith', 'Downtown')` |
| `endsWith` | String ends with | `.where('name', 'endsWith', 'Gym')` |
| `contains` | String contains | `.where('name', 'contains', 'Fitness')` |
| `between` | Value in range (inclusive) | `.where('rating', 'between', [3.5, 4.5])` |
| `in` | Value in array | `.where('type', 'in', ['gym', 'studio'])` |
| `notIn` | Value not in array | `.where('status', 'notIn', ['closed', 'renovation'])` |

### Sorting

Sort by any field or by distance (when using `.near()`):

```typescript
// Single criterion
.sortBy([{ field: 'rating', order: 'desc' }])

// Multiple criteria (tie-breakers)
.sortBy([
  { field: 'distance', order: 'asc' },
  { field: 'rating', order: 'desc' },
  { field: 'price', order: 'asc' }
])
```

### Custom Scoring

Apply custom ranking logic:

```typescript
const results = search
  .near(center, 10)
  .score((item, distance) => {
    // Combine rating and distance into a score
    const distanceScore = Math.max(0, 10 - distance);
    return item.rating * 2 + distanceScore;
  })
  .sortBy([{ field: 'score', order: 'desc' }])
  .execute();
```

### Pagination

Use `limit` and `offset` for pagination:

```typescript
// Page 1
const page1 = search.near(center, 10).limit(20).execute();

// Page 2
const page2 = search.near(center, 10).offset(20).limit(20).execute();

// With metadata
const { items, metadata } = search
  .near(center, 10)
  .limit(20)
  .executeWithMetadata();

console.log(`Showing ${metadata.returnedCount} of ${metadata.totalMatches} results`);
console.log(`Query took ${metadata.queryTimeMs.toFixed(2)}ms`);
```

### Dynamic Updates

Add or remove items after initialization:

```typescript
const search = GeoSearch.from(initialData);

// Add items
search.add(newItem);
search.addMany([item1, item2, item3]);

// Remove items
search.remove(itemToRemove);

// Clear all
search.clear();

// Check size
console.log(`${search.size} items in index`);
```

## Performance

Benchmarks on an M1 MacBook Pro:

| Dataset Size | Complex Query (avg) | Target |
|--------------|---------------------|--------|
| 1,000 points | 0.07ms | <50ms |
| 10,000 points | 0.57ms | <50ms |
| 50,000 points | 4.97ms | <50ms |
| 100,000 points | 16.32ms | <50ms |

Run benchmarks yourself:
```bash
npm run benchmark
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build library
npm run build

# Start playground
npm run playground

# Run benchmarks
npm run benchmark

# Lint code
npm run lint

# Format code
npm run format
```

## Bundle Size

- ESM: ~5.7KB (1.9KB gzipped)
- CommonJS: ~5.9KB
- UMD (IIFE): ~11.5KB

## Browser Support

Works in all modern browsers with ES2020 support:
- Chrome 80+
- Firefox 72+
- Safari 14+
- Edge 80+

## License

MIT
