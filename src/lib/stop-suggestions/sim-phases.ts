/**
 * sim-phases.ts — cohesive per-segment phases extracted from the generateSmartStops loop.
 *
 * Same shape as the stop-checks family: each phase takes the mutable SimState +
 * the current segment (+ a scalar or two) and either mutates state or returns a
 * suggestion. Only the phases with NARROW signatures live here — the loop keeps
 * the heavily-coupled core (fuel-check orchestration, distance accumulation,
 * drive) where extracting would just relocate the coupling.
 *
 * 💚 My Experience Engine
 */

import type { TripDay, ProcessedSegment } from '../../types';
import type { SuggestedStop, StopSuggestionConfig } from '../stop-suggestion-types';
import type { SimState } from './types';
import { TRIP_CONSTANTS } from '../trip-constants';
import { lngToIANA, ianaToAbbr } from '../trip-timezone';
import { getTimezoneShiftHours } from './timezone';

/**
 * When crossing a day boundary, synthesize an overnight stop from TripDay
 * overnight data if the auto-generator would have been suppressed by daysWithHotel.
 * Covers round-trip destinations where the outbound leg fits within maxDriveHours
 * so checkOvernightStop never fires, but a hotel stop was still assigned by
 * splitTripByDays. Returns the pre-accepted stop, or null.
 */
export function buildSynthesizedOvernight(
  days: TripDay[] | undefined,
  incomingDay: TripDay | undefined,
  daysWithHotel: Set<number>,
  state: SimState,
  segOrigIdx: number,
): SuggestedStop | null {
  if (!incomingDay || !days) return null;
  const prevDrivingDay = days
    .filter(d => d.segmentIndices.length > 0 && d.dayNumber < incomingDay.dayNumber)
    .at(-1);
  if (!prevDrivingDay?.overnight || !daysWithHotel.has(prevDrivingDay.dayNumber)) return null;
  const overnight = prevDrivingDay.overnight;
  return {
    id: `overnight-midpoint-day${prevDrivingDay.dayNumber}`,
    type: 'overnight',
    reason: `Overnight at ${overnight.location.name}. Check in, rest up, and continue tomorrow.`,
    afterSegmentIndex: Math.max(0, segOrigIdx - 1),
    estimatedTime: new Date(state.currentTime),
    duration: 720,
    priority: 'required',
    details: { hoursOnRoad: state.totalDrivingToday },
    dayNumber: prevDrivingDay.dayNumber,
    accepted: true, // User already filled in hotel data — don't show as pending suggestion
    hubName: overnight.location.name,
  };
}

/**
 * Timezone shift for transit sub-segments. These inherit their parent's
 * DESTINATION timezoneAbbr — wrong for intermediate sub-segments (a
 * Winnipeg→Vancouver mega-segment split into 4 parts gives ALL parts 'PDT').
 * Derive the correct zone from the sub-segment's FROM longitude instead
 * (which IS accurate — interpolated on the real road) and shift the clock.
 */
export function applyTransitTimezoneShift(state: SimState, segment: ProcessedSegment): void {
  const derivedAbbr = ianaToAbbr(lngToIANA(segment.from.lng)) ?? state.currentTzAbbr;
  if (derivedAbbr && derivedAbbr !== state.currentTzAbbr) {
    const shiftMs = getTimezoneShiftHours(state.currentTzAbbr, derivedAbbr) * 3600000;
    state.currentTime = new Date(state.currentTime.getTime() + shiftMs);
    state.lastBreakTime = new Date(state.lastBreakTime.getTime() + shiftMs);
    state.currentTzAbbr = derivedAbbr;
  }
}

/**
 * Sync simulation state after mid-segment en-route fills. driveSegment consumes
 * fuel for the full segment, but the tank was refilled at lastFillKm — correct
 * distanceSinceLastFill, hoursSinceLastFill, and currentFuel to reflect only the
 * distance driven AFTER the last en-route fill. Prevents checkFuelStop from
 * firing spuriously at the next segment boundary. With no fill (lastFillKm 0),
 * accumulates the whole segment's fuel cost instead.
 */
export function syncStateAfterEnRouteFills(
  state: SimState,
  segment: ProcessedSegment,
  config: StopSuggestionConfig,
  lastFillKm: number,
): void {
  if (lastFillKm > 0) {
    const remainingKm  = segment.distanceKm - lastFillKm;
    const remainingMin = (remainingKm / segment.distanceKm) * segment.durationMinutes;
    const remainingFuel = (remainingKm / 100) * config.fuelEconomyL100km;
    state.currentFuel          = config.tankSizeLitres - remainingFuel;
    state.distanceSinceLastFill = remainingKm;
    state.hoursSinceLastFill    = remainingMin / 60;
    // Cost of the remaining portion after the last en-route fill (regional prices)
    state.costSinceLastFill = (remainingKm / segment.distanceKm) * (segment.fuelCost ?? 0);
  } else {
    // No en-route fill — accumulate the entire segment's cost
    state.costSinceLastFill += segment.fuelCost ?? 0;
  }
}

/**
 * Reset fuel state to a full tank (EV: charge limit). Shared by the round-trip
 * turnaround reset (the sim assumes a fill at the destination) and the
 * waypoint fuel-intent reset.
 */
export function refillTank(state: SimState, config: StopSuggestionConfig): void {
  state.currentFuel = config.isEV ? config.tankSizeLitres * TRIP_CONSTANTS.ev.chargeToLimit : config.tankSizeLitres;
  state.distanceSinceLastFill = 0;
  state.hoursSinceLastFill = 0;
  state.costSinceLastFill = 0;
}

/**
 * Intent-aware state reset: when the user declared a fuel/meal intent at this
 * waypoint (segment.to), adjust sim state as if the planned stop happened.
 * Prevents the NEXT segment's boundary check from firing a redundant fuel or
 * meal stop near the same waypoint. The orchestrator injects the actual intent
 * stop into the output — this only syncs the simulation state.
 */
export function applyWaypointIntentReset(
  state: SimState,
  segment: ProcessedSegment,
  config: StopSuggestionConfig,
): void {
  const waypointIntent = segment.to?.intent;
  if (!waypointIntent || segment.to?.type !== 'waypoint') return;
  if (waypointIntent.fuel) {
    refillTank(state, config);
    const dwellMs = (waypointIntent.dwellMinutes ?? (waypointIntent.meal ? 45 : 15)) * 60 * 1000;
    state.currentTime = new Date(state.currentTime.getTime() + dwellMs);
    state.lastBreakTime = new Date(state.currentTime);
  } else if (waypointIntent.meal) {
    const dwellMs = (waypointIntent.dwellMinutes ?? 45) * 60 * 1000;
    state.currentTime = new Date(state.currentTime.getTime() + dwellMs);
    state.lastBreakTime = new Date(state.currentTime);
  }
}
