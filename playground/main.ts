import { GeoSearch } from '../src/index.js';
import { gyms, type Gym } from './data.js';
import type { Map as LeafletMap, Marker, Circle } from 'leaflet';

declare const L: typeof import('leaflet');

// Initialize the search engine with gym data
const search = GeoSearch.from<Gym>(gyms);

// Map and markers state
let map: LeafletMap;
let markers: Marker[] = [];
let searchCircle: Circle | null = null;
let centerMarker: Marker | null = null;
let searchCenter = { lat: 51.0447, lng: -114.0719 };

// DOM elements
const centerInput = document.getElementById('center') as HTMLInputElement;
const radiusInput = document.getElementById('radius') as HTMLInputElement;
const minRatingInput = document.getElementById('minRating') as HTMLInputElement;
const maxPriceInput = document.getElementById('maxPrice') as HTMLInputElement;
const equipmentSelect = document.getElementById('equipment') as HTMLSelectElement;
const sortBySelect = document.getElementById('sortBy') as HTMLSelectElement;
const sortOrderSelect = document.getElementById('sortOrder') as HTMLSelectElement;
const limitInput = document.getElementById('limit') as HTMLInputElement;
const searchButton = document.getElementById('search') as HTMLButtonElement;
const resultsDiv = document.getElementById('results') as HTMLDivElement;

// Initialize map
function initMap() {
  map = L.map('map').setView([searchCenter.lat, searchCenter.lng], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  // Add all gyms to the map initially
  gyms.forEach((gym) => {
    const marker = L.marker([gym.lat, gym.lng])
      .addTo(map)
      .bindPopup(`<b>${gym.name}</b><br>Rating: ${gym.rating}<br>$${gym.price}/month`);
    markers.push(marker);
  });

  // Click on map to set search center
  map.on('click', (e: L.LeafletMouseEvent) => {
    searchCenter = { lat: e.latlng.lat, lng: e.latlng.lng };
    centerInput.value = `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
    updateCenterMarker();
    performSearch();
  });

  // Initial center marker
  updateCenterMarker();
}

function updateCenterMarker() {
  if (centerMarker) {
    map.removeLayer(centerMarker);
  }
  centerMarker = L.marker([searchCenter.lat, searchCenter.lng], {
    icon: L.divIcon({
      className: 'center-marker',
      html: '<div style="background: red; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white;"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    }),
  }).addTo(map);
}

function updateSearchCircle(radiusKm: number) {
  if (searchCircle) {
    map.removeLayer(searchCircle);
  }
  searchCircle = L.circle([searchCenter.lat, searchCenter.lng], {
    radius: radiusKm * 1000, // Convert km to meters
    color: '#0066cc',
    fillColor: '#0066cc',
    fillOpacity: 0.1,
    weight: 2,
  }).addTo(map);
}

function clearMarkers() {
  markers.forEach((marker) => map.removeLayer(marker));
  markers = [];
}

function performSearch() {
  const radius = parseFloat(radiusInput.value);
  const minRating = parseFloat(minRatingInput.value);
  const maxPrice = parseFloat(maxPriceInput.value);
  const selectedEquipment = Array.from(equipmentSelect.selectedOptions).map((opt) => opt.value);
  const sortBy = sortBySelect.value as 'distance' | 'rating' | 'price';
  const sortOrder = sortOrderSelect.value as 'asc' | 'desc';
  const limit = parseInt(limitInput.value);

  // Build and execute query
  let query = search.near(searchCenter, radius);

  if (minRating > 0) {
    query = query.where('rating', 'greaterThanOrEqual', minRating);
  }

  if (maxPrice < 100) {
    query = query.where('price', 'lessThanOrEqual', maxPrice);
  }

  if (selectedEquipment.length > 0) {
    query = query.where('equipment', 'includesAll', selectedEquipment);
  }

  const { items: results, metadata } = query
    .sortBy([{ field: sortBy, order: sortOrder }])
    .limit(limit)
    .executeWithMetadata();

  // Update map
  updateSearchCircle(radius);
  clearMarkers();

  // Add result markers
  results.forEach((gym, index) => {
    const marker = L.marker([gym.lat, gym.lng], {
      icon: L.divIcon({
        className: 'result-marker',
        html: `<div style="background: #0066cc; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white;">${index + 1}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    })
      .addTo(map)
      .bindPopup(
        `<b>${gym.name}</b><br>` +
          `Rating: ${'★'.repeat(Math.round(gym.rating))}${'☆'.repeat(5 - Math.round(gym.rating))} (${gym.rating})<br>` +
          `Price: $${gym.price}/month<br>` +
          `Distance: ${gym.distance.toFixed(2)} km<br>` +
          `Equipment: ${gym.equipment.join(', ')}`
      );
    markers.push(marker);
  });

  // Fit map to show all results
  if (results.length > 0) {
    const bounds = L.latLngBounds(results.map((gym) => [gym.lat, gym.lng]));
    bounds.extend([searchCenter.lat, searchCenter.lng]);
    map.fitBounds(bounds, { padding: [50, 50] });
  }

  // Update results panel
  renderResults(results, metadata);
}

function renderResults(
  results: (Gym & { distance: number })[],
  metadata: { totalMatches: number; returnedCount: number; queryTimeMs: number }
) {
  if (results.length === 0) {
    resultsDiv.innerHTML = '<p>No gyms found matching your criteria.</p>';
    return;
  }

  let html = results
    .map(
      (gym, index) => `
    <div class="result-item">
      <div class="result-name">${index + 1}. ${gym.name}</div>
      <div class="result-details">
        ${'★'.repeat(Math.round(gym.rating))}${'☆'.repeat(5 - Math.round(gym.rating))} (${gym.rating}) · $${gym.price}/mo
      </div>
      <div class="result-distance">${gym.distance.toFixed(2)} km away</div>
      <div class="tags">
        ${gym.equipment.map((eq) => `<span class="tag">${eq}</span>`).join('')}
      </div>
    </div>
  `
    )
    .join('');

  html += `
    <div class="metadata">
      Showing ${metadata.returnedCount} of ${metadata.totalMatches} matches · Query: ${metadata.queryTimeMs.toFixed(2)}ms
    </div>
  `;

  resultsDiv.innerHTML = html;
}

// Event listeners
searchButton.addEventListener('click', performSearch);
radiusInput.addEventListener('change', performSearch);
minRatingInput.addEventListener('change', performSearch);
maxPriceInput.addEventListener('change', performSearch);
equipmentSelect.addEventListener('change', performSearch);
sortBySelect.addEventListener('change', performSearch);
sortOrderSelect.addEventListener('change', performSearch);
limitInput.addEventListener('change', performSearch);

// Initialize
initMap();
performSearch();
