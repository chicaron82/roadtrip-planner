import type { RouteSegment, TripSummary, Vehicle, TripSettings } from '../types';
import { analyzeSegments } from './segment-analyzer';
import { haversineDistance } from './poi-ranking';
import { KM_TO_MILES } from './constants';
import {
  getTankSizeLitres,
  getWeightedFuelEconomyL100km,
  estimateGasStops,
} from './unit-conversions';
import { TRIP_CONSTANTS } from './trip-constants';

// Re-export conversion functions for API compatibility
export {
  convertMpgToL100km,
  convertL100kmToMpg,
  convertLitresToGallons,
  convertGallonsToLitres,
} from './unit-conversions';

export function calculateTripCosts(
  uniqueSegments: RouteSegment[],
  vehicle: Vehicle,
  settings: TripSettings
): TripSummary {
  const totalDistanceKm = uniqueSegments.reduce((acc, seg) => acc + seg.distanceKm, 0);
  const totalDurationMinutes = uniqueSegments.reduce((acc, seg) => acc + seg.durationMinutes, 0);

  const weightedFuelEconomy = getWeightedFuelEconomyL100km(vehicle, settings.units);

  const totalFuelLitres = (totalDistanceKm / 100) * weightedFuelEconomy;
  const totalFuelCost = totalFuelLitres * settings.gasPrice;

  const tankSizeLitres = getTankSizeLitres(vehicle, settings.units);

  const gasStops = estimateGasStops(totalFuelLitres, tankSizeLitres);

  const costPerPerson =
    settings.numTravelers > 0 ? totalFuelCost / settings.numTravelers : totalFuelCost;

  const drivingDays = Math.ceil(
    totalDurationMinutes / 60 / settings.maxDriveHours
  );
  
  // Calculate per-segment costs
  const segmentsWithCost = uniqueSegments.map(segment => ({
      ...segment,
      fuelNeededLitres: (segment.distanceKm / 100) * weightedFuelEconomy,
      fuelCost: ((segment.distanceKm / 100) * weightedFuelEconomy) * settings.gasPrice
  }));

  // Analyze segments for warnings, timezone crossings, etc.
  const analyzedSegments = analyzeSegments(segmentsWithCost);

  // NOTE: Round trip multiplier is applied in App.tsx after day splitting
  // Don't apply it here to avoid double multiplication

  return {
    totalDistanceKm: totalDistanceKm,
    totalDurationMinutes: totalDurationMinutes,
    totalFuelLitres: totalFuelLitres,
    totalFuelCost: totalFuelCost,
    gasStops: gasStops,
    costPerPerson: costPerPerson,
    drivingDays: drivingDays,
    segments: analyzedSegments, // Segments with intelligence (warnings, timezone, etc.)
    fullGeometry: []
  };
}

export function formatDistance(km: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') {
    return `${(km * KM_TO_MILES).toFixed(1)} mi`;
  }
  return `${km.toFixed(1)} km`;
}

export function formatCurrency(amount: number, currency: 'CAD' | 'USD'): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

/** Simple $-prefix format for print views that don't need locale awareness. */
export function formatCurrencySimple(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Calculate strategic fuel stops along the route
 * Returns coordinates where fuel stops are recommended
 */
export interface StrategicFuelStop {
  lat: number;
  lng: number;
  distanceFromStart: number;
  estimatedTime: string;
  fuelRemaining: number; // percentage
  /** OSM station name / brand (populated after snap) */
  stationName?: string;
  /** City or place name from OSM addr tags (populated after snap) */
  stationAddress?: string;
  /** true when no real gas station was found within 3 km */
  isRemote?: boolean;
}

export function calculateStrategicFuelStops(
  routeGeometry: [number, number][],
  segments: RouteSegment[],
  vehicle: Vehicle,
  settings: TripSettings
): StrategicFuelStop[] {
  if (routeGeometry.length === 0 || segments.length === 0) return [];

  const weightedFuelEconomy = getWeightedFuelEconomyL100km(vehicle, settings.units);
  const tankSizeLitres = getTankSizeLitres(vehicle, settings.units);
  // Full-tank range — used only to compute fuel-remaining context, not to trigger stops
  const rangeKm = (tankSizeLitres / weightedFuelEconomy) * 100;

  // Time-based interval: stop every N hours based on the user's stopFrequency setting.
  // "balanced" = 3.5h, "conservative" = 2.5h, "aggressive" = 4.5h.
  // This means stops land at natural waypoints (towns, highway junctions) rather than
  // at the mathematical fuel-exhaustion point — e.g. Dryden on Winnipeg→Thunder Bay.
  const stopFrequency = settings.stopFrequency ?? 'balanced';
  const stopIntervalMinutes = TRIP_CONSTANTS.stops.comfortRefuel[stopFrequency] * 60;

  // Pre-compute total route driving time so we can detect "last stop" situations.
  // When only ONE more stop is needed between now and the end of the route,
  // center it rather than placing it at the interval mark. This prevents stops
  // from clustering near the destination on short trips (e.g. Toronto → Ottawa:
  // 4h41min with a 3.5h interval would fire near Brockville; centering places
  // it near Kingston — the natural highway service town at the halfway point).
  const totalRouteMinutes = segments.reduce((sum, s) => sum + s.durationMinutes, 0);

  // Safety net: maximum km between fills before the tank runs critically low.
  // Uses the same buffer fractions as the itinerary stop-checker so both systems agree.
  const safeRangeKm = rangeKm * (1 - TRIP_CONSTANTS.stops.buffers[stopFrequency]);

  const fuelStops: StrategicFuelStop[] = [];
  let currentDistance = 0;
  let currentTime = 0;

  // Cursor for routeGeometry to avoid recalculating from start
  let routeIndex = 0;
  let currentRouteDistance = 0;

  // Track the time and distance of the previous fuel stop
  let lastStopTime = 0;
  let lastStopDistance = 0;

  for (const segment of segments) {
    const segStartTime = currentTime;
    const segEndTime = currentTime + segment.durationMinutes;
    const segEndDist = currentDistance + segment.distanceKm;
    const segStartDist = currentDistance;

    // while loop handles segments longer than one stop interval
    while (true) {
      // "Last stop" centering: when only one more time-based stop remains before
      // the end of the route, center it between the last stop and the end instead
      // of firing at the interval mark. This moves the stop from "near the
      // destination" to the natural halfway point — e.g. Kingston instead of
      // Brockville on Toronto → Ottawa (4h41min trip with a 3.5h interval).
      //
      // The centering window is: remaining > interval (one stop left, not zero)
      // AND remaining <= 2×interval (if remaining were > 2×interval, the next
      // stop would fire at interval AND leave room for at least one more after).
      //
      // Using a strict range prevents re-centering on the next loop iteration:
      // after the centered stop fires, remaining drops to ≈ interval/2 which
      // is ≤ interval, so the condition is false and effectiveInterval reverts
      // to the normal interval → nextStopTime overshoots the route end → break.
      // Without the lower bound (remaining > interval), the interval would keep
      // halving on each iteration, causing an infinite loop and OOM.
      //
      // Only applies to the time trigger, not the fuel-safety trigger.
      const remainingFromLastStop = totalRouteMinutes - lastStopTime;
      const isLastTimeStop =
        remainingFromLastStop > stopIntervalMinutes &&
        remainingFromLastStop <= 2 * stopIntervalMinutes;
      const effectiveInterval = isLastTimeStop
        ? remainingFromLastStop / 2
        : stopIntervalMinutes;

      // Time-based trigger: next comfortable stop time (centered when last stop)
      const nextStopTime = lastStopTime + effectiveInterval;
      const timeFraction = segment.durationMinutes > 0
        ? (nextStopTime - segStartTime) / segment.durationMinutes
        : 0;
      const timeBasedDist = segStartDist + timeFraction * segment.distanceKm;

      // Fuel-safety trigger: km at which the tank would hit the critical floor
      const criticalDist = lastStopDistance + safeRangeKm;

      const timeInSegment = nextStopTime <= segEndTime;
      const criticalInSegment = criticalDist < segEndDist;

      if (!timeInSegment && !criticalInSegment) break;

      // Whichever trigger fires first wins.
      // Critical overrides time only when it falls earlier in the segment.
      const stopDistance =
        criticalInSegment && (!timeInSegment || criticalDist < timeBasedDist)
          ? criticalDist
          : timeBasedDist;

      // Walk route geometry forward to stopDistance
      let lat = segment.from.lat;
      let lng = segment.from.lng;
      while (routeIndex < routeGeometry.length - 1) {
        const p1 = routeGeometry[routeIndex];
        const p2 = routeGeometry[routeIndex + 1];
        const d = haversineDistance(p1[0], p1[1], p2[0], p2[1]);
        if (currentRouteDistance + d >= stopDistance) {
          const prog = d > 0 ? (stopDistance - currentRouteDistance) / d : 0;
          lat = p1[0] + (p2[0] - p1[0]) * prog;
          lng = p1[1] + (p2[1] - p1[1]) * prog;
          break;
        }
        currentRouteDistance += d;
        routeIndex++;
      }

      // Actual elapsed trip time at this stop (used to reset the time clock)
      const stopFrac = segment.distanceKm > 0
        ? (stopDistance - segStartDist) / segment.distanceKm
        : 0;
      const actualStopTime = segStartTime + stopFrac * segment.durationMinutes;

      const hours = Math.floor(actualStopTime / 60);
      const mins = Math.round(actualStopTime % 60);

      // Fuel remaining is context info — how much is left at this stop
      const kmSinceLastFuel = stopDistance - lastStopDistance;
      const fuelUsedPercent = (kmSinceLastFuel / rangeKm) * 100;

      fuelStops.push({
        lat,
        lng,
        distanceFromStart: Math.round(stopDistance * 10) / 10,
        estimatedTime: `${hours}h ${mins}m`,
        fuelRemaining: Math.max(0, Math.round(100 - fuelUsedPercent)),
      });

      // Both triggers reset the full clock — driver refuelled here
      lastStopTime = actualStopTime;
      lastStopDistance = stopDistance;
    }

    currentDistance += segment.distanceKm;
    currentTime += segment.durationMinutes;
  }

  return fuelStops;
}

/**
 * Stop duration presets in minutes
 */
export const STOP_DURATIONS = {
  drive: 0,        // No stop - just driving
  fuel: 10,        // ⛽ Quick refuel
  break: 15,       // ☕ Coffee/bathroom break
  quickMeal: 30,   // 🍔 Fast food stop
  meal: 60,        // 🍽️ Sit-down meal
  overnight: 720,  // 🏨 12 hours overnight rest
} as const;

export const STOP_LABELS = {
  drive: 'Driving',
  fuel: '⛽ Fuel Stop',
  break: '☕ Break',
  quickMeal: '🍔 Quick Meal',
  meal: '🍽️ Full Meal',
  overnight: '🏨 Overnight',
} as const;

/**
 * Calculate actual arrival and departure times for each segment
 * Accounts for stop durations and timezone changes
 */
export function calculateArrivalTimes(
  segments: RouteSegment[],
  departureDate: string,
  departureTime: string,
  roundTripMidpoint?: number,
  /** For day trips: minutes to dwell at destination before returning (can be 0).
   *  When defined, the clock advances by this amount instead of jumping to next morning.
   *  When undefined (default), the existing overnight reset behaviour applies. */
  dayTripDwellMinutes?: number,
): RouteSegment[] {
  if (segments.length === 0) return segments;

  // Parse initial departure time
  const initialDateTime = new Date(`${departureDate}T${departureTime}`);
  let currentTime = initialDateTime;

  return segments.map((segment, index) => {
    // At the round-trip midpoint, advance the clock appropriately before the return leg.
    if (roundTripMidpoint !== undefined && index === roundTripMidpoint) {
      if (dayTripDwellMinutes !== undefined) {
        // Day trip: just add the scheduled dwell time (0 = immediate turnaround).
        // The return leg departs from the same day, not the next morning.
        currentTime = new Date(currentTime.getTime() + dayTripDwellMinutes * 60 * 1000);
      } else {
        // Multi-day trip: reset to next morning at departure hour.
        const [hours, minutes] = departureTime.split(':').map(Number);
        const nextDay = new Date(currentTime);
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(hours, minutes, 0, 0);
        currentTime = nextDay;
      }
    }

    // Departure time for this segment is the current time
    const departureTimeForSegment = new Date(currentTime);

    // Add driving duration
    const arrivalTime = new Date(currentTime.getTime() + segment.durationMinutes * 60000);

    // Get stop duration for this segment (defaults to 0 if not set)
    const stopDuration = segment.stopDuration ?? STOP_DURATIONS[segment.stopType ?? 'drive'];

    // Next segment starts after the stop
    currentTime = new Date(arrivalTime.getTime() + stopDuration * 60000);

    return {
      ...segment,
      departureTime: departureTimeForSegment.toISOString(),
      arrivalTime: arrivalTime.toISOString(),
      stopDuration,
      stopType: segment.stopType ?? 'drive',
    };
  });
}

/**
 * Format time for display with timezone
 */
export function formatTime(isoString: string, timezoneAbbr?: string): string {
  const date = new Date(isoString);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');

  const timeStr = `${displayHours}:${displayMinutes} ${period}`;
  return timezoneAbbr ? `${timeStr} ${timezoneAbbr}` : timeStr;
}

/**
 * Get day number for multi-day trips
 */
export function getDayNumber(departureDate: string, currentDate: string): number {
  const start = new Date(departureDate);
  const current = new Date(currentDate);
  const diffDays = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}
