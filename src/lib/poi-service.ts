import type { POISuggestion, POISuggestionCategory, POISuggestionGroup, Location, TripPreference } from '../types';

// Overpass API endpoint
const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

// Destination search radius (50km around destination city center)
const DESTINATION_RADIUS = 50000;

// Delay between corridor and destination queries to avoid 429 (ms)
const INTER_QUERY_DELAY = 1500;

// Max Overpass retries on 429 (rate limit)
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

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

// ==================== CORRIDOR QUERY (single union bbox) ====================

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
 * Build a single Overpass union query for ALL discovery categories in one bbox.
 * Same pattern as buildDestinationQuery — all categories in one `(union);
 * out center;` call. This means ONE API call for the entire corridor instead
 * of one-per-category, avoiding 429 rate limits.
 */
function buildCorridorQuery(bbox: string, categories: POISuggestionCategory[]): string {
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
 * De-duplicate POIs by OSM type + id.
 * Multiple categories in a union may return overlapping results.
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

/** Simple delay helper */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
 * Execute Overpass API query with retry on 429 (rate limit).
 * Overpass public API has aggressive rate limiting — retries with
 * exponential backoff keep us friendly.
 */
async function executeOverpassQuery(query: string): Promise<OverpassElement[]> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(OVERPASS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (response.status === 429 && attempt < MAX_RETRIES) {
        console.warn(`Overpass 429 rate limit — retrying in ${RETRY_DELAY_MS * (attempt + 1)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await delay(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status}`);
      }

      const data: OverpassResponse = await response.json();
      return data.elements || [];
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        console.warn(`Overpass query failed, retrying... (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await delay(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      console.error('Overpass query failed after retries:', error);
      return [];
    }
  }
  return [];
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
 * Makes exactly TWO Overpass API calls:
 *  1. Corridor query — all discovery categories in one union bbox query
 *  2. Destination query — all categories in one around: query
 *
 * Separated by a delay to stay under Overpass rate limits.
 * Both queries use retry with backoff on 429 responses.
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

  // ── Query 1: Corridor (all categories, one union, one API call) ──
  const bbox = computeRouteBbox(routeGeometry, 15);
  const corridorQuery = buildCorridorQuery(bbox, categories);
  const corridorElements = await executeOverpassQuery(corridorQuery);

  const allCorridorPOIs = corridorElements
    .map(el => overpassElementToPOI(el))
    .filter((poi): poi is POISuggestion => poi !== null)
    .map(poi => ({ ...poi, bucket: 'along-way' as const }));

  const dedupedPOIs = deduplicatePOIs(allCorridorPOIs);

  // Strip origin/destination zone → along-way only
  const exclusionKm = Math.min(40, Math.max(25, routeDistanceKm * 0.04));

  const alongWayPOIs = dedupedPOIs.filter(poi => {
    const distToDest = haversineDistanceSimple(poi.lat, poi.lng, destination.lat!, destination.lng!);
    const distToOrigin = haversineDistanceSimple(poi.lat, poi.lng, origin.lat!, origin.lng!);
    return distToDest > exclusionKm && distToOrigin > exclusionKm;
  });

  // ── Breathing room between queries to avoid 429 ──
  await delay(INTER_QUERY_DELAY);

  // ── Query 2: Destination (all categories, one around: query) ──
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
