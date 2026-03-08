import type { Location, TripSummary } from '../types';

export interface TripDayCounts {
  drivingDays: number;
  freeDays: number;
  totalDays: number;
}

export function getTripDayCounts(summary: TripSummary): TripDayCounts {
  const days = summary.days ?? [];
  if (days.length === 0) {
    return { drivingDays: 1, freeDays: 0, totalDays: 1 };
  }

  const drivingDays = days.filter(day => day.segmentIndices.length > 0).length;
  const freeDays = days.filter(day => day.segmentIndices.length === 0).length;

  return {
    drivingDays: drivingDays || 1,
    freeDays,
    totalDays: (drivingDays || 1) + freeDays,
  };
}

export function getPrimaryDestination(summary: TripSummary): Location | undefined {
  const midpointIndex = summary.roundTripMidpoint;
  if (midpointIndex != null && midpointIndex > 0) {
    return summary.segments[midpointIndex - 1]?.to;
  }

  return summary.segments.at(-1)?.to;
}

export function getTripDisplayEndpoints(summary: TripSummary): {
  origin?: Location;
  destination?: Location;
} {
  return {
    origin: summary.segments[0]?.from,
    destination: getPrimaryDestination(summary),
  };
}

export function getExportBudgetBreakdown(summary: TripSummary): {
  fuel: number;
  accommodation: number;
  meals: number;
  misc: number;
} {
  return {
    fuel: summary.costBreakdown?.fuel ?? summary.totalFuelCost ?? 0,
    accommodation: summary.costBreakdown?.accommodation ?? 0,
    meals: summary.costBreakdown?.meals ?? 0,
    misc: summary.costBreakdown?.misc ?? 0,
  };
}