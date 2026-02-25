import type { RouteSegment, TripDay } from '../../types';
import type { SuggestedStop, StopSuggestionConfig } from '../stop-suggestion-types';
import type { SimState } from './types';
import { getTimezoneShiftHours } from './timezone';

const LATEST_ARRIVAL_HOUR = 21; // 9 PM local — stop before arriving past this
const MEAL_TIMES = { breakfast: 8, lunch: 12, dinner: 18 }; // 24h format

/**
 * Reset simulation state at a multi-day boundary (e.g., Day 3 after a free Day 2).
 * Ensures fuel/rest calculations start fresh at the correct departure time.
 */
export function handleDayBoundaryReset(
  state: SimState,
  index: number,
  drivingDayStartMap: Map<number, TripDay>,
  config: StopSuggestionConfig,
): void {
  const newDrivingDay = drivingDayStartMap.get(index);
  if (!newDrivingDay) return;

  // Prefer the smart departure time computed by splitTripByDays (accounts for rest
  // minimums, target arrival, and how much driving remains). Fall back to the
  // user's configured departure time when not available.
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
 * Check if a fuel stop is needed before this segment.
 * Returns the suggestion and how much time was added to the sim clock.
 *
 * @param isFinalSegment — If true, applies "Destination Grace Period": only trigger
 *   on critically low fuel (≤15% tank), suppressing comfort/range-based refuels.
 *   Prevents duplicate fuel stops at the destination.
 * @param hubName — If provided, use this city name in the reason string instead of
 *   generic distance-based hints. Enables "Fuel up in Fargo, ND" style messaging.
 */
export function checkFuelStop(
  state: SimState,
  segment: RouteSegment,
  index: number,
  config: StopSuggestionConfig,
  safeRangeKm: number,
  isFinalSegment = false,
  hubName?: string,
): { suggestion: SuggestedStop | null; stopTimeAddedMs: number } {
  const fuelNeeded = segment.fuelNeededLitres ?? (segment.distanceKm / 100) * config.fuelEconomyL100km;

  // Four triggers (any one fires a fuel stop):
  // 1. Would drop below 15% tank capacity (critical)
  // 2. Exceeded calculated safe range based on tank/economy
  // 3. Comfort refuel — been driving 3-4+ hours since last fill
  // 4. Tank low — already at ≤35% regardless of hours/distance driven
  const wouldRunCriticallyLow = (state.currentFuel - fuelNeeded) < (config.tankSizeLitres * 0.15);
  const exceededSafeRange = state.distanceSinceLastFill >= safeRangeKm;
  const comfortRefuelDue = state.hoursSinceLastFill >= state.comfortRefuelHours && index > 0;
  const tankLow = state.currentFuel <= (config.tankSizeLitres * 0.35) && index > 0;

  // Destination Grace Period: at the final segment, only suggest fuel if critically low.
  // This prevents the "destination panic" double-fill bug.
  if (isFinalSegment && !wouldRunCriticallyLow) {
    return { suggestion: null, stopTimeAddedMs: 0 };
  }

  // Full-tank guard: if the tank was just reset (e.g. after checkArrivalWindow overnight
  // reset), there is nothing to refill. Any mid-segment needs for long legs are handled
  // independently by getEnRouteFuelStops — don't double-suggest here.
  if (state.currentFuel >= config.tankSizeLitres * 0.98) {
    return { suggestion: null, stopTimeAddedMs: 0 };
  }

  if (!exceededSafeRange && !wouldRunCriticallyLow && !comfortRefuelDue && !tankLow) {
    return { suggestion: null, stopTimeAddedMs: 0 };
  }

  const refillAmount = config.tankSizeLitres - state.currentFuel;
  const refillCost = refillAmount * config.gasPrice;
  const tankPercent = Math.round((state.currentFuel / config.tankSizeLitres) * 100);
  const litresRemaining = state.currentFuel.toFixed(1);

  // Hub-aware messaging: prepend city name when available
  const locationPrefix = hubName ? `Fuel up in ${hubName}. ` : '';

  let reason = '';
  if (wouldRunCriticallyLow) {
    reason = `${locationPrefix}Tank at ${tankPercent}% (${litresRemaining}L remaining). ~$${refillCost.toFixed(2)} to refill. Critical: refuel before continuing to ${segment.to.name}.`;
  } else if (tankLow && !exceededSafeRange && !comfortRefuelDue) {
    reason = `${locationPrefix}Tank is at ${tankPercent}% (${litresRemaining}L remaining) — getting low. ~$${refillCost.toFixed(2)} to top up now before options get sparse.`;
  } else if (comfortRefuelDue && !exceededSafeRange) {
    reason = `${locationPrefix}${state.hoursSinceLastFill.toFixed(1)} hours since last fill — good time to top up. Tank at ${tankPercent}% (${litresRemaining}L). ~$${refillCost.toFixed(2)} to refill.`;
  } else {
    reason = `${locationPrefix}Tank at ${tankPercent}% (${litresRemaining}L remaining). ~$${refillCost.toFixed(2)} to refill. You've driven ${state.distanceSinceLastFill.toFixed(0)} km since last fill.`;
  }

  let sparseWarning: string | undefined;
  if (segment.distanceKm > 150) {
    const hoursForSegment = segment.durationMinutes / 60;
    sparseWarning = `⚠️ Heads up: Limited services for next ${segment.distanceKm.toFixed(0)} km (${hoursForSegment.toFixed(1)} hours). Fuel up and take a break before continuing.`;
  }

  state.currentFuel = config.tankSizeLitres;
  state.distanceSinceLastFill = 0;
  state.hoursSinceLastFill = 0;
  const stopTimeAddedMs = 15 * 60 * 1000;
  state.currentTime = new Date(state.currentTime.getTime() + stopTimeAddedMs);

  return {
    suggestion: {
      id: `fuel-${index}`,
      type: 'fuel',
      reason,
      afterSegmentIndex: index - 1,
      estimatedTime: new Date(state.currentTime.getTime() - stopTimeAddedMs),
      duration: 15,
      priority: wouldRunCriticallyLow ? 'required' : 'recommended',
      details: {
        fuelNeeded: refillAmount,
        fuelCost: refillCost,
        fillType: (wouldRunCriticallyLow || exceededSafeRange) ? 'full' : 'topup',
      },
      warning: sparseWarning,
      dayNumber: state.currentDayNumber,
      accepted: true,
    },
    stopTimeAddedMs,
  };
}

/**
 * Check if a rest break is due.
 * stopTimeAddedMs: time already advanced this iteration by a fuel stop.
 * consolidateStops merges adjacent stops, so don't double-count fuel + rest.
 */
export function checkRestBreak(
  state: SimState,
  segment: RouteSegment,
  index: number,
  config: StopSuggestionConfig,
  stopTimeAddedMs: number,
): SuggestedStop | null {
  const hoursSinceBreak = (state.currentTime.getTime() - state.lastBreakTime.getTime()) / (1000 * 60 * 60);
  if (hoursSinceBreak < state.restBreakInterval || segment.durationMinutes <= 30) return null;

  const numDriversText = config.numDrivers > 1 ? `${config.numDrivers} drivers` : 'solo driver';

  state.lastBreakTime = new Date(state.currentTime);
  const restMs = 15 * 60 * 1000;
  const remainingMs = Math.max(0, restMs - stopTimeAddedMs);
  if (remainingMs > 0) {
    state.currentTime = new Date(state.currentTime.getTime() + remainingMs);
  }

  return {
    id: `rest-${index}`,
    type: 'rest',
    reason: `${hoursSinceBreak.toFixed(1)} hours behind the wheel (${numDriversText}). Take a 15-minute break to stretch, use the restroom, and stay alert.`,
    afterSegmentIndex: index - 1,
    estimatedTime: new Date(state.lastBreakTime),
    duration: 15,
    priority: 'recommended',
    details: { hoursOnRoad: state.hoursOnRoad },
    dayNumber: state.currentDayNumber,
  };
}

/**
 * Check if a meal stop (lunch or dinner) falls within this segment.
 * segmentStartTime is the captured currentTime before driving begins.
 *
 * @param isArrivingHome - If true, skip meal suggestion (arriving home on round trip)
 */
export function checkMealStop(
  state: SimState,
  segment: RouteSegment,
  index: number,
  segmentStartTime: Date,
  isArrivingHome = false,
): SuggestedStop | null {
  // Skip meal suggestion when arriving home — you'll eat at home
  if (isArrivingHome) return null;

  const segmentEndMs = segmentStartTime.getTime() + segment.durationMinutes * 60 * 1000;
  const mealTimestampForHour = (hour: number): Date => {
    const t = new Date(segmentStartTime);
    t.setHours(hour, 0, 0, 0);
    return t;
  };
  const lunchTs = mealTimestampForHour(MEAL_TIMES.lunch);
  const dinnerTs = mealTimestampForHour(MEAL_TIMES.dinner);
  // Meal fires if its timestamp falls strictly within (start, end] of this segment
  const crossesLunch = lunchTs.getTime() > segmentStartTime.getTime() && lunchTs.getTime() <= segmentEndMs;
  const crossesDinner = dinnerTs.getTime() > segmentStartTime.getTime() && dinnerTs.getTime() <= segmentEndMs;

  if (!crossesLunch && !crossesDinner) return null;

  const mealType = crossesLunch ? 'Lunch' : 'Dinner';
  const mealTime = crossesLunch ? '12:00 PM' : '6:00 PM';
  const mealTs = crossesLunch ? lunchTs : dinnerTs;

  // Hours driven up to the meal timestamp, not the full segment duration.
  // e.g. departing at 7:00 AM hitting noon = 5h, not 13.5h
  const hoursUntilMeal = (mealTs.getTime() - segmentStartTime.getTime()) / (1000 * 60 * 60);
  const hoursOnRoadAtMeal = (state.hoursOnRoad + hoursUntilMeal).toFixed(1);

  return {
    id: `meal-${mealType.toLowerCase()}-${index}`,
    type: 'meal',
    reason: `${mealType} break around ${mealTime}. You'll have driven ${hoursOnRoadAtMeal} hours. Refuel yourself and your vehicle with a proper meal.`,
    afterSegmentIndex: index,
    estimatedTime: crossesLunch ? new Date(lunchTs) : new Date(dinnerTs),
    duration: 45,
    priority: 'optional',
    details: { hoursOnRoad: state.hoursOnRoad + hoursUntilMeal },
    dayNumber: state.currentDayNumber,
  };
}

/**
 * Generate en-route fuel stops for segments longer than the safe range.
 * Advisory only (no accepted: true) — user decides in the suggestions panel.
 *
 * @param geometry       - Full route polyline for hub position lookups
 * @param segmentStartKm - Cumulative km at the start of this segment (for hub interpolation)
 * @param distanceAlreadyDriven - km already driven since last fill before this segment started.
 *   Used to place the first stop at the correct offset (e.g. if already 200km into a 550km
 *   safe range, the first en-route stop fires at 350km into the segment, not 550km).
 */
export function getEnRouteFuelStops(
  state: SimState,
  segment: RouteSegment,
  index: number,
  config: StopSuggestionConfig,
  safeRangeKm: number,
  segmentStartTime: Date,
  distanceAlreadyDriven = 0,
  /** Optional resolver: given km-into-segment, returns a hub city name or undefined */
  hubResolver?: (kmIntoSegment: number) => string | undefined,
): SuggestedStop[] {
  const stops: SuggestedStop[] = [];

  // Distance remaining in current tank interval at the start of this segment.
  // e.g. safeRange=550, already=200 → first stop should be at 350km into segment.
  const kmUntilFirstStop = Math.max(0, safeRangeKm - distanceAlreadyDriven);

  // No en-route stop needed if the tank can cover the full segment
  if (kmUntilFirstStop >= segment.distanceKm) return stops;

  // Generate stops at every safeRangeKm interval after the first stop
  let kmMark = kmUntilFirstStop;
  let stopIndex = 1;

  while (kmMark < segment.distanceKm) {
    const minutesMark = (kmMark / segment.distanceKm) * segment.durationMinutes;

    // Look up the hub at this stop's actual position on the full route geometry
    let stopHubName: string | undefined;
    if (hubResolver) {
      stopHubName = hubResolver(kmMark);
    }

    const locationDesc = stopHubName
      ? `near ${stopHubName}`
      : `around km ${Math.round(kmMark)} into this ${segment.distanceKm.toFixed(0)} km leg (~${(minutesMark / 60).toFixed(1)}h after departing)`;

    stops.push({
      id: `fuel-enroute-${index}-${stopIndex}`,
      type: 'fuel',
      reason: `En-route refuel needed ${locationDesc}. Your tank cannot cover the full distance without stopping.`,
      afterSegmentIndex: index - 1,
      estimatedTime: new Date(segmentStartTime.getTime() + minutesMark * 60 * 1000),
      duration: 15,
      priority: 'required',
      details: {
        fuelNeeded: config.tankSizeLitres * 0.9,
        fuelCost: config.tankSizeLitres * 0.9 * config.gasPrice,
        fillType: 'full',
      },
      dayNumber: state.currentDayNumber,
    });

    kmMark += safeRangeKm;
    stopIndex++;
  }

  return stops;
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
  // Overnight = implicit refuel (hotel morning fill-up)
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
