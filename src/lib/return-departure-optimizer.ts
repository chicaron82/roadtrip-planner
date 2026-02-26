/**
 * return-departure-optimizer.ts
 *
 * For round trips, suggests a return-leg departure time that creates a
 * natural Fuel + Lunch combo stop at a real hub city — instead of two
 * separate stops at anonymous km marks.
 *
 * Algorithm:
 *  1. Scan candidate departure times (±2h from current, 15-min steps)
 *  2. For each candidate, find where the midday meal window (11AM–1PM) falls
 *     on the return route (in km from the return leg origin)
 *  3. Check that position against the hub cache (80km window)
 *  4. Confirm the fuel tank would also need a stop near there (avoids
 *     suggesting a detour purely for lunch when the tank is still plenty full)
 *  5. Return the suggestion that saves the most time with the smallest delta
 *
 * 💚 My Experience Engine
 */

import type { RouteSegment, TripSettings, Vehicle } from '../types';
import { findHubInWindow } from './hub-cache';
import { interpolateRoutePosition } from './route-geocoder';
import { getTankSizeLitres } from './unit-conversions';
import { TRIP_CONSTANTS } from './trip-constants';

export interface ReturnDepartureSuggestion {
  /** ISO time string of the suggested departure (HH:MM) */
  suggestedTime: string;
  /** Named city hub where the combo would land */
  hubName: string;
  /** Minutes relative to current departure (negative = earlier) */
  minutesDelta: number;
  /** Estimated time saved vs two separate stops */
  timeSavedMinutes: number;
  /** km into the return leg where the combo would occur */
  comboKm: number;
}

/**
 * Find an optimal return departure time for a round trip.
 *
 * @param returnSegments  - Route segments for the return leg only
 * @param currentReturnDeparture - The departure time currently used for the return leg
 * @param fullGeometry   - Combined round-trip geometry (outbound + reversed)
 * @param returnStartKm  - Cumulative km along fullGeometry where the return leg begins
 * @param vehicle        - Vehicle config (for tank / safe range)
 * @param settings       - Trip settings (stop frequency)
 */
export function findOptimalReturnDeparture(
  returnSegments: RouteSegment[],
  currentReturnDeparture: Date,
  fullGeometry: number[][],
  returnStartKm: number,
  vehicle: Vehicle,
  settings: TripSettings,
): ReturnDepartureSuggestion | null {
  if (returnSegments.length === 0 || fullGeometry.length < 2) return null;

  // ── Fuel range calc ────────────────────────────────────────────────────────
  const tankSizeLitres = getTankSizeLitres(vehicle, settings.units);
  const fuelEconomy = vehicle.fuelEconomyHwy ?? 9;
  const vehicleRangeKm = (tankSizeLitres / fuelEconomy) * 100;
  const stopFrequency = settings.stopFrequency ?? 'balanced';
  const buffer = TRIP_CONSTANTS.stops.buffers[stopFrequency] ?? 0.2;
  const safeRangeKm = vehicleRangeKm * (1 - buffer);

  // Only suggest a combo if the tank would plausibly need fuel in that window.
  // We accept combos where meal lands within [40%, 105%] of the safe range from last fill.
  const comboFuelMin = safeRangeKm * 0.40;
  const comboFuelMax = safeRangeKm * 1.05;

  // Meal window: 11:00 AM – 1:30 PM
  const MEAL_WINDOW_START_H = 11;
  const MEAL_WINDOW_END_H = 13.5;

  // Scan ±2h in 15-min steps — prefer smallest delta that gives a good hub
  const SCAN_STEP_MIN = 15;
  const SCAN_RANGE_MIN = 120;
  const HUB_SNAP_KM = 80;
  // Minutes saved by merging two stops into a combo (one pit stop instead of two separate ones)
  const COMBO_TIME_SAVED_MIN = 30;

  // Track best result: prioritise smallest |delta|, then largest time saved
  let best: ReturnDepartureSuggestion | null = null;

  // Extract origin/destination names to filter out (no value suggesting a combo at your start/end)
  const returnOriginName = returnSegments[0]?.from?.name?.toLowerCase() ?? '';
  const returnDestName = returnSegments[returnSegments.length - 1]?.to?.name?.toLowerCase() ?? '';

  for (let delta = -SCAN_RANGE_MIN; delta <= SCAN_RANGE_MIN; delta += SCAN_STEP_MIN) {
    const candidateDeparture = new Date(
      currentReturnDeparture.getTime() + delta * 60 * 1000,
    );

    const candidateH = candidateDeparture.getHours() + candidateDeparture.getMinutes() / 60;

    // Scan both edges of the meal window for overlap with a hub
    for (const mealH of [MEAL_WINDOW_START_H, 12, MEAL_WINDOW_END_H]) {
      const minutesToMeal = (mealH - candidateH) * 60;
      if (minutesToMeal < 30 || minutesToMeal > 8 * 60) continue; // unreasonable

      // Walk return segments to find km position at minutesToMeal
      const comboKm = kmAtMinutes(returnSegments, minutesToMeal);
      if (comboKm <= 0) continue;

      // Must be in a plausible fuel range (not too early, not past tank math)
      if (comboKm < comboFuelMin || comboKm > comboFuelMax) continue;

      // Interpolate returns null past end of geometry — safe range check above
      // ensures comboKm ≤ safeRange which should be within the return leg
      const pos = interpolateRoutePosition(fullGeometry, returnStartKm + comboKm);
      if (!pos) continue;

      const hub = findHubInWindow(pos.lat, pos.lng, HUB_SNAP_KM);
      if (!hub) continue;

      // Skip hubs that are already the origin/destination (no value in "combo near Chicago" if that's where you're going)
      const hubLower = hub.name.toLowerCase();
      if (returnOriginName && hubLower.includes(returnOriginName.split(',')[0])) continue;
      if (returnDestName && hubLower.includes(returnDestName.split(',')[0])) continue;

      // Prefer deltas that save the most time with the smallest time change
      const absDelta = Math.abs(delta);

      if (!best || absDelta < Math.abs(best.minutesDelta)) {
        const h = candidateDeparture.getHours();
        const m = candidateDeparture.getMinutes();
        best = {
          suggestedTime: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
          hubName: hub.name,
          minutesDelta: delta,
          timeSavedMinutes: COMBO_TIME_SAVED_MIN,
          comboKm,
        };
      }
    }
  }

  // Only return a suggestion if the delta is meaningful (≥ 15 min off current)
  if (!best || best.minutesDelta === 0) return null;

  // Sanity: don't suggest departing before 5 AM or after 11 AM
  const [sugH] = best.suggestedTime.split(':').map(Number);
  if (sugH < 5 || sugH >= 11) return null;

  return best;
}

/**
 * Walk route segments and return cumulative km at the given elapsed minutes.
 * Proportional interpolation within each segment.
 */
function kmAtMinutes(segments: RouteSegment[], targetMinutes: number): number {
  let elapsed = 0;
  let km = 0;
  for (const seg of segments) {
    if (elapsed + seg.durationMinutes >= targetMinutes) {
      const fraction = (targetMinutes - elapsed) / seg.durationMinutes;
      km += seg.distanceKm * fraction;
      return km;
    }
    elapsed += seg.durationMinutes;
    km += seg.distanceKm;
  }
  return km; // past end of segments
}
