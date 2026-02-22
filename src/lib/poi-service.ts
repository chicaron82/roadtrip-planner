import type { POISuggestion, POISuggestionCategory, POISuggestionGroup, Location, TripPreference } from '../types';

// Overpass API endpoint
const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

// Destination search radius (50km around destination city center)
const DESTINATION_RADIUS = 50000;

// Delay between sequential Overpass queries to avoid 429 (ms)
const INTER_QUERY_DELAY = 2500;

// Delay between corridor and park-relation queries when run sequentially
const INTRA_FETCH_DELAY = 1500;

// Max Overpass retries on 429 (rate limit)
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

// ==================== SESSION CACHE ====================
// Prevents hammering Overpass with repeat queries for the same route.
// Keyed on a lightweight hash of the route geometry + preferences.

const POI_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const POI_CACHE_MAX_ENTRIES = 10;

interface POICacheEntry {
  result: POISuggestionGroup;
  expiresAt: number;
}

const POI_SESSION_CACHE = new Map<string, POICacheEntry>();

/**
 * In-flight deduplication — if two fetchPOISuggestions calls arrive for the
 * same cache key before the first resolves, share the same promise instead
 * of firing a second set of Overpass queries.
 */
const POI_IN_FLIGHT = new Map<string, Promise<POISuggestionGroup>>();

/**
 * Lightweight route geometry hash: round coords to 2dp (~1km precision),
 * sample every Nth point for long routes, join with preferences.
 */
function hashRouteKey(
  geometry: [number, number][],
  destination: Location,
  preferences: TripPreference[]
): string {
  // Sample at most 20 points evenly
  const step = Math.max(1, Math.floor(geometry.length / 20));
  const sampled = geometry.filter((_, i) => i % step === 0);
  const coordStr = sampled.map(([lat, lng]) => `${lat.toFixed(2)},${lng.toFixed(2)}`).join('|');
  const destStr = `${destination.lat?.toFixed(2)},${destination.lng?.toFixed(2)}`;
  const prefStr = [...preferences].sort().join(',');
  return `${coordStr}::${destStr}::${prefStr}`;
}

function getCachedPOIs(key: string): POISuggestionGroup | null {
  const entry = POI_SESSION_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    POI_SESSION_CACHE.delete(key);
    return null;
  }
  return entry.result;
}

function setCachedPOIs(key: string, result: POISuggestionGroup): void {
  // Evict oldest entry if at capacity
  if (POI_SESSION_CACHE.size >= POI_CACHE_MAX_ENTRIES) {
    const oldest = POI_SESSION_CACHE.keys().next().value;
    if (oldest) POI_SESSION_CACHE.delete(oldest);
  }
  POI_SESSION_CACHE.set(key, { result, expiresAt: Date.now() + POI_CACHE_TTL_MS });
}

/**
 * OSM tag mapping for POI categories.
 * Each category maps to one or more Overpass QL tag filters.
 * Multiple filters are OR'd together in the union query.
 *
 * Park uses two filters: leisure=nature_reserve catches smaller reserves,
 * boundary=protected_area catches Canadian/US provincial & national parks
 * (which are stored as relations in OSM, not nodes/ways with leisure tags).
 */
const CATEGORY_TAG_QUERIES: Record<POISuggestionCategory, string[]> = {
  viewpoint:     ['["tourism"="viewpoint"]'],
  attraction:    ['["tourism"~"attraction|theme_park|zoo|camp_site|picnic_site|information"]'],
  museum:        ['["tourism"~"museum|gallery|artwork"]'],
  park:          ['["leisure"~"park|nature_reserve"]', '["boundary"="protected_area"]'],
  landmark:      ['["historic"~"memorial|monument|castle|ruins|archaeological_site|heritage"]'],
  waterfall:     ['["natural"~"waterfall|cave_entrance|beach|arch|cliff"]'],
  restaurant:    ['["amenity"="restaurant"]'],
  cafe:          ['["amenity"="cafe"]'],
  gas:           ['["amenity"="fuel"]'],
  hotel:         ['["tourism"~"hotel|motel|guest_house"]'],
  shopping:      ['["shop"~"supermarket|mall|department_store"]'],
  entertainment: ['["leisure"~"amusement_arcade|bowling_alley|water_park"]'],
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
 * Queries node + way only — relation queries over large bboxes are too expensive
 * and timeout silently. Provincial parks (relations) are handled separately
 * by buildParkRelationQuery() using targeted around: sample points.
 */
function buildCorridorQuery(bbox: string, categories: POISuggestionCategory[]): string {
  const lines: string[] = [];
  for (const cat of categories) {
    for (const tag of CATEGORY_TAG_QUERIES[cat]) {
      lines.push(`      node${tag}(${bbox});`);
      lines.push(`      way${tag}(${bbox});`);
    }
  }

  return `
    [out:json][timeout:45][maxsize:5242880];
    (
${lines.join('\n')}
    );
    out center;
  `.trim();
}

/**
 * Sample the route polyline at regular km intervals.
 * Returns at most maxSamples evenly-spaced coordinate pairs.
 */
function sampleRouteByKm(
  geometry: [number, number][],
  stepKm: number,
  maxSamples: number = 15
): [number, number][] {
  if (geometry.length === 0) return [];
  const samples: [number, number][] = [geometry[0]];
  let accumulated = 0;
  for (let i = 1; i < geometry.length; i++) {
    const [lat1, lng1] = geometry[i - 1];
    const [lat2, lng2] = geometry[i];
    accumulated += haversineDistanceSimple(lat1, lng1, lat2, lng2);
    if (accumulated >= stepKm) {
      samples.push(geometry[i]);
      accumulated = 0;
      if (samples.length >= maxSamples) break;
    }
  }
  return samples;
}

/**
 * Build a targeted Overpass query for named boundary=protected_area relations
 * at multiple sample points along the route using around: queries.
 *
 * Why relations, why around: ?
 * Canadian/US provincial and national parks are stored as OSM relations tagged
 * boundary=protected_area. Querying relations over a large bbox times out.
 * Small around: circles at sample points are fast and hit the actual corridor.
 * The ["name"] filter ensures we only return named parks worth discovering.
 */
function buildParkRelationQuery(samplePoints: [number, number][], radiusM: number = 20000): string {
  const lines = samplePoints.map(
    ([lat, lng]) => `      relation["boundary"="protected_area"]["name"](around:${radiusM},${lat},${lng});`
  );
  return `
    [out:json][timeout:30];
    (
${lines.join('\n')}
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
 * Build Overpass QL query for destination area search.
 * Queries node + way + relation for each tag filter — relations catch
 * provincial/national parks near the destination (e.g. Sleeping Giant PP
 * near Thunder Bay is a boundary=protected_area relation).
 */
function buildDestinationQuery(
  destination: Location,
  categories: POISuggestionCategory[],
  radius: number
): string {
  const lines: string[] = [];
  for (const cat of categories) {
    for (const tag of CATEGORY_TAG_QUERIES[cat]) {
      lines.push(`      node${tag}(around:${radius},${destination.lat},${destination.lng});`);
      lines.push(`      way${tag}(around:${radius},${destination.lat},${destination.lng});`);
      lines.push(`      relation${tag}(around:${radius},${destination.lat},${destination.lng});`);
    }
  }

  return `
    [out:json][timeout:45];
    (
${lines.join('\n')}
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
        // Exponential backoff with ±20% jitter to spread retries
        const base = RETRY_DELAY_MS * Math.pow(2, attempt);
        const jitter = base * 0.2 * (Math.random() - 0.5);
        const wait = Math.round(base + jitter);
        console.warn(`Overpass 429 rate limit — retrying in ${wait}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await delay(wait);
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
 * Makes THREE Overpass API calls:
 *  1. Corridor query — node+way for all categories, single union bbox
 *  2. Park relation query — sequential (delayed), targeted around: sample
 *     points for boundary=protected_area relations (provincial/national parks)
 *  3. Destination query — all categories in one around: query
 *
 * All three run sequentially with delays to stay friendly to Overpass rate limits.
 * Concurrent calls for the same route key share a single in-flight promise.
 */
export async function fetchPOISuggestions(
  routeGeometry: [number, number][],
  origin: Location,
  destination: Location,
  tripPreferences: TripPreference[]
): Promise<POISuggestionGroup> {
  // ── Cache check — skip Overpass entirely if we've fetched this route recently ──
  const cacheKey = hashRouteKey(routeGeometry, destination, tripPreferences);
  const cached = getCachedPOIs(cacheKey);
  if (cached) {
    console.info(`POI cache hit — returning ${cached.totalFound} cached results`);
    return cached;
  }

  // ── In-flight dedup — share a single promise if the same key is already fetching ──
  const inFlight = POI_IN_FLIGHT.get(cacheKey);
  if (inFlight) {
    console.info('POI fetch already in flight for this route — sharing promise');
    return inFlight;
  }

  const fetchPromise = _doFetchPOISuggestions(cacheKey, routeGeometry, origin, destination, tripPreferences);
  POI_IN_FLIGHT.set(cacheKey, fetchPromise);
  fetchPromise.finally(() => POI_IN_FLIGHT.delete(cacheKey));
  return fetchPromise;
}

/** Internal implementation — called only once per unique in-flight key. */
async function _doFetchPOISuggestions(
  cacheKey: string,
  routeGeometry: [number, number][],
  origin: Location,
  destination: Location,
  tripPreferences: TripPreference[]
): Promise<POISuggestionGroup> {
  const startTime = performance.now();

  const categories = getRelevantCategories(tripPreferences);
  const routeDistanceKm = estimateRouteDistanceKm(routeGeometry);

  // ── Queries 1 + 2: Corridor (node/way bbox) + Park relations (sampled around:) ──
  // Run sequentially with a short pause to avoid simultaneous 429s.
  const bbox = computeRouteBbox(routeGeometry, 15);
  const corridorQuery = buildCorridorQuery(bbox, categories);

  // Sample one point every ~60km (cap at 15), used for the park relation query.
  const stepKm = Math.max(40, routeDistanceKm / 12);
  const samplePoints = sampleRouteByKm(routeGeometry, stepKm);

  const corridorElements = await executeOverpassQuery(corridorQuery);

  let parkRelationElements: OverpassElement[] = [];
  if (categories.includes('park') && samplePoints.length > 0) {
    await delay(INTRA_FETCH_DELAY);
    parkRelationElements = await executeOverpassQuery(buildParkRelationQuery(samplePoints));
  }

  const toPOI = (bucket: 'along-way') => (el: OverpassElement): POISuggestion | null => {
    const poi = overpassElementToPOI(el);
    return poi ? { ...poi, bucket } : null;
  };

  const allCorridorPOIs = [
    ...corridorElements.map(toPOI('along-way')),
    ...parkRelationElements.map(toPOI('along-way')),
  ].filter((poi): poi is POISuggestion => poi !== null);

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

  // ── Query 3: Destination (all categories, one around: query) ──
  const destinationQuery = buildDestinationQuery(destination, categories, DESTINATION_RADIUS);
  const destinationElements = await executeOverpassQuery(destinationQuery);

  const destinationPOIs = destinationElements
    .map(el => overpassElementToPOI(el))
    .filter((poi): poi is POISuggestion => poi !== null)
    .map(poi => ({ ...poi, bucket: 'destination' as const }));

  const endTime = performance.now();

  const result: POISuggestionGroup = {
    alongWay: alongWayPOIs,
    atDestination: destinationPOIs,
    totalFound: alongWayPOIs.length + destinationPOIs.length,
    queryDurationMs: endTime - startTime,
  };

  // Cache the result so repeat recalculations skip Overpass
  setCachedPOIs(cacheKey, result);

  return result;
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
