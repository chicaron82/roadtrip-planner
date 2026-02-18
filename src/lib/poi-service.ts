import type { POISuggestion, POISuggestionCategory, POISuggestionGroup, Location, TripPreference } from '../types';

// Overpass API endpoint
const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

// Destination search radius (50km around destination city center)
const DESTINATION_RADIUS = 50000;

// ==================== ROUTE SAMPLING CONFIG ====================

/** Corridor radius (meters) by category type — scenic searches wider, utilitarian tighter */
const CATEGORY_RADIUS: Record<POISuggestionCategory, number> = {
  viewpoint: 15000,
  park: 15000,
  waterfall: 15000,
  landmark: 15000,
  attraction: 10000,
  museum: 10000,
  entertainment: 10000,
  restaurant: 5000,
  cafe: 5000,
  gas: 5000,
  hotel: 5000,
  shopping: 5000,
};

/** How many sample points to group into a single Overpass call */
const SAMPLES_PER_BATCH = 4;

/** Max parallel Overpass requests for corridor sampling */
const CONCURRENCY_LIMIT = 2;

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

// ==================== ROUTE SAMPLING PIPELINE ====================

type LatLng = { lat: number; lng: number };

/**
 * Sample points along a polyline at fixed distance intervals.
 * Uses distance-traveled (not array index) so spacing is consistent
 * regardless of polyline density.
 *
 * Dynamic step size:
 *   < 500 km  → every 30 km
 *   500–1500  → every 60 km
 *   1500+     → every 100 km
 *
 * Always includes origin and destination.
 */
export function sampleRouteByKm(
  points: [number, number][],
  routeDistanceKm: number,
  maxSamples = 30
): LatLng[] {
  if (points.length < 2) {
    return points.map(([lat, lng]) => ({ lat, lng }));
  }

  // Dynamic step based on route length
  const stepKm = routeDistanceKm < 500 ? 30
    : routeDistanceKm < 1500 ? 60
    : 100;

  const samples: LatLng[] = [{ lat: points[0][0], lng: points[0][1] }];
  let sinceLast = 0;

  for (let i = 1; i < points.length; i++) {
    const [lat1, lng1] = points[i - 1];
    const [lat2, lng2] = points[i];
    const segKm = haversineDistanceSimple(lat1, lng1, lat2, lng2);

    sinceLast += segKm;
    if (sinceLast >= stepKm) {
      samples.push({ lat: lat2, lng: lng2 });
      sinceLast = 0;
      if (samples.length >= maxSamples) break;
    }
  }

  // Always include destination
  const last = points[points.length - 1];
  const lastSample = samples[samples.length - 1];
  if (haversineDistanceSimple(lastSample.lat, lastSample.lng, last[0], last[1]) > 1) {
    samples.push({ lat: last[0], lng: last[1] });
  }

  return samples;
}

/**
 * Group sample points into batches for fewer Overpass API calls.
 * Each batch produces one combined `around:` union query.
 */
function batchSamplePoints(samples: LatLng[], batchSize: number): LatLng[][] {
  const batches: LatLng[][] = [];
  for (let i = 0; i < samples.length; i += batchSize) {
    batches.push(samples.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Build an Overpass query for a batch of sample points.
 * Uses `around:R,lat,lng` per point × per category, all in one union.
 * Category-specific radius: scenic gets wider corridor, food gets tighter.
 */
function buildSampledQuery(
  sampleBatch: LatLng[],
  categories: POISuggestionCategory[]
): string {
  const lines: string[] = [];

  for (const cat of categories) {
    const tag = CATEGORY_TAG_QUERIES[cat];
    const radiusM = CATEGORY_RADIUS[cat];

    for (const pt of sampleBatch) {
      const around = `around:${radiusM},${pt.lat.toFixed(5)},${pt.lng.toFixed(5)}`;
      lines.push(`      node${tag}(${around});`);
      lines.push(`      way${tag}(${around});`);
    }
  }

  return `
    [out:json][timeout:30][maxsize:5242880];
    (
${lines.join('\n')}
    );
    out center;
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
 * Overlapping sample circles will return the same POI multiple times.
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
 * Uses route-sampling with Overpass `around:` queries instead of a single
 * bounding-box. This hugs the actual road geometry, producing far better
 * results on diagonal / long-haul routes (e.g. Winnipeg → Thunder Bay).
 *
 * Pipeline:
 *  1. Sample the polyline every N km (dynamic by route length)
 *  2. Batch sample points (4 per Overpass call)
 *  3. Query with concurrency limit (2 parallel)
 *  4. De-duplicate overlapping results by OSM id
 *  5. Filter out origin/destination zone → along-way bucket
 *  6. Separate destination query as before
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

  // Route distance drives sampling density
  const routeDistanceKm = estimateRouteDistanceKm(routeGeometry);

  // ── Step 1: Sample the polyline ──
  const samples = sampleRouteByKm(routeGeometry, routeDistanceKm);

  // ── Step 2: Batch samples into groups for fewer API calls ──
  const batches = batchSamplePoints(samples, SAMPLES_PER_BATCH);

  // ── Step 3: Query Overpass with concurrency limit ──
  const batchResults = await mapWithConcurrency(
    batches,
    CONCURRENCY_LIMIT,
    async (batch) => {
      const query = buildSampledQuery(batch, categories);
      return executeOverpassQuery(query);
    }
  );

  // Flatten all elements from all batches
  const allCorridorElements = batchResults.flat();

  // ── Step 4: Convert + de-duplicate ──
  const allCorridorPOIs = allCorridorElements
    .map(el => overpassElementToPOI(el))
    .filter((poi): poi is POISuggestion => poi !== null)
    .map(poi => ({ ...poi, bucket: 'along-way' as const }));

  const dedupedCorridorPOIs = deduplicatePOIs(allCorridorPOIs);

  // ── Step 5: Strip origin/destination zone → along-way only ──
  // Keep exclusion tight so nearby gems aren't dropped
  const exclusionKm = Math.min(40, Math.max(25, routeDistanceKm * 0.04));

  const alongWayPOIs = dedupedCorridorPOIs.filter(poi => {
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
