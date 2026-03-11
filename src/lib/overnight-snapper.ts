import type { TripDay } from '../types';
import { executeOverpassQuery } from './poi-service/overpass';
import { cacheDiscoveredHub, findPreferredHubInWindow } from './hub-cache';
import { haversineDistance } from './poi-ranking';
import { reverseGeocodeTown } from './route-geocoder';

/**
 * Search radius for finding the nearest real settlement.
 * 50 km is intentionally generous — towns on remote Canadian highways
 * (e.g. Highway 17 between Sudbury and Sault Ste. Marie) can be sparse,
 * and it's better to snap to a real town 40 km away than stay on the highway.
 */
const SNAP_RADIUS_M = 50_000;
const SNAP_RADIUS_KM = SNAP_RADIUS_M / 1000;
const HUB_OVERRIDE_WINDOW_KM = 40;

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
    const nearbyHub = findPreferredHubInWindow(lat, lng, HUB_OVERRIDE_WINDOW_KM);

    if (nearbyHub) {
      const hubDistanceKm = haversineDistance(lat, lng, nearbyHub.lat, nearbyHub.lng);
      if (hubDistanceKm <= HUB_OVERRIDE_WINDOW_KM) {
        results.push({
          dayNumber: day.dayNumber,
          lat: nearbyHub.lat,
          lng: nearbyHub.lng,
          name: nearbyHub.name,
        });
        continue;
      }
    }

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

    cacheDiscoveredHub({
      name,
      lat: snappedLat,
      lng: snappedLng,
      radius: 25,
      poiCount: 1,
      discoveredAt: new Date().toISOString(),
      source: 'discovered',
    });

    results.push({ dayNumber: day.dayNumber, lat: snappedLat, lng: snappedLng, name });
    continue;

    // unreachable but keeps structure obvious
  }

  for (const day of transitDays) {
    if (results.some(result => result.dayNumber === day.dayNumber)) continue;

    const { lat, lng } = day.overnight!.location;
    const fallbackName = await reverseGeocodeTown(lat, lng, signal);
    if (!fallbackName) continue;

    cacheDiscoveredHub({
      name: fallbackName,
      lat,
      lng,
      radius: 25,
      poiCount: 1,
      discoveredAt: new Date().toISOString(),
      source: 'discovered',
    });

    results.push({ dayNumber: day.dayNumber, lat, lng, name: fallbackName });
  }

  return results;
}

// ==================== INTENT OVERNIGHT VALIDATOR ====================

const HOTEL_CHECK_RADIUS_M = 10_000;   // 10 km — if nothing here, it's a ghost town
const ALT_SEARCH_RADIUS_M  = 100_000;  // 100 km — cast wide to find the nearest real option

export interface OvernightValidationResult {
  dayNumber: number;
  message: string;
  suggested?: { name: string; distanceKm: number };
}

/**
 * Validates user-pinned intent overnight locations for accommodation availability.
 *
 * Fires a single batched Overpass query covering all intent-overnight days.
 * If no hotels/motels are found within 10 km of the pinned location, a warning
 * is returned so the UI can surface it — the location itself is never changed.
 * This is intentionally non-destructive: the user might be camping, visiting
 * family, or fully aware the town is tiny.
 */
export async function validateIntentOvernights(
  days: TripDay[],
  signal: AbortSignal,
): Promise<OvernightValidationResult[]> {
  // Only check user-pinned intent overnights — skip engine-chosen transit-split locations.
  const intentDays = days.filter(
    d => d.overnight?.location.intent?.overnight === true,
  );
  if (intentDays.length === 0) return [];

  // Build a batched query:
  // - hotel/motel count near each pin (accommodation presence check)
  // - city/town/village within 100 km (nearest alternative if needed)
  const hotelFilters = intentDays
    .map(d => {
      const { lat, lng } = d.overnight!.location;
      return `  node(around:${HOTEL_CHECK_RADIUS_M},${lat},${lng})[tourism~"^(hotel|motel|hostel|guest_house)$"];
  way(around:${HOTEL_CHECK_RADIUS_M},${lat},${lng})[tourism~"^(hotel|motel|hostel|guest_house)$"];`;
    })
    .join('\n');

  const altFilters = intentDays
    .map(d => {
      const { lat, lng } = d.overnight!.location;
      return `  node(around:${ALT_SEARCH_RADIUS_M},${lat},${lng})[place~"^(city|town|village)$"];`;
    })
    .join('\n');

  const query = `[out:json][timeout:30];
(
${hotelFilters}
${altFilters}
);
out body;`;

  const elements = await executeOverpassQuery(query);
  if (signal.aborted) return [];

  const results: OvernightValidationResult[] = [];

  for (const day of intentDays) {
    const { lat, lng } = day.overnight!.location;

    // Count hotels within 10 km of this pin
    const hotelCount = elements.filter(el => {
      const tourism = el.tags?.tourism ?? '';
      if (!['hotel', 'motel', 'hostel', 'guest_house'].includes(tourism)) return false;
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (elLat === undefined || elLng === undefined) return false;
      return haversineDistance(lat, lng, elLat, elLng) <= HOTEL_CHECK_RADIUS_M / 1000;
    }).length;

    if (hotelCount > 0) continue; // Looks fine — hotels nearby

    // No hotels found — find nearest city/town/village for the suggestion
    let bestDist = Infinity;
    let bestName = '';

    for (const el of elements) {
      const place = el.tags?.place ?? '';
      if (!['city', 'town', 'village'].includes(place)) continue;
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (elLat === undefined || elLng === undefined) continue;
      const dist = haversineDistance(lat, lng, elLat, elLng);
      if (dist < bestDist && el.tags?.name) {
        bestDist = dist;
        bestName = el.tags.name;
      }
    }

    const locationName = day.overnight!.location.name.split(',')[0];
    results.push({
      dayNumber: day.dayNumber,
      message: `No accommodation found near ${locationName}`,
      suggested: bestName
        ? { name: bestName, distanceKm: Math.round(bestDist) }
        : undefined,
    });
  }

  return results;
}
