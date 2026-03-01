/**
 * stop-checks-overnight.ts — Day-boundary and overnight scheduling checks.
 *
 * Contains: handleDayBoundaryReset, checkArrivalWindow,
 *           checkOvernightStop, driveSegment, applyTimezoneShift
 */

import type { RouteSegment, TripDay } from '../../types';
import type { SuggestedStop, StopSuggestionConfig } from '../stop-suggestion-types';
import type { SimState } from './types';
import { getTimezoneShiftHours } from './timezone';

const LATEST_ARRIVAL_HOUR = 21; // 9 PM local — stop before arriving past this

/**
 * Reset simulation state at a multi-day boundary (e.g., Day 3 after a free Day 2).
 * Ensures fuel/rest calculations start fresh at the correct departure time.
 *
 * Note: currentTzAbbr is intentionally NOT reset here. Timezone is preserved from
 * the last segment processed (destination timezone after outbound leg), which is
 * correct — you're still at the destination when the return leg starts.
 */
export function handleDayBoundaryReset(
  state: SimState,
  index: number,
  drivingDayStartMap: Map<number, TripDay>,
  config: StopSuggestionConfig,
): void {
  const newDrivingDay = drivingDayStartMap.get(index);
  if (!newDrivingDay) return;

  let dayStart: Date;
  if (newDrivingDay.totals?.departureTime) {
    dayStart = new Date(newDrivingDay.totals.departureTime);
  } else {
    const h = config.departureTime.getHours();
    const m = config.departureTime.getMinutes();
    dayStart = new Date(newDrivingDay.date + 'T00:00:00');
    dayStart.setHours(h, m, 0, 0);
  }
  state.currentTime = dayStart;
  state.totalDrivingToday = 0;
  state.lastBreakTime = new Date(dayStart);
  state.hoursOnRoad = 0;
  state.currentFuel = config.tankSizeLitres;
  state.distanceSinceLastFill = 0;
  state.hoursSinceLastFill = 0;
  state.currentDayNumber = newDrivingDay.dayNumber;
}

/**
 * Check if driving this segment would push arrival past the 9 PM check-in deadline.
 * If so, emit an overnight suggestion and reset state to the next morning.
 */
export function checkArrivalWindow(
  state: SimState,
  segment: RouteSegment,
  index: number,
  config: StopSuggestionConfig,
  daysWithHotel: Set<number>,
): SuggestedStop | null {
  if (state.totalDrivingToday === 0) return null;

  const projectedMs = state.currentTime.getTime() + segment.durationMinutes * 60000;
  const tzShiftMs = getTimezoneShiftHours(state.currentTzAbbr, segment.weather?.timezoneAbbr ?? null) * 3600000;
  const projectedArrival = new Date(projectedMs + tzShiftMs);
  const arrivalDecimal = projectedArrival.getHours() + projectedArrival.getMinutes() / 60;
  const currentDecimal = state.currentTime.getHours() + state.currentTime.getMinutes() / 60;

  const wouldArriveLate = arrivalDecimal >= LATEST_ARRIVAL_HOUR
    || (segment.durationMinutes > 60 && arrivalDecimal < currentDecimal);

  if (!wouldArriveLate) return null;

  const arrivalTimeStr = projectedArrival.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const tzLabel = segment.weather?.timezoneAbbr || state.currentTzAbbr || '';
  const dh = config.departureTime.getHours();
  const dm = config.departureTime.getMinutes();
  const departStr = `${dh % 12 || 12}:${String(dm).padStart(2, '0')} ${dh >= 12 ? 'PM' : 'AM'}`;

  let suggestion: SuggestedStop | null = null;
  if (!daysWithHotel.has(state.currentDayNumber)) {
    suggestion = {
      id: `overnight-arrival-${index}`,
      type: 'overnight',
      reason: `Stopping for the night — continuing to ${segment.to.name} would mean arriving around ${arrivalTimeStr}${tzLabel ? ' ' + tzLabel : ''}, past the 9 PM check-in window. Rest up and depart fresh at ${departStr} tomorrow.`,
      afterSegmentIndex: index - 1,
      estimatedTime: new Date(state.currentTime),
      duration: 8 * 60,
      priority: 'required',
      details: { hoursOnRoad: state.hoursOnRoad },
      dayNumber: state.currentDayNumber,
    };
  }

  // Reset to next morning
  state.totalDrivingToday = 0;
  state.hoursOnRoad = 0;
  const nextDay = new Date(state.currentTime);
  nextDay.setDate(nextDay.getDate() + 1);
  nextDay.setHours(dh, dm, 0, 0);
  state.currentTime = nextDay;
  state.lastBreakTime = new Date(state.currentTime);
  state.currentFuel = config.tankSizeLitres;
  state.distanceSinceLastFill = 0;
  state.hoursSinceLastFill = 0;
  state.currentDayNumber++;

  return suggestion;
}

/**
 * Drive the segment: consume fuel, advance driving hours.
 * Returns the projected arrival time.
 */
export function driveSegment(
  state: SimState,
  segment: RouteSegment,
  segmentStartTime: Date,
  config: StopSuggestionConfig,
): Date {
  const fuelNeeded = segment.fuelNeededLitres ?? (segment.distanceKm / 100) * config.fuelEconomyL100km;
  const segmentHours = segment.durationMinutes / 60;
  state.currentFuel -= fuelNeeded;
  state.hoursOnRoad += segmentHours;
  state.totalDrivingToday += segmentHours;
  return new Date(segmentStartTime.getTime() + segment.durationMinutes * 60 * 1000);
}

/**
 * Check if daily drive limit has been hit — suggest overnight stop if so.
 * Resets state to next morning when overnight is triggered.
 */
export function checkOvernightStop(
  state: SimState,
  index: number,
  config: StopSuggestionConfig,
  daysWithHotel: Set<number>,
  arrivalTime: Date,
  isFinalSegment: boolean,
): SuggestedStop | null {
  if (state.totalDrivingToday < config.maxDriveHoursPerDay || isFinalSegment) {
    state.currentTime = arrivalTime;
    return null;
  }

  let suggestion: SuggestedStop | null = null;
  if (!daysWithHotel.has(state.currentDayNumber)) {
    const maxHoursText = config.maxDriveHoursPerDay === 1 ? '1 hour' : `${config.maxDriveHoursPerDay} hours`;
    suggestion = {
      id: `overnight-${index}`,
      type: 'overnight',
      reason: `You've reached your daily driving limit (${state.totalDrivingToday.toFixed(1)} hours driven, max ${maxHoursText}/day). Find a hotel, get dinner, and recharge for tomorrow.`,
      afterSegmentIndex: index,
      estimatedTime: new Date(arrivalTime),
      duration: 8 * 60,
      priority: 'required',
      details: { hoursOnRoad: state.hoursOnRoad },
      dayNumber: state.currentDayNumber,
    };
  }

  state.totalDrivingToday = 0;
  state.hoursOnRoad = 0;
  state.currentFuel = config.tankSizeLitres;
  state.distanceSinceLastFill = 0;
  state.hoursSinceLastFill = 0;
  const departHour = config.departureTime.getHours();
  const departMinute = config.departureTime.getMinutes();
  const nextDay = new Date(arrivalTime);
  nextDay.setDate(nextDay.getDate() + 1);
  nextDay.setHours(departHour, departMinute, 0, 0);
  state.currentTime = nextDay;
  state.lastBreakTime = new Date(state.currentTime);
  state.currentDayNumber++;

  return suggestion;
}

/**
 * Apply a timezone crossing: shift wall-clock time and lastBreakTime.
 * CDT→EDT means clocks jump forward 1h (shiftMs > 0).
 */
export function applyTimezoneShift(state: SimState, segment: RouteSegment): void {
  const segTzAbbr = segment.weather?.timezoneAbbr ?? null;
  if (!segTzAbbr || segTzAbbr === state.currentTzAbbr) return;

  const shiftMs = getTimezoneShiftHours(state.currentTzAbbr, segTzAbbr) * 3600000;
  state.currentTime = new Date(state.currentTime.getTime() + shiftMs);
  state.lastBreakTime = new Date(state.lastBreakTime.getTime() + shiftMs);
  state.currentTzAbbr = segTzAbbr;
}
