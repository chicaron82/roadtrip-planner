import type { StrategicFuelStop } from './calculations';
import { executeOverpassQuery } from './poi-service/overpass';
import { haversineDistance } from './poi-ranking';

/** Search radius in metres — if no station within this distance, mark isRemote. */
const SNAP_RADIUS_M = 3000;
const SNAP_RADIUS_KM = SNAP_RADIUS_M / 1000;

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

  // Build one union query — each stop contributes one `around:` node filter.
  // Overpass evaluates these as a union, returning all fuel nodes near any stop.
  const aroundFilters = stops
    .map(s => `  node(around:${SNAP_RADIUS_M},${s.lat},${s.lng})[amenity=fuel];`)
    .join('\n');

  const query = `[out:json][timeout:25];
(
${aroundFilters}
);
out body;`;

  const elements = await executeOverpassQuery(query);

  return stops.map(stop => {
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

    if (!bestEl || bestDist > SNAP_RADIUS_KM) {
      // No station nearby — flag as remote but keep original geometry position
      return { ...stop, isRemote: true };
    }

    const snappedLat = bestEl.lat ?? bestEl.center!.lat;
    const snappedLng = bestEl.lon ?? bestEl.center!.lon;

    const stationName =
      bestEl.tags?.name || bestEl.tags?.brand || undefined;
    const stationAddress =
      bestEl.tags?.['addr:city'] || bestEl.tags?.['addr:place'] || undefined;

    return {
      ...stop,
      lat: snappedLat,
      lng: snappedLng,
      stationName,
      stationAddress,
      isRemote: false,
    };
  });
}
