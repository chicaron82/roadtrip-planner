import type { RouteSegment, Vehicle, TripSettings, TripDay } from '../types';

export type StopType = 'fuel' | 'rest' | 'meal' | 'overnight';

export interface SuggestedStop {
  id: string;
  type: StopType;
  reason: string;
  afterSegmentIndex: number; // Insert after this segment
  estimatedTime: Date;
  duration: number; // minutes
  priority: 'required' | 'recommended' | 'optional';
  details: {
    fuelNeeded?: number; // litres
    fuelCost?: number;
    hoursOnRoad?: number; // hours driven before this stop
  };
  warning?: string; // Sparse stretch warning
  dismissed?: boolean;
  accepted?: boolean;
}

export type StopFrequency = 'conservative' | 'balanced' | 'aggressive';

export interface StopSuggestionConfig {
  tankSizeLitres: number;
  fuelEconomyL100km: number;
  maxDriveHoursPerDay: number;
  numDrivers: number;
  departureTime: Date;
  gasPrice: number;
  fuelBuffer?: number; // Percent to keep in reserve (default 0.25)
  stopFrequency?: StopFrequency; // How often to suggest stops (default 'balanced')
}

/** UTC offset in hours for North American timezone abbreviations. */
function getUtcOffsetHours(abbr: string): number | null {
  const offsets: Record<string, number> = {
    'PST': -8, 'PDT': -7,
    'MST': -7, 'MDT': -6,
    'CST': -6, 'CDT': -5,
    'EST': -5, 'EDT': -4,
    'AST': -4, 'ADT': -3,       // Atlantic (Maritimes)
    'NST': -3.5, 'NDT': -2.5,   // Newfoundland
    'AKST': -9, 'AKDT': -8,     // Alaska
    'HST': -10, 'HDT': -9,      // Hawaii
  };
  return offsets[abbr] ?? null;
}

/**
 * Wall-clock shift in hours when crossing from one timezone to another.
 * Positive = clocks jump forward (lose time). CDT→EDT = +1.
 */
function getTimezoneShiftHours(fromAbbr: string | null, toAbbr: string | null): number {
  if (!fromAbbr || !toAbbr || fromAbbr === toAbbr) return 0;
  const fromOffset = getUtcOffsetHours(fromAbbr);
  const toOffset = getUtcOffsetHours(toAbbr);
  if (fromOffset === null || toOffset === null) return 0;
  return toOffset - fromOffset;
}

/**
 * Generate smart stop suggestions based on route, vehicle, and settings
 */
export function generateSmartStops(
  segments: RouteSegment[],
  config: StopSuggestionConfig,
  days?: TripDay[]
): SuggestedStop[] {
  const suggestions: SuggestedStop[] = [];

  // Configuration based on stop frequency
  const stopFrequency = config.stopFrequency || 'balanced';

  const bufferMultipliers = {
    conservative: 0.30, // 30% buffer, stop earlier
    balanced: 0.25,     // 25% buffer
    aggressive: 0.20,   // 20% buffer, push further
  };

  const actualBuffer = bufferMultipliers[stopFrequency];

  // Calculate safe range (distance we can travel before needing fuel)
  const vehicleRangeKm = (config.tankSizeLitres / config.fuelEconomyL100km) * 100;
  const safeRangeKm = vehicleRangeKm * (1 - actualBuffer);

  // Track simulation state
  let currentFuel = config.tankSizeLitres;
  let distanceSinceLastFill = 0;
  let hoursSinceLastFill = 0;
  let currentTime = new Date(config.departureTime);
  let hoursOnRoad = 0;
  let totalDrivingToday = 0;
  let lastBreakTime = new Date(config.departureTime);

  // Timezone tracking — weather API's timezoneAbbr is more reliable than
  // segment-analyzer's lngDiff heuristic (which misses Winnipeg→Thunder Bay).
  let currentTzAbbr: string | null = segments[0]?.weather?.timezoneAbbr ?? null;

  const LATEST_ARRIVAL_HOUR = 21; // 9 PM local — stop before arriving past this

  const REST_BREAK_INTERVAL = stopFrequency === 'conservative' ? 1.5 : stopFrequency === 'balanced' ? 2 : 2.5;
  const MEAL_TIMES = { breakfast: 8, lunch: 12, dinner: 18 }; // 24h format

  // Comfort refuel interval — real drivers don't push to empty.
  // Trigger a fuel stop every ~3-4 hours of driving, even if tank isn't low.
  const COMFORT_REFUEL_HOURS = stopFrequency === 'conservative' ? 2.5 : stopFrequency === 'balanced' ? 3.5 : 4.5;

  // Build map: first-segment-index → TripDay, for non-first driving days only.
  // Used to reset simulation state at multi-day boundaries (e.g., after a free day).
  const drivingDayStartMap = new Map<number, TripDay>();
  if (days) {
    const drivingDays = days.filter(d => d.segmentIndices.length > 0);
    drivingDays.slice(1).forEach(day => {
      if (day.segmentIndices.length > 0) {
        drivingDayStartMap.set(day.segmentIndices[0], day);
      }
    });
  }

  segments.forEach((segment, index) => {
    const segmentHours = segment.durationMinutes / 60;
    const fuelNeeded = segment.fuelNeededLitres || (segment.distanceKm / 100) * config.fuelEconomyL100km;

    // === DAY BOUNDARY RESET ===
    // When a new driving day starts (e.g., Day 3 after a free Day 2), reset all simulation
    // state so fuel/rest calculations start fresh at the correct departure time.
    const newDrivingDay = drivingDayStartMap.get(index);
    if (newDrivingDay) {
      const h = config.departureTime.getHours();
      const m = config.departureTime.getMinutes();
      const dayStart = new Date(newDrivingDay.date + 'T00:00:00');
      dayStart.setHours(h, m, 0, 0);
      currentTime = dayStart;
      totalDrivingToday = 0;
      lastBreakTime = new Date(dayStart);
      currentFuel = config.tankSizeLitres;
      distanceSinceLastFill = 0;
      hoursSinceLastFill = 0;
    }

    // === ARRIVAL WINDOW CHECK (pre-segment) ===
    // "I want to be checked into a hotel by 9pm local time."
    // If driving this segment would push arrival past the deadline, stop NOW.
    if (totalDrivingToday > 0) {
      const projectedMs = currentTime.getTime() + segment.durationMinutes * 60000;
      const tzShiftMs = getTimezoneShiftHours(currentTzAbbr, segment.weather?.timezoneAbbr ?? null) * 3600000;
      const projectedArrival = new Date(projectedMs + tzShiftMs);
      const arrivalHour = projectedArrival.getHours();
      const arrivalMinute = projectedArrival.getMinutes();
      const arrivalDecimal = arrivalHour + arrivalMinute / 60;
      const currentDecimal = currentTime.getHours() + currentTime.getMinutes() / 60;

      // Past 9pm, OR segment so long it wraps past midnight
      const wouldArriveLate = arrivalDecimal >= LATEST_ARRIVAL_HOUR
        || (segment.durationMinutes > 60 && arrivalDecimal < currentDecimal);

      if (wouldArriveLate) {
        const arrivalTimeStr = projectedArrival.toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', hour12: true,
        });
        const tzLabel = segment.weather?.timezoneAbbr || currentTzAbbr || '';
        const dh = config.departureTime.getHours();
        const dm = config.departureTime.getMinutes();
        const departStr = `${dh % 12 || 12}:${String(dm).padStart(2, '0')} ${dh >= 12 ? 'PM' : 'AM'}`;

        suggestions.push({
          id: `overnight-arrival-${index}`,
          type: 'overnight',
          reason: `Stopping for the night — continuing to ${segment.to.name} would mean arriving around ${arrivalTimeStr}${tzLabel ? ' ' + tzLabel : ''}, past the 9 PM check-in window. Rest up and depart fresh at ${departStr} tomorrow.`,
          afterSegmentIndex: index - 1,
          estimatedTime: new Date(currentTime),
          duration: 8 * 60,
          priority: 'required',
          details: { hoursOnRoad },
        });

        // Reset to next morning at configured departure time
        totalDrivingToday = 0;
        const nextDay = new Date(currentTime);
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(dh, dm, 0, 0);
        currentTime = nextDay;
        lastBreakTime = new Date(currentTime);
        currentFuel = config.tankSizeLitres;
        distanceSinceLastFill = 0;
        hoursSinceLastFill = 0;
      }
    }

    // === FUEL STOP CHECK ===
    // TODO: When fuel + rest fire back-to-back in the same iteration, the sim advances
    // 15 min twice (30 min total) but consolidateStops merges them into a single 15-min stop.
    // Downstream simulationItems uses the merged duration, so the timeline is correct — but
    // this engine's internal clock drifts ~15 min pessimistic per merged pair. Acceptable for
    // now; fix if cumulative drift becomes noticeable on very long multi-day trips.
    distanceSinceLastFill += segment.distanceKm;
    hoursSinceLastFill += segmentHours;

    // Three triggers (any one fires a fuel stop):
    // 1. Would drop below 15% tank capacity (critical)
    // 2. Exceeded calculated safe range based on tank/economy
    // 3. Comfort refuel — been driving 3-4+ hours since last fill
    //    (realistic behavior: top up at a midpoint town, don't push to empty)
    const wouldRunCriticallyLow = (currentFuel - fuelNeeded) < (config.tankSizeLitres * 0.15); // Critical: below 15%
    const exceededSafeRange = distanceSinceLastFill >= safeRangeKm;
    const comfortRefuelDue = hoursSinceLastFill >= COMFORT_REFUEL_HOURS && index > 0;

    if (exceededSafeRange || wouldRunCriticallyLow || comfortRefuelDue) {
      const refillAmount = config.tankSizeLitres - currentFuel;
      const refillCost = refillAmount * config.gasPrice;
      const tankPercent = Math.round((currentFuel / config.tankSizeLitres) * 100);
      const litresRemaining = currentFuel.toFixed(1);

      let reason = '';
      if (wouldRunCriticallyLow) {
        reason = `Tank at ${tankPercent}% (${litresRemaining}L remaining). ~$${refillCost.toFixed(2)} to refill. Critical: refuel before continuing to ${segment.to.name}.`;
      } else if (comfortRefuelDue && !exceededSafeRange) {
        reason = `${hoursSinceLastFill.toFixed(1)} hours since last fill — good time to top up. Tank at ${tankPercent}% (${litresRemaining}L). ~$${refillCost.toFixed(2)} to refill.`;
      } else {
        reason = `Tank at ${tankPercent}% (${litresRemaining}L remaining). ~$${refillCost.toFixed(2)} to refill. You've driven ${distanceSinceLastFill.toFixed(0)} km since last fill.`;
      }

      // Check if the next segment is a sparse stretch (> 150km)
      let sparseWarning: string | undefined;
      if (segment.distanceKm > 150) {
        const hoursForSegment = segment.durationMinutes / 60;
        sparseWarning = `⚠️ Heads up: Limited services for next ${segment.distanceKm.toFixed(0)} km (${hoursForSegment.toFixed(1)} hours). Fuel up and take a break before continuing.`;
      }

      suggestions.push({
        id: `fuel-${index}`,
        type: 'fuel',
        reason,
        afterSegmentIndex: index - 1, // Stop before this segment
        estimatedTime: new Date(currentTime),
        duration: 15,
        priority: wouldRunCriticallyLow ? 'required' : 'recommended',
        details: {
          fuelNeeded: refillAmount,
          fuelCost: refillCost,
        },
        warning: sparseWarning,
        accepted: true, // Fuel stops auto-added to itinerary by default
      });

      currentFuel = config.tankSizeLitres; // Simulated refill
      distanceSinceLastFill = 0; // Reset distance tracker
      hoursSinceLastFill = 0; // Reset comfort timer
      currentTime = new Date(currentTime.getTime() + 15 * 60 * 1000); // Add 15 min
    }

    // === REST BREAK CHECK (every 2-3 hours) ===
    const hoursSinceBreak = (currentTime.getTime() - lastBreakTime.getTime()) / (1000 * 60 * 60);
    if (hoursSinceBreak >= REST_BREAK_INTERVAL && segmentHours > 0.5) {
      const numDriversText = config.numDrivers > 1 ? `${config.numDrivers} drivers` : 'solo driver';
      suggestions.push({
        id: `rest-${index}`,
        type: 'rest',
        reason: `${hoursSinceBreak.toFixed(1)} hours behind the wheel (${numDriversText}). Take a 15-minute break to stretch, use the restroom, and stay alert.`,
        afterSegmentIndex: index - 1,
        estimatedTime: new Date(currentTime),
        duration: 15,
        priority: 'recommended',
        details: {
          hoursOnRoad: hoursOnRoad,
        },
      });

      lastBreakTime = new Date(currentTime);
      currentTime = new Date(currentTime.getTime() + 15 * 60 * 1000);
    }

    // === MEAL STOP CHECK ===
    const currentHour = currentTime.getHours();
    const nextHour = new Date(currentTime.getTime() + segment.durationMinutes * 60 * 1000).getHours();

    // Check if we'll pass through a meal time during this segment
    if (
      (currentHour < MEAL_TIMES.lunch && nextHour >= MEAL_TIMES.lunch) ||
      (currentHour < MEAL_TIMES.dinner && nextHour >= MEAL_TIMES.dinner)
    ) {
      const mealType = currentHour < MEAL_TIMES.lunch ? 'Lunch' : 'Dinner';
      const mealTime = currentHour < MEAL_TIMES.lunch ? '12:00 PM' : '6:00 PM';
      const totalHoursOnRoad = (hoursOnRoad + segmentHours).toFixed(1);
      suggestions.push({
        id: `meal-${mealType.toLowerCase()}-${index}`,
        type: 'meal',
        reason: `${mealType} break around ${mealTime}. You'll have driven ${totalHoursOnRoad} hours. Refuel yourself and your vehicle with a proper meal.`,
        afterSegmentIndex: index,
        estimatedTime: new Date(currentTime.getTime() + segment.durationMinutes * 60 * 1000),
        duration: 45,
        priority: 'optional',
        details: {
          hoursOnRoad: hoursOnRoad + segmentHours,
        },
      });
    }

    // === OVERNIGHT STOP CHECK ===
    totalDrivingToday += segmentHours;
    if (totalDrivingToday >= config.maxDriveHoursPerDay) {
      const maxHoursText = config.maxDriveHoursPerDay === 1 ? '1 hour' : `${config.maxDriveHoursPerDay} hours`;
      suggestions.push({
        id: `overnight-${index}`,
        type: 'overnight',
        reason: `You've reached your daily driving limit (${totalDrivingToday.toFixed(1)} hours driven, max ${maxHoursText}/day). Find a hotel, get dinner, and recharge for tomorrow.`,
        afterSegmentIndex: index,
        estimatedTime: new Date(currentTime.getTime() + segment.durationMinutes * 60 * 1000),
        duration: 8 * 60, // 8 hours
        priority: 'required',
        details: {
          hoursOnRoad: hoursOnRoad + segmentHours,
        },
      });

      totalDrivingToday = 0; // Reset for next day
      // Move to next morning at configured departure time
      const departHour = config.departureTime.getHours();
      const departMinute = config.departureTime.getMinutes();
      const nextDay = new Date(currentTime);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(departHour, departMinute, 0, 0);
      currentTime = nextDay;
      lastBreakTime = new Date(currentTime);
    }

    // === EN-ROUTE FUEL STOPS (segment longer than safe range) ===
    // If a single leg exceeds the tank's safe range, suggest mid-leg refuel points.
    // Pushed AFTER meal/overnight so consolidateStops doesn't merge them with the
    // start-of-leg fuel stop (which has the same afterSegmentIndex: index - 1).
    // These are advisory only (no `accepted: true`) — user decides in the suggestions panel.
    const enRouteFuelCount = Math.max(0, Math.ceil(segment.distanceKm / safeRangeKm) - 1);
    for (let s = 1; s <= enRouteFuelCount; s++) {
      const kmMark = Math.round(safeRangeKm * s);
      const minutesMark = (safeRangeKm * s / segment.distanceKm) * segment.durationMinutes;
      suggestions.push({
        id: `fuel-enroute-${index}-${s}`,
        type: 'fuel',
        reason: `En-route refuel needed around km ${kmMark} into this ${segment.distanceKm.toFixed(0)} km leg (~${(minutesMark / 60).toFixed(1)}h after departing). Your tank cannot cover the full distance without stopping.`,
        afterSegmentIndex: index - 1,
        estimatedTime: new Date(currentTime.getTime() + minutesMark * 60 * 1000),
        duration: 15,
        priority: 'required',
        details: {
          fuelNeeded: config.tankSizeLitres * 0.9,
          fuelCost: config.tankSizeLitres * 0.9 * config.gasPrice,
        },
      });
    }

    // Update state for next segment
    currentFuel -= fuelNeeded;
    hoursOnRoad += segmentHours;
    currentTime = new Date(currentTime.getTime() + segment.durationMinutes * 60 * 1000);

    // === TIMEZONE SHIFT ===
    // After arriving at this segment's destination, check if we entered a new timezone.
    // Uses weather API's timezoneAbbr (not segment.timezoneCrossing which has a flawed heuristic).
    const segTzAbbr = segment.weather?.timezoneAbbr ?? null;
    if (segTzAbbr && segTzAbbr !== currentTzAbbr) {
      const shiftMs = getTimezoneShiftHours(currentTzAbbr, segTzAbbr) * 3600000;
      // Shift wall-clock time: CDT→EDT means clocks jump forward 1h (shiftMs > 0).
      // Shift lastBreakTime too so hoursSinceBreak stays correct.
      currentTime = new Date(currentTime.getTime() + shiftMs);
      lastBreakTime = new Date(lastBreakTime.getTime() + shiftMs);
      currentTzAbbr = segTzAbbr;
    }
  });

  // Deduplicate and consolidate stops that are too close together
  return consolidateStops(suggestions);
}

/**
 * Consolidate stops that are too close together.
 * Current: merges adjacent entries with the same afterSegmentIndex.
 * TODO: When attraction/POI stops are added, upgrade to time-window merge
 * (e.g., within 20 min of estimatedTime) with priority tiers:
 *   overnight > fuel > meal > rest > attraction.
 * Segment-index matching alone won't catch POIs placed at arbitrary points along a leg.
 */
function consolidateStops(stops: SuggestedStop[]): SuggestedStop[] {
  if (stops.length <= 1) return stops;

  const consolidated: SuggestedStop[] = [];
  let i = 0;

  while (i < stops.length) {
    const current = stops[i];
    const next = stops[i + 1];

    if (next && current.afterSegmentIndex === next.afterSegmentIndex) {
      // Merge stops at the same location - prioritize fuel and overnight
      const merged: SuggestedStop = {
        ...current,
        id: `merged-${current.id}-${next.id}`,
        type: current.type === 'fuel' || next.type === 'fuel' ? 'fuel' :
              current.type === 'overnight' || next.type === 'overnight' ? 'overnight' : current.type,
        reason: `${current.reason}. Also: ${next.reason}`,
        duration: Math.max(current.duration, next.duration),
        priority: current.priority === 'required' || next.priority === 'required' ? 'required' :
                  current.priority === 'recommended' || next.priority === 'recommended' ? 'recommended' : 'optional',
        details: { ...current.details, ...next.details },
      };
      consolidated.push(merged);
      i += 2;
    } else {
      consolidated.push(current);
      i++;
    }
  }

  return consolidated;
}

/**
 * Get stop icon emoji
 */
export function getStopIcon(type: StopType): string {
  switch (type) {
    case 'fuel': return '⛽';
    case 'rest': return '☕';
    case 'meal': return '🍽️';
    case 'overnight': return '🏨';
    default: return '📍';
  }
}

/**
 * Get stop color scheme
 */
export function getStopColors(type: StopType): { bg: string; border: string; text: string } {
  switch (type) {
    case 'fuel':
      return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' };
    case 'rest':
      return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' };
    case 'meal':
      return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' };
    case 'overnight':
      return { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' };
    default:
      return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700' };
  }
}

/**
 * Convert settings to config
 */
export function createStopConfig(
  vehicle: Vehicle,
  settings: TripSettings
): StopSuggestionConfig {
  // Convert to metric if needed
  const tankSizeLitres = settings.units === 'metric'
    ? vehicle.tankSize
    : vehicle.tankSize * 3.78541;

  const fuelEconomyL100km = settings.units === 'metric'
    ? vehicle.fuelEconomyHwy * 0.8 + vehicle.fuelEconomyCity * 0.2
    : (235.215 / vehicle.fuelEconomyHwy) * 0.8 + (235.215 / vehicle.fuelEconomyCity) * 0.2;

  return {
    tankSizeLitres,
    fuelEconomyL100km,
    maxDriveHoursPerDay: settings.maxDriveHours,
    numDrivers: settings.numDrivers,
    departureTime: new Date(`${settings.departureDate}T${settings.departureTime}`),
    gasPrice: settings.gasPrice,
    stopFrequency: settings.stopFrequency,
  };
}
