import type { POISuggestion, POISuggestionGroup, Location, TripPreference, TripSummary } from '../../types';
import type { OverpassElement } from './types';
import { getRelevantCategories, overpassElementToPOI, deduplicatePOIs } from './poi-converter';
import { estimateRouteDistanceKm, sampleRouteByKm, haversineDistanceSimple } from './geo';
import { buildBucketAroundQuery, buildParkRelationQuery, buildDestinationQuery } from './query-builder';
import { executeOverpassQuery, delay } from './overpass';
import { INTER_QUERY_DELAY, INTRA_FETCH_DELAY, DESTINATION_RADIUS, INFERENCE_CATEGORIES } from './config';
import { fetchWeather } from '../weather';
import type { WeatherData } from '../../types';

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
 * If the corridor query fails (429/timeout) partialResults is set to true.
 */
export async function fetchPOISuggestions(
  routeGeometry: [number, number][],
  origin: Location,
  destination: Location,
  tripPreferences: TripPreference[],
  segments: TripSummary['segments'],
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

  // ── Query 4: Weather (batch fetch for sample points + destination) ──
  // We fetch weather for the corridor sample points and the destination center.
  // This allows the ranking engine to be contextual without per-POI async calls.
  const weatherMap = new Map<string, WeatherData>();
  const weatherTasks = [
    // Destination weather
    (async () => {
      const w = await fetchWeather(destination.lat!, destination.lng!, segments[segments.length - 1]?.arrivalTime?.split('T')[0]);
      if (w) weatherMap.set('destination', w);
    })(),
    // Sample point weather (corridor)
    ...samplePoints.map(async (pt, idx) => {
      // Estimate which segment this point belongs to for time-accurate weather
      const progress = idx / samplePoints.length;
      const segIdx = Math.floor(progress * segments.length);
      const date = segments[Math.min(segIdx, segments.length - 1)]?.arrivalTime?.split('T')[0];
      const w = await fetchWeather(pt[0], pt[1], date);
      if (w) weatherMap.set(`sample-${idx}`, w);
    }),
  ];

  await Promise.allSettled(weatherTasks);

  // Attach weather to along-way POIs (nearest sample point)
  const alongWayWithWeather = alongWayPOIs.map(poi => {
    let bestIdx = 0;
    let minDist = Infinity;
    samplePoints.forEach((pt, idx) => {
      const d = haversineDistanceSimple(poi.lat, poi.lng, pt[0], pt[1]);
      if (d < minDist) {
        minDist = d;
        bestIdx = idx;
      }
    });
    return { ...poi, weather: weatherMap.get(`sample-${bestIdx}`) };
  });

  // Attach weather to destination POIs
  const destinationWithWeather = destinationPOIs.map(poi => ({
    ...poi,
    weather: weatherMap.get('destination'),
  }));

  const endTime = performance.now();

  const result: POISuggestionGroup = {
    alongWay: alongWayWithWeather,
    atDestination: destinationWithWeather,
    totalFound: alongWayPOIs.length + destinationPOIs.length,
    queryDurationMs: endTime - startTime,
    partialResults: partialResults || undefined,
  };

  return result;
}
