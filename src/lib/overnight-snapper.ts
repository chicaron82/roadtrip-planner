import type { TripDay } from '../types';
import { executeOverpassQuery } from './poi-service/overpass';
import { haversineDistance } from './poi-ranking';

/**
 * Search radius for finding the nearest real settlement.
 * 50 km is intentionally generous — towns on remote Canadian highways
 * (e.g. Highway 17 between Sudbury and Sault Ste. Marie) can be sparse,
 * and it's better to snap to a real town 40 km away than stay on the highway.
 */
const SNAP_RADIUS_M = 50_000;
const SNAP_RADIUS_KM = SNAP_RADIUS_M / 1000;

/**
 * Settlement type weights — a nearby village beats a distant city, but
 * size is a tie-breaker when two places are similarly close.
 *
 * Hamlets are excluded: they rarely have hotels or services, so snapping
 * an overnight to one would give the user a location with nowhere to stay.
 */
const PLACE_WEIGHT: Record<string, number> = {
  city: 4,
  town: 3,
  village: 2,
};

export interface SnappedOvernight {
  dayNumber: number;
  lat: number;
  lng: number;
  name: string;
}

/**
 * Snaps transit-split overnight locations to real OSM settlements.
 *
 * Transit-split locations (id='transit-split-*') are geometry-interpolated
 * points on the road — they land in forests, not in towns. This function
 * fires a single batched Overpass query covering all such overnights and
 * returns the nearest real settlement for each, scored by type and distance.
 *
 * Caller is responsible for applying the snapped coordinates back to
 * TripDay.overnight.location, the day's segments, and adjacent day routes.
 */
export async function snapOvernightsToTowns(
  days: TripDay[],
  signal: AbortSignal,
): Promise<SnappedOvernight[]> {
  const transitDays = days.filter(
    d => d.overnight?.location.id?.startsWith('transit-split-'),
  );
  if (transitDays.length === 0) return [];

  const aroundFilters = transitDays
    .map(d => {
      const { lat, lng } = d.overnight!.location;
      return `  node(around:${SNAP_RADIUS_M},${lat},${lng})[place~"^(city|town|village)$"];`;
    })
    .join('\n');

  const query = `[out:json][timeout:30];
(
${aroundFilters}
);
out body;`;

  const elements = await executeOverpassQuery(query);
  if (signal.aborted) return [];

  const results: SnappedOvernight[] = [];

  for (const day of transitDays) {
    const { lat, lng } = day.overnight!.location;

    let bestScore = -Infinity;
    let bestEl: (typeof elements)[number] | null = null;

    for (const el of elements) {
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (elLat === undefined || elLng === undefined) continue;

      const dist = haversineDistance(lat, lng, elLat, elLng);
      if (dist > SNAP_RADIUS_KM) continue;

      const placeType = el.tags?.place ?? '';
      const typeWeight = PLACE_WEIGHT[placeType];
      if (typeWeight === undefined) continue; // skip unknown/unlisted place types

      // Proximity score: 0 at the radius edge, 1 at the exact point.
      // Type weight (0–4) is doubled so a city 20 km away can beat a hamlet 1 km away,
      // but a village 2 km away still beats a city 48 km away.
      const proximityScore = 1 - dist / SNAP_RADIUS_KM;
      const score = typeWeight * 2 + proximityScore;

      if (score > bestScore) {
        bestScore = score;
        bestEl = el;
      }
    }

    if (!bestEl) continue;

    const snappedLat = bestEl.lat ?? bestEl.center!.lat;
    const snappedLng = bestEl.lon ?? bestEl.center!.lon;

    // Build a display name. OSM Canadian nodes sometimes carry province tags.
    const rawName = bestEl.tags?.name ?? '';
    const province =
      bestEl.tags?.['addr:province'] ??
      bestEl.tags?.['is_in:province_code'] ??
      '';
    const name = province ? `${rawName}, ${province}` : rawName;

    if (!name) continue;

    results.push({ dayNumber: day.dayNumber, lat: snappedLat, lng: snappedLng, name });
  }

  return results;
}
