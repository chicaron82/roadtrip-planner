/**
 * outbound-departure-optimizer.ts
 *
 * For outbound legs, suggests a departure time that creates a natural
 * Fuel + Lunch combo stop at a real hub city (~4h out) — instead of
 * departing too early and missing the meal window at the hub.
 *
 * Example: Winnipeg → Dryden (~4h drive)
 *   - Default 6:00 AM departure → arrive Dryden ~10:00 AM (too early for lunch)
 *   - Suggested 8:00 AM departure → arrive Dryden ~12:00 PM (perfect combo!)
 *
 * Algorithm:
 *   1. Scan candidate departure times (7AM–10AM in 15-min steps)
 *   2. For each candidate, find where noon (±1h) would land on the route
 *   3. Check that position against the hub cache
 *   4. Confirm the fuel tank would also need a stop near there
 *   5. Return the suggestion that creates the best combo
 *
 * 💚 My Experience Engine
 */

import type { RouteSegment, TripSettings, Vehicle } from '../types';
import { findHubInWindow } from './hub-cache';
import { interpolateRoutePosition } from './route-geocoder';
import { getTankSizeLitres } from './unit-conversions';
import { TRIP_CONSTANTS } from './trip-constants';

export interface OutboundDepartureSuggestion {
  /** ISO time string of the suggested departure (HH:MM) */
  suggestedTime: string;
  /** Named city hub where the combo would land */
  hubName: string;
  /** Minutes relative to current departure (positive = later) */
  minutesDelta: number;
  /** Estimated arrival time at the hub (HH:MM) */
  arrivalTime: string;
  /** km into the outbound leg where the combo would occur */
  comboKm: number;
}

/**
 * Find an optimal outbound departure time.
 *
 * @param outboundSegments - Route segments for the outbound leg
 * @param currentDeparture - The departure time currently configured
 * @param fullGeometry     - Route geometry for hub interpolation
 * @param vehicle          - Vehicle config (for tank / safe range)
 * @param settings         - Trip settings (stop frequency)
 */
export function findOptimalOutboundDeparture(
  outboundSegments: RouteSegment[],
  currentDeparture: Date,
  fullGeometry: number[][],
  vehicle: Vehicle,
  settings: TripSettings,
): OutboundDepartureSuggestion | null {
  if (outboundSegments.length === 0 || fullGeometry.length < 2) return null;

  // ── Fuel range calc ────────────────────────────────────────────────────────
  const tankSizeLitres = getTankSizeLitres(vehicle, settings.units);
  const fuelEconomy = vehicle.fuelEconomyHwy ?? 9;
  const vehicleRangeKm = (tankSizeLitres / fuelEconomy) * 100;
  const stopFrequency = settings.stopFrequency ?? 'balanced';
  const buffer = TRIP_CONSTANTS.stops.buffers[stopFrequency] ?? 0.2;
  const safeRangeKm = vehicleRangeKm * (1 - buffer);

  // Accept combos where meal lands within [35%, 80%] of safe range.
  // This targets the ~4h mark (not too early, not tank-panic late).
  const comboFuelMin = safeRangeKm * 0.35;
  const comboFuelMax = safeRangeKm * 0.80;

  // Ideal meal arrival window: 11:30 AM – 12:30 PM (prime lunch)
  const MEAL_WINDOW_START_H = 11.5;
  const MEAL_WINDOW_END_H = 12.5;

  // Scan departure times from 7AM to 10AM in 15-min steps
  const SCAN_STEP_MIN = 15;
  const HUB_SNAP_KM = 80;

  // Calculate total outbound distance to avoid suggesting combo past destination
  const totalOutboundKm = outboundSegments.reduce((sum, s) => sum + s.distanceKm, 0);

  // Calculate average speed from segments
  const totalOutboundMinutes = outboundSegments.reduce((sum, s) => sum + s.durationMinutes, 0);
  const avgSpeedKmH = (totalOutboundKm / totalOutboundMinutes) * 60;

  // Extract origin/destination to skip
  const originName = outboundSegments[0]?.from?.name?.toLowerCase() ?? '';
  const destName = outboundSegments[outboundSegments.length - 1]?.to?.name?.toLowerCase() ?? '';

  let best: (OutboundDepartureSuggestion & { score: number }) | null = null;

  // Scan departure times from 7:00 AM to 10:00 AM
  for (let depHour = 7; depHour <= 10; depHour += 0.25) {
    const candidateDeparture = new Date(currentDeparture);
    candidateDeparture.setHours(Math.floor(depHour));
    candidateDeparture.setMinutes((depHour % 1) * 60);

    // For each meal target time in the window
    for (const mealH of [MEAL_WINDOW_START_H, 12, MEAL_WINDOW_END_H]) {
      const driveTimeToMealH = mealH - depHour;
      if (driveTimeToMealH < 3 || driveTimeToMealH > 5) continue; // 3-5h drive to meal

      // Calculate km position at meal time
      const driveMinutesToMeal = driveTimeToMealH * 60;
      const comboKm = kmAtMinutes(outboundSegments, driveMinutesToMeal);

      // Must be within plausible fuel range (not too early, not too late)
      if (comboKm < comboFuelMin || comboKm > comboFuelMax) continue;

      // Don't suggest combo past 80% of the route (too close to destination)
      if (comboKm > totalOutboundKm * 0.8) continue;

      // Interpolate position on geometry
      const pos = interpolateRoutePosition(fullGeometry, comboKm);
      if (!pos) continue;

      // Find hub within snapping distance
      const hub = findHubInWindow(pos.lat, pos.lng, HUB_SNAP_KM);
      if (!hub) continue;

      // Skip origin/destination hubs
      const hubLower = hub.name.toLowerCase();
      if (originName && hubLower.includes(originName.split(',')[0])) continue;
      if (destName && hubLower.includes(destName.split(',')[0])) continue;

      // Calculate delta from current departure
      const currentH = currentDeparture.getHours() + currentDeparture.getMinutes() / 60;
      const minutesDelta = Math.round((depHour - currentH) * 60);

      // Skip if this is the same as current departure
      if (minutesDelta === 0) continue;

      // Score the candidate: prefer noon arrival (12:00) and 8:00 AM departure
      // Higher score = better candidate
      const noonProximity = 1 - Math.abs(mealH - 12) / 1.5; // 1.0 at noon, lower at edges
      const idealDepartureBonus = (depHour >= 8 && depHour <= 9) ? 0.5 : 0;
      const score = noonProximity + idealDepartureBonus;

      const h = Math.floor(depHour);
      const m = Math.round((depHour % 1) * 60);
      const arrH = Math.floor(mealH);
      const arrM = Math.round((mealH % 1) * 60);

      const candidate: OutboundDepartureSuggestion & { score: number } = {
        suggestedTime: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
        hubName: hub.name,
        minutesDelta,
        arrivalTime: `${arrH.toString().padStart(2, '0')}:${arrM.toString().padStart(2, '0')}`,
        comboKm,
        score,
      };

      if (!best || score > (best as typeof candidate).score) {
        best = candidate;
      }
    }
  }

  // Only return a suggestion if the delta is meaningful (≥ 15 min later than current)
  if (!best || best.minutesDelta < 15) return null;

  // Sanity: don't suggest departing before 6 AM or after 10 AM
  const [sugH] = best.suggestedTime.split(':').map(Number);
  if (sugH < 6 || sugH > 10) return null;

  // Strip internal score from return value
  const { score: _score, ...result } = best;
  return result;
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
