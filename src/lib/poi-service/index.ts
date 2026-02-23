import type { POISuggestion, POISuggestionGroup, Location, TripPreference } from '../../types';
import type { OverpassElement } from './types';
import { hashRouteKey, getCachedPOIs, setCachedPOIs, POI_IN_FLIGHT } from './cache';
import { getRelevantCategories, overpassElementToPOI, deduplicatePOIs } from './poi-converter';
import { estimateRouteDistanceKm, computeRouteBbox, sampleRouteByKm, haversineDistanceSimple } from './geo';
import { buildCorridorQuery, buildParkRelationQuery, buildDestinationQuery } from './query-builder';
import { executeOverpassQuery, delay } from './overpass';
import { INTER_QUERY_DELAY, INTRA_FETCH_DELAY, DESTINATION_RADIUS } from './config';

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

  // No categories → no POI preferences set → skip Overpass entirely.
  if (categories.length === 0) {
    return { alongWay: [], atDestination: [], totalFound: 0, queryDurationMs: 0 };
  }

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
