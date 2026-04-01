import type { StrategicFuelStop } from './calculations';
import { executeOverpassQuery } from './poi-service/overpass';
import type { OverpassElement } from './poi-service/types';
import { haversineDistance } from './geo-utils';
import { getActivePOIProvider } from './providers/provider-config';
import { searchNearby, GOOGLE_POI_TYPES } from './providers/google/google-places-nearby';
import { recordProviderEvent } from './providers/provider-telemetry';

/** Search radius in metres — if no station within this distance, mark isRemote. */
const SNAP_RADIUS_M = 3000;
const SNAP_RADIUS_KM = SNAP_RADIUS_M / 1000;

const snappedStopCache = new Map<string, StrategicFuelStop>();

function getCacheKey(lat: number, lng: number): string {
  // Round to ~100m precision (3 decimal places) to handle slight float fuzziness
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

/**
 * Fetch fuel stations near a list of stops. Tries Google first, falls back to Overpass.
 * Returns Overpass-shaped elements so the snap logic can stay unchanged.
 */
async function fetchFuelStations(stops: StrategicFuelStop[]): Promise<OverpassElement[]> {
  const provider = getActivePOIProvider();
  const start = performance.now();

  if (provider === 'google') {
    try {
      const allPlaces = await Promise.all(
        stops.map(s => searchNearby(s.lat, s.lng, SNAP_RADIUS_M, GOOGLE_POI_TYPES.gas, 5)),
      );
      const elements: OverpassElement[] = allPlaces.flat().map(p => ({
        type: 'node' as const,
        id: parseInt(p.id.replace(/\D/g, '').slice(0, 10)) || Math.random() * 1e9,
        lat: p.lat,
        lon: p.lng,
        tags: { name: p.name, 'addr:city': p.address },
      }));
      recordProviderEvent('poi', 'google', 'success', performance.now() - start);
      return elements;
    } catch {
      recordProviderEvent('poi', 'google', 'failure', performance.now() - start);
      // fall through to Overpass
    }
  }

  // Overpass fallback — batched union query
  const aroundFilters = stops
    .map(s => `  node(around:${SNAP_RADIUS_M},${s.lat},${s.lng})[amenity=fuel];`)
    .join('\n');

  const query = `[out:json][timeout:25];\n(\n${aroundFilters}\n);\nout body;`;
  const elements = await executeOverpassQuery(query);
  recordProviderEvent('poi', 'overpass', elements.length > 0 ? 'success' : 'failure', performance.now() - start);
  return elements;
}

/**
 * Snaps each strategic fuel stop to the nearest real OSM gas station.
 *
 * Fires a single batched Overpass query covering all stop locations with
 * `around:` radius filters, then matches each stop to its closest result.
 *
 * Stops with no real station within SNAP_RADIUS_M are flagged `isRemote: true`
 * so the UI can warn the user to verify fuel availability.
 *
 * The snapped lat/lng replaces the original geometry-interpolated position,
 * so fuel stop markers land on real roads and real towns.
 */
export async function snapFuelStopsToStations(
  stops: StrategicFuelStop[],
): Promise<StrategicFuelStop[]> {
  if (stops.length === 0) return stops;

  const result: StrategicFuelStop[] = new Array(stops.length);
  const uncachedIndices: number[] = [];
  const uncachedStops: StrategicFuelStop[] = [];

  // 1. Check Cache
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const key = getCacheKey(stop.lat, stop.lng);
    
    if (snappedStopCache.has(key)) {
      // Return cached snap, combining current stop metadata with cached location
      const cached = snappedStopCache.get(key)!;
      result[i] = { ...stop, ...cached };
    } else {
      uncachedIndices.push(i);
      uncachedStops.push(stop);
    }
  }

  // If everything was cached, return immediately
  if (uncachedStops.length === 0) {
    return result;
  }

  // 2. Fetch fuel stations near uncached stops
  const elements = await fetchFuelStations(uncachedStops);

  // 3. Process uncached results and populate cache
  uncachedStops.forEach((stop, idx) => {
    const originalIndex = uncachedIndices[idx];
    let bestDist = Infinity;
    let bestEl: (typeof elements)[number] | null = null;

    for (const el of elements) {
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (elLat === undefined || elLng === undefined) continue;

      const dist = haversineDistance(stop.lat, stop.lng, elLat, elLng);
      if (dist < bestDist) {
        bestDist = dist;
        bestEl = el;
      }
    }

    let snappedStop: StrategicFuelStop;

    if (!bestEl || bestDist > SNAP_RADIUS_KM) {
      // No station nearby — flag as remote but keep original geometry position
      snappedStop = { ...stop, isRemote: true };
    } else {
      const snappedLat = bestEl.lat ?? bestEl.center!.lat;
      const snappedLng = bestEl.lon ?? bestEl.center!.lon;

      const stationName = bestEl.tags?.name || bestEl.tags?.brand || undefined;
      const stationAddress = bestEl.tags?.['addr:city'] || bestEl.tags?.['addr:place'] || undefined;

      snappedStop = {
        ...stop,
        lat: snappedLat,
        lng: snappedLng,
        stationName,
        stationAddress,
        isRemote: false,
      };
    }

    // Save to cache
    const key = getCacheKey(stop.lat, stop.lng);
    snappedStopCache.set(key, snappedStop);

    result[originalIndex] = snappedStop;
  });

  return result;
}
