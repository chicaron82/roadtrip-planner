import type { POISuggestion, POISuggestionCategory, POISuggestionGroup, Location, TripPreference } from '../types';

// Overpass API endpoint
const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

// Destination search radius (50km around destination city center)
const DESTINATION_RADIUS = 50000;

// Max results per category for corridor search (keeps queries fast)
const MAX_PER_CATEGORY = 40;

// Max parallel Overpass requests (don't overwhelm the API)
const CONCURRENCY_LIMIT = 3;

/**
 * OSM tag mapping for POI categories
 * Maps our POISuggestionCategory to Overpass QL queries
 */
const CATEGORY_TAG_QUERIES: Record<POISuggestionCategory, string> = {
  viewpoint: '["tourism"="viewpoint"]',
  attraction: '["tourism"~"attraction|theme_park|zoo|camp_site|picnic_site|information"]',
  museum: '["tourism"~"museum|gallery|artwork"]',
  park: '["leisure"~"park|nature_reserve"]',
  landmark: '["historic"~"memorial|monument|castle|ruins|archaeological_site|heritage"]',
  waterfall: '["natural"~"waterfall|cave_entrance|beach|arch|cliff"]',
  restaurant: '["amenity"="restaurant"]',
  cafe: '["amenity"="cafe"]',
  gas: '["amenity"="fuel"]',
  hotel: '["tourism"~"hotel|motel|guest_house"]',
  shopping: '["shop"~"supermarket|mall|department_store"]',
  entertainment: '["leisure"~"amusement_arcade|bowling_alley|water_park"]',
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

// ==================== CORRIDOR QUERY (per-category bbox) ====================

/**
 * Compute a bounding box from route geometry with a buffer in km.
 * Returns "south,west,north,east" Overpass bbox string.
 */
function computeRouteBbox(routeGeometry: [number, number][], bufferKm: number): string {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const [lat, lng] of routeGeometry) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  const buffer = bufferKm / 111; // ~1 degree ≈ 111km
  return `${minLat - buffer},${minLng - buffer},${maxLat + buffer},${maxLng + buffer}`;
}

/**
 * Build a single-category Overpass query within a bbox.
 * Same proven pattern used by the map marker toggles (poi.ts).
 * `out center N` caps results to prevent massive responses.
 */
function buildCategoryQuery(bbox: string, category: POISuggestionCategory): string {
  const tag = CATEGORY_TAG_QUERIES[category];
  return `
    [out:json][timeout:25][maxsize:2097152];
    (
      node${tag}(${bbox});
      way${tag}(${bbox});
    );
    out center ${MAX_PER_CATEGORY};
  `.trim();
}

/**
 * Run async tasks with a concurrency limit.
 * Prevents overwhelming the Overpass API with too many parallel requests.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIdx = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await fn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * De-duplicate POIs by OSM type + id.
 * Multiple category queries may return the same POI.
 */
function deduplicatePOIs(pois: POISuggestion[]): POISuggestion[] {
  const seen = new Set<string>();
  return pois.filter(poi => {
    const key = `${poi.osmType}-${poi.osmId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

  // Extract name — skip unnamed POIs (they're useless as discoveries)
  const name = element.tags?.name || element.tags?.['name:en'];
  if (!name) return null;

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
  if (tags.tourism === 'camp_site' || tags.tourism === 'picnic_site') return 'attraction';
  if (tags.tourism === 'information') return 'attraction'; // Visitor centers
  if (tags.tourism === 'artwork') return 'landmark';
  if (tags.tourism === 'hotel' || tags.tourism === 'motel' || tags.tourism === 'guest_house') return 'hotel';
  if (tags.historic) return 'landmark';
  if (tags.natural === 'waterfall' || tags.waterfall === 'yes') return 'waterfall';
  if (tags.natural === 'beach' || tags.natural === 'cave_entrance' || tags.natural === 'arch' || tags.natural === 'cliff') return 'waterfall'; // Natural wonders bucket
  if (tags.leisure === 'park' || tags.leisure === 'nature_reserve') return 'park';
  if (tags.boundary === 'national_park' || tags.boundary === 'protected_area') return 'park';
  if (tags.amenity === 'restaurant') return 'restaurant';
  if (tags.amenity === 'cafe') return 'cafe';
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
    // Default: discovery-focused mix (skip food/gas — not interesting discoveries)
    return ['viewpoint', 'attraction', 'landmark', 'park', 'waterfall', 'museum'];
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
 *
 * Uses the same proven per-category bbox query pattern as the map marker
 * toggles (poi.ts → searchPOIsAlongRoute). Each category gets its own small,
 * fast Overpass query with capped results. This is the pattern the user
 * confirmed works — sights, gas, food, hotels all show up scattered along
 * the route when toggled on the map.
 *
 * Pipeline:
 *  1. Compute bbox from route geometry (15km buffer)
 *  2. Query each discovery category separately (capped at 40 results each)
 *  3. Run queries with concurrency limit (3 parallel)
 *  4. Convert to POISuggestion[], de-duplicate
 *  5. Filter out origin/destination zone → along-way bucket
 *  6. Separate destination query (around: on destination point)
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

  const routeDistanceKm = estimateRouteDistanceKm(routeGeometry);

  // ── Step 1: Compute bbox with 15km buffer (same as map marker toggles) ──
  const bbox = computeRouteBbox(routeGeometry, 15);

  // ── Step 2-3: Query each category separately, with concurrency limit ──
  const categoryResults = await mapWithConcurrency(
    categories,
    CONCURRENCY_LIMIT,
    async (category) => {
      const query = buildCategoryQuery(bbox, category);
      return executeOverpassQuery(query);
    }
  );

  // ── Step 4: Flatten, convert, de-duplicate ──
  const allElements = categoryResults.flat();

  const allCorridorPOIs = allElements
    .map(el => overpassElementToPOI(el))
    .filter((poi): poi is POISuggestion => poi !== null)
    .map(poi => ({ ...poi, bucket: 'along-way' as const }));

  const dedupedPOIs = deduplicatePOIs(allCorridorPOIs);

  // ── Step 5: Strip origin/destination zone → along-way only ──
  const exclusionKm = Math.min(40, Math.max(25, routeDistanceKm * 0.04));

  const alongWayPOIs = dedupedPOIs.filter(poi => {
    const distToDest = haversineDistanceSimple(poi.lat, poi.lng, destination.lat!, destination.lng!);
    const distToOrigin = haversineDistanceSimple(poi.lat, poi.lng, origin.lat!, origin.lng!);
    return distToDest > exclusionKm && distToOrigin > exclusionKm;
  });

  // ── Step 6: Destination query (unchanged — around: on destination point) ──
  const destinationQuery = buildDestinationQuery(destination, categories, DESTINATION_RADIUS);
  const destinationElements = await executeOverpassQuery(destinationQuery);

  const destinationPOIs = destinationElements
    .map(el => overpassElementToPOI(el))
    .filter((poi): poi is POISuggestion => poi !== null)
    .map(poi => ({ ...poi, bucket: 'destination' as const }));

  const endTime = performance.now();

  return {
    alongWay: alongWayPOIs,
    atDestination: destinationPOIs,
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
