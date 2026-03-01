import type { RouteSegment, TripSummary, Vehicle, TripSettings } from '../types';
import { analyzeSegments } from './segment-analyzer';
import { lngToIANA, parseLocalDateInTZ } from './trip-timezone';
import {
  getTankSizeLitres,
  getWeightedFuelEconomyL100km,
  estimateGasStops,
} from './unit-conversions';
import { getRegionalFuelPrice } from './regional-costs';
import { STOP_DURATIONS } from './fuel-stops';

// Re-export conversion functions for API compatibility
export {
  convertMpgToL100km,
  convertL100kmToMpg,
  convertLitresToGallons,
  convertGallonsToLitres,
} from './unit-conversions';

// Re-export formatting utilities (moved to trip-formatters.ts)
export {
  formatDistance,
  formatCurrency,
  formatCurrencySimple,
  formatDuration,
  formatTime,
  getDayNumber,
} from './trip-formatters';

// Re-export fuel-stop utilities (moved to fuel-stops.ts)
export type { StrategicFuelStop } from './fuel-stops';
export {
  calculateHumanFuelCosts,
  calculateStrategicFuelStops,
  STOP_DURATIONS,
  STOP_LABELS,
} from './fuel-stops';

export function calculateTripCosts(
  uniqueSegments: RouteSegment[],
  vehicle: Vehicle,
  settings: TripSettings
): TripSummary {
  const totalDistanceKm = uniqueSegments.reduce((acc, seg) => acc + seg.distanceKm, 0);
  const totalDurationMinutes = uniqueSegments.reduce((acc, seg) => acc + seg.durationMinutes, 0);

  const weightedFuelEconomy = getWeightedFuelEconomyL100km(vehicle, settings.units);

  // Calculate per-segment costs using regional fuel prices
  const segmentsWithCost = uniqueSegments.map((segment) => {
    // Attempt to get the regional fuel price; fallback to the user's default gas price
    const regionalPrice = getRegionalFuelPrice(segment.to.name, settings.currency) ?? settings.gasPrice;
    
    const fuelNeededLitres = (segment.distanceKm / 100) * weightedFuelEconomy;
    const fuelCost = fuelNeededLitres * regionalPrice;

    return {
      ...segment,
      fuelNeededLitres,
      fuelCost,
    };
  });

  const totalFuelLitres = segmentsWithCost.reduce((acc, seg) => acc + seg.fuelNeededLitres, 0);
  const totalFuelCost = segmentsWithCost.reduce((acc, seg) => acc + seg.fuelCost, 0);

  const tankSizeLitres = getTankSizeLitres(vehicle, settings.units);
  const gasStops = estimateGasStops(totalFuelLitres, tankSizeLitres);

  const costPerPerson =
    settings.numTravelers > 0 ? totalFuelCost / settings.numTravelers : totalFuelCost;

  const drivingDays = Math.ceil(
    totalDurationMinutes / 60 / settings.maxDriveHours
  );

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

  // Parse initial departure time in the origin's local timezone (fixes browser-local-time bug).
  const originIANA = lngToIANA(segments[0].from.lng);
  const initialDateTime = parseLocalDateInTZ(departureDate, departureTime, originIANA);
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


