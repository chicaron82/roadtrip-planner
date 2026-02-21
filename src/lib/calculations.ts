import type { RouteSegment, TripSummary, Vehicle, TripSettings } from '../types';
import { analyzeSegments } from './segment-analyzer';
import { haversineDistance } from './poi-ranking';
import { KM_TO_MILES } from './constants';
import {
  getTankSizeLitres,
  getWeightedFuelEconomyL100km,
  estimateGasStops,
} from './unit-conversions';

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

  // Range on full tank (80% usable)
  const rangeKm = (tankSizeLitres * 0.8 / weightedFuelEconomy) * 100;

  // Trigger fuel stop at 20% remaining
  const stopIntervalKm = rangeKm * 0.8;

  const fuelStops: StrategicFuelStop[] = [];
  let currentDistance = 0;
  let currentTime = 0; // minutes

  // Cursor for routeGeometry to avoid recalculating from start
  let routeIndex = 0;
  let currentRouteDistance = 0;

  // Walk through segments to calculate stops
  for (const segment of segments) {
    const segmentStart = currentDistance;
    const segmentEnd = currentDistance + segment.distanceKm;

    // Place fuel stops in this segment — use while loop so mega-segments
    // (longer than 2x safe range) get multiple stops, not just one.
    let lastStopDistance = fuelStops.length > 0
      ? fuelStops[fuelStops.length - 1].distanceFromStart
      : 0;

    while (segmentEnd - lastStopDistance >= stopIntervalKm) {
      const stopDistance = lastStopDistance + stopIntervalKm;

      if (stopDistance >= segmentStart && stopDistance <= segmentEnd) {
        let lat = segment.from.lat;
        let lng = segment.from.lng;

        // Traverse the route geometry until we hit the stopDistance
        while (routeIndex < routeGeometry.length - 1) {
          const p1 = routeGeometry[routeIndex];
          const p2 = routeGeometry[routeIndex + 1];
          const d = haversineDistance(p1[0], p1[1], p2[0], p2[1]);

          if (currentRouteDistance + d >= stopDistance) {
            const progress = d > 0 ? (stopDistance - currentRouteDistance) / d : 0;
            lat = p1[0] + (p2[0] - p1[0]) * progress;
            lng = p1[1] + (p2[1] - p1[1]) * progress;
            break;
          }

          currentRouteDistance += d;
          routeIndex++;
        }

        const progress = (stopDistance - segmentStart) / segment.distanceKm;
        const minutesIntoSegment = segment.durationMinutes * progress;
        const estimatedMinutes = currentTime + minutesIntoSegment;
        const hours = Math.floor(estimatedMinutes / 60);
        const mins = Math.round(estimatedMinutes % 60);
        const timeStr = `${hours}h ${mins}m`;

        const kmSinceLastStop = stopDistance - lastStopDistance;
        const fuelUsedPercent = (kmSinceLastStop / rangeKm) * 100;
        const fuelRemaining = 100 - fuelUsedPercent;

        fuelStops.push({
          lat,
          lng,
          distanceFromStart: stopDistance,
          estimatedTime: timeStr,
          fuelRemaining: Math.max(0, fuelRemaining),
        });
      }

      // Update for next iteration of while loop
      lastStopDistance = fuelStops.length > 0
        ? fuelStops[fuelStops.length - 1].distanceFromStart
        : stopDistance; // Fallback prevents infinite loop
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
  roundTripMidpoint?: number
): RouteSegment[] {
  if (segments.length === 0) return segments;

  // Parse initial departure time
  const initialDateTime = new Date(`${departureDate}T${departureTime}`);
  let currentTime = initialDateTime;

  return segments.map((segment, index) => {
    // If we hit the round trip midpoint, we need to reset the clock to the next day's departure time
    if (roundTripMidpoint !== undefined && index === roundTripMidpoint) {
      const [hours, minutes] = departureTime.split(':').map(Number);
      
      // We assume they spend the night at the destination.
      // Move to the next calendar morning from the current arrival time
      const nextDay = new Date(currentTime);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(hours, minutes, 0, 0);
      currentTime = nextDay;
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
