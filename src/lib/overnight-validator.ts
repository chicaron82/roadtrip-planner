import type { TripDay } from '../types';
import { executeOverpassQuery } from './poi-service/overpass';
import { haversineDistance } from './geo-utils';

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
