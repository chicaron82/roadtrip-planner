import type { POISuggestion, POISuggestionGroup, Location, TripPreference } from '../../types';
import type { OverpassElement } from './types';
import { hashRouteKey, getCachedPOIs, setCachedPOIs, POI_IN_FLIGHT } from './cache';
import { getRelevantCategories, overpassElementToPOI, deduplicatePOIs } from './poi-converter';
import { estimateRouteDistanceKm, sampleRouteByKm, haversineDistanceSimple } from './geo';
import { buildBucketAroundQuery, buildParkRelationQuery, buildDestinationQuery } from './query-builder';
import { executeOverpassQuery, delay } from './overpass';
import { INTER_QUERY_DELAY, INTRA_FETCH_DELAY, DESTINATION_RADIUS, INFERENCE_CATEGORIES } from './config';

/**
 * Main function: Fetch POI suggestions for a route
 *
 * Makes THREE Overpass API calls:
 *  1. Corridor query — node+way for all categories, bucketed around: circles at
 *     regularly-spaced sample points (replaces the single bbox approach that filled
 *     the 5 MB cap with dense city data instead of actual corridor content)
 *  2. Park relation query — sequential (delayed), targeted around: sample
 *     points for boundary=protected_area relations (provincial/national parks)
 *  3. Destination query — all categories in one around: query
 *
 * All three run sequentially with delays to stay friendly to Overpass rate limits.
 * Concurrent calls for the same route key share a single in-flight promise.
 * If the corridor query fails (429/timeout) partialResults is set to true.
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

  // No categories → no POI preferences set → skip Overpass entirely.
  if (categories.length === 0) {
    return { alongWay: [], atDestination: [], totalFound: 0, queryDurationMs: 0 };
  }

  const routeDistanceKm = estimateRouteDistanceKm(routeGeometry);

  // Always include inference categories so usePOI can skip the 2nd double-fetch
  const corridorCategories = [...new Set([...categories, ...INFERENCE_CATEGORIES])];

  // ── Sample points: shared by corridor bucket query + park relation query ──
  // One point every N km so adjacent around: circles overlap by ~½ their diameter.
  // Formula: radius = max(25km, (stepKm/2 + 5km)) guarantees full corridor coverage.
  const stepKm = Math.max(40, routeDistanceKm / 20);
  const samplePoints = sampleRouteByKm(routeGeometry, stepKm, 20);
  const radiusM = Math.max(25000, Math.ceil(stepKm / 2 + 5) * 1000);

  // ── Queries 1 + 2: Corridor (bucketed around:) + Park relations (around:) ──
  // Run sequentially with a short pause to avoid simultaneous 429s.
  // Bucketed around: prevents the 5 MB cap from being filled by dense-city bbox results.
  const corridorQuery = buildBucketAroundQuery(samplePoints, radiusM, corridorCategories);

  let corridorElements: OverpassElement[] = [];
  let partialResults = false;
  try {
    corridorElements = await executeOverpassQuery(corridorQuery);
  } catch (err) {
    // 429 / timeout: log and continue — we'll flag results as partial
    console.warn('POI corridor query failed — partial results will be returned:', err);
    partialResults = true;
  }

  let parkRelationElements: OverpassElement[] = [];
  if (categories.includes('park') && samplePoints.length > 0) {
    await delay(INTRA_FETCH_DELAY);
    try {
      parkRelationElements = await executeOverpassQuery(buildParkRelationQuery(samplePoints));
    } catch (err) {
      console.warn('Park relation query failed:', err);
      partialResults = true;
    }
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
  let destinationElements: OverpassElement[] = [];
  try {
    destinationElements = await executeOverpassQuery(destinationQuery);
  } catch (err) {
    console.warn('Destination POI query failed:', err);
    partialResults = true;
  }

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
    partialResults: partialResults || undefined,
  };

  // Cache the result so repeat recalculations skip Overpass
  setCachedPOIs(cacheKey, result);

  return result;
}
