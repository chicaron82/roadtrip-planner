import type { POISuggestion, POISuggestionCategory, POISuggestionGroup, Location, TripPreference } from '../types';

// Overpass API endpoint
const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

// Corridor widths for different detour tolerances
const CORRIDOR_WIDTHS = {
  quick: 5000,      // 5km - minimal detour
  worthIt: 20000,   // 20km - worth the detour
};

const DESTINATION_RADIUS = 50000; // 50km around destination

/**
 * OSM tag mapping for POI categories
 * Maps our POISuggestionCategory to Overpass QL queries
 */
const CATEGORY_TAG_QUERIES: Record<POISuggestionCategory, string> = {
  viewpoint: '["tourism"="viewpoint"]',
  attraction: '["tourism"~"attraction|theme_park|zoo"]',
  museum: '["tourism"~"museum|gallery|artwork"]',
  park: '["leisure"~"park|nature_reserve"]["boundary"!="national_park"]',
  landmark: '["historic"~"memorial|monument|castle|ruins|archaeological_site"]',
  waterfall: '["waterfall"="yes"]["natural"="waterfall"]',
  restaurant: '["amenity"="restaurant"]',
  cafe: '["amenity"~"cafe|fast_food"]',
  gas: '["amenity"="fuel"]',
  hotel: '["tourism"~"hotel|motel|guest_house"]',
  shopping: '["shop"~"supermarket|mall|department_store"]',
  entertainment: '["leisure"~"amusement_arcade|bowling_alley"]["amenity"~"cinema|theatre"]',
};

/**
 * Map trip preferences to POI categories
 */
const PREFERENCE_CATEGORY_MAP: Record<TripPreference, POISuggestionCategory[]> = {
  scenic: ['viewpoint', 'park', 'waterfall', 'landmark'],
  family: ['attraction', 'park', 'entertainment', 'landmark'],
  budget: ['viewpoint', 'park', 'cafe', 'waterfall'],
  foodie: ['restaurant', 'cafe'],
};

/**
 * Estimate total route distance from geometry (Haversine sum)
 */
function estimateRouteDistanceKm(geometry: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < geometry.length; i++) {
    const [lat1, lng1] = geometry[i - 1];
    const [lat2, lng2] = geometry[i];
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}

/**
 * Haversine distance between two points (km)
 */
function haversineDistanceSimple(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Check if a point is within `maxDistKm` of ANY segment of a polyline.
 * Samples every ~20th point for performance on large geometries.
 */
function isNearPolyline(
  lat: number,
  lng: number,
  polyline: [number, number][],
  maxDistKm: number
): boolean {
  // Sample the polyline — check every Nth point so we don't do 10k haversines per POI
  const step = Math.max(1, Math.floor(polyline.length / 200));
  for (let i = 0; i < polyline.length; i += step) {
    const [pLat, pLng] = polyline[i];
    const dist = haversineDistanceSimple(lat, lng, pLat, pLng);
    if (dist <= maxDistKm) return true;
  }
  // Always check last point
  const [lastLat, lastLng] = polyline[polyline.length - 1];
  if (haversineDistanceSimple(lat, lng, lastLat, lastLng) <= maxDistKm) return true;
  return false;
}

/**
 * Build Overpass QL query for corridor search
 * Uses a bounding box around the route polyline
 */
function buildCorridorQuery(
  routeGeometry: [number, number][],
  categories: POISuggestionCategory[],
  corridorWidth: number
): string {
  // Calculate bounding box with buffer (safe for large arrays — no spread)
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const [lat, lng] of routeGeometry) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  // Add buffer (rough conversion: 1 degree ≈ 111km)
  const buffer = corridorWidth / 111000;

  const bbox = `${minLat - buffer},${minLng - buffer},${maxLat + buffer},${maxLng + buffer}`;

  // Build UNION query — one node+way line per category (OR logic)
  const lines = categories.map(cat => {
    const tag = CATEGORY_TAG_QUERIES[cat];
    return `      node${tag}(${bbox});\n      way${tag}(${bbox});`;
  }).join('\n');

  return `
    [out:json][timeout:30][maxsize:5242880];
    (
${lines}
    );
    out center;
  `.trim();
}

/**
 * Build Overpass QL query for destination area search
 */
function buildDestinationQuery(
  destination: Location,
  categories: POISuggestionCategory[],
  radius: number
): string {
  // Build UNION query — one node+way line per category (OR logic)
  const lines = categories.map(cat => {
    const tag = CATEGORY_TAG_QUERIES[cat];
    return `      node${tag}(around:${radius},${destination.lat},${destination.lng});\n      way${tag}(around:${radius},${destination.lat},${destination.lng});`;
  }).join('\n');

  return `
    [out:json][timeout:30];
    (
${lines}
    );
    out center;
  `.trim();
}

/**
 * Execute Overpass API query
 */
async function executeOverpassQuery(query: string): Promise<OverpassElement[]> {
  try {
    const response = await fetch(OVERPASS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const data: OverpassResponse = await response.json();
    return data.elements || [];
  } catch (error) {
    console.error('Overpass query failed:', error);
    return [];
  }
}

/**
 * Convert Overpass element to POISuggestion (before ranking)
 */
function overpassElementToPOI(element: OverpassElement): POISuggestion | null {
  // Extract coordinates (use center for ways)
  const lat = element.lat || element.center?.lat;
  const lng = element.lon || element.center?.lon;

  if (!lat || !lng) return null;

  // Extract name
  const name = element.tags?.name || element.tags?.['name:en'] || 'Unnamed';

  // Determine category from tags
  const category = determineCategoryFromTags(element.tags || {});
  if (!category) return null;

  return {
    id: `osm-${element.type}-${element.id}`,
    name,
    category,
    lat,
    lng,
    address: element.tags?.['addr:full'] || element.tags?.['addr:street'],
    bucket: 'along-way', // Will be updated by caller
    distanceFromRoute: 0, // Will be calculated later
    detourTimeMinutes: 0, // Will be calculated later
    rankingScore: 0, // Will be calculated by ranking algorithm
    categoryMatchScore: 0,
    popularityScore: calculatePopularityScore(element.tags || {}),
    timingFitScore: 0,
    actionState: 'suggested',
    osmType: element.type,
    osmId: String(element.id),
    tags: element.tags,
  };
}

/**
 * Determine POI category from OSM tags
 */
function determineCategoryFromTags(tags: Record<string, string>): POISuggestionCategory | null {
  if (tags.tourism === 'viewpoint') return 'viewpoint';
  if (tags.tourism === 'museum' || tags.tourism === 'gallery') return 'museum';
  if (tags.tourism === 'attraction' || tags.tourism === 'theme_park' || tags.tourism === 'zoo') return 'attraction';
  if (tags.tourism === 'artwork') return 'landmark';
  if (tags.tourism === 'hotel' || tags.tourism === 'motel' || tags.tourism === 'guest_house') return 'hotel';
  if (tags.historic) return 'landmark';
  if (tags.natural === 'waterfall' || tags.waterfall === 'yes') return 'waterfall';
  if (tags.leisure === 'park' || tags.leisure === 'nature_reserve') return 'park';
  if (tags.amenity === 'restaurant') return 'restaurant';
  if (tags.amenity === 'cafe' || tags.amenity === 'fast_food') return 'cafe';
  if (tags.amenity === 'fuel') return 'gas';
  if (tags.shop) return 'shopping';
  if (tags.leisure === 'amusement_arcade' || tags.amenity === 'cinema') return 'entertainment';

  return null;
}

/**
 * Calculate popularity score from OSM tags (0-100)
 * Higher scores for well-documented POIs with more metadata
 */
function calculatePopularityScore(tags: Record<string, string>): number {
  let score = 50; // Base score

  // Boost for important tourism tags
  if (tags.tourism === 'attraction') score += 20;
  if (tags.heritage) score += 15;
  if (tags.wikipedia) score += 10;

  // Boost for rich metadata
  if (tags.website) score += 5;
  if (tags.phone) score += 5;
  if (tags.opening_hours) score += 5;
  if (tags.description) score += 5;

  // Boost for ratings
  if (tags.stars) score += 10;

  return Math.min(score, 100);
}

/**
 * Get relevant categories based on user preferences
 * If no preferences selected, return a balanced default set
 */
function getRelevantCategories(tripPreferences: TripPreference[]): POISuggestionCategory[] {
  if (tripPreferences.length === 0) {
    // Default: balanced mix
    return ['viewpoint', 'attraction', 'restaurant', 'park'];
  }

  // Combine categories from selected preferences
  const categories = new Set<POISuggestionCategory>();
  tripPreferences.forEach(pref => {
    PREFERENCE_CATEGORY_MAP[pref].forEach(cat => categories.add(cat));
  });

  // Always include discovery-friendly categories
  categories.add('viewpoint');
  categories.add('landmark');
  categories.add('waterfall');

  return Array.from(categories);
}

/**
 * Main function: Fetch POI suggestions for a route
 */
export async function fetchPOISuggestions(
  routeGeometry: [number, number][],
  origin: Location,
  destination: Location,
  tripPreferences: TripPreference[]
): Promise<POISuggestionGroup> {
  const startTime = performance.now();

  // Determine relevant categories from user preferences
  const categories = getRelevantCategories(tripPreferences);

  // Scale corridor width to trip distance (longer trips = wider scan)
  const routeDistanceKm = estimateRouteDistanceKm(routeGeometry);
  const corridorWidth = routeDistanceKm > 1000 ? 40000
    : routeDistanceKm > 500 ? 25000
    : CORRIDOR_WIDTHS.worthIt;

  // Fetch corridor POIs (along the way)
  const corridorQuery = buildCorridorQuery(routeGeometry, categories, corridorWidth);
  const corridorElements = await executeOverpassQuery(corridorQuery);

  // Fetch destination POIs
  const destinationQuery = buildDestinationQuery(destination, categories, DESTINATION_RADIUS);
  const destinationElements = await executeOverpassQuery(destinationQuery);

  // Exclusion radius: corridor POIs within this distance of origin/destination
  // are not "along the way" discoveries. Scale with trip length.
  const exclusionKm = Math.max(50, routeDistanceKm * 0.1);

  // Convert to POISuggestion objects
  const allCorridorPOIs = corridorElements
    .map(el => overpassElementToPOI(el))
    .filter((poi): poi is POISuggestion => poi !== null)
    .map(poi => ({ ...poi, bucket: 'along-way' as const }));

  // Polyline proximity filter: the bounding box query is very coarse, so we
  // post-filter to only keep POIs that are actually near the route polyline.
  // This prevents a diagonal route (e.g. Winnipeg→Thunder Bay) from returning
  // POIs that are inside the bbox but far from the actual road.
  const corridorKm = corridorWidth / 1000;
  const polylineFilteredPOIs = allCorridorPOIs.filter(poi => {
    return isNearPolyline(poi.lat, poi.lng, routeGeometry, corridorKm);
  });

  // Filter out corridor POIs that are near origin or destination
  const alongWayPOIs = polylineFilteredPOIs.filter(poi => {
    const distToDest = haversineDistanceSimple(poi.lat, poi.lng, destination.lat, destination.lng);
    const distToOrigin = haversineDistanceSimple(poi.lat, poi.lng, origin.lat, origin.lng);
    return distToDest > exclusionKm && distToOrigin > exclusionKm;
  });

  const destinationPOIs = destinationElements
    .map(el => overpassElementToPOI(el))
    .filter((poi): poi is POISuggestion => poi !== null)
    .map(poi => ({ ...poi, bucket: 'destination' as const }));

  const endTime = performance.now();

  return {
    alongWay: alongWayPOIs, // Filtered: excludes destination-area POIs
    atDestination: destinationPOIs, // Dedicated destination search
    totalFound: alongWayPOIs.length + destinationPOIs.length,
    queryDurationMs: endTime - startTime,
  };
}

// ==================== OVERPASS API TYPES ====================

interface OverpassResponse {
  elements: OverpassElement[];
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
}
