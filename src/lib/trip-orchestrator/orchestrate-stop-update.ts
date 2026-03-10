import type { Location, Vehicle, TripSettings, TripSummary, StopType } from '../../types';
import { calculateArrivalTimes } from '../calculations';
import { splitTripByDays, calculateCostBreakdown, getBudgetStatus } from '../budget';
import { generateSmartStops, createStopConfig } from '../stop-suggestions';
import { buildTimedTimeline } from '../trip-timeline';
import { applyComboOptimization } from '../stop-consolidator';

import type { StopUpdateResult } from './orchestrator-types';
import {
  getRoundTripDayTripStayMinutes,
  projectFuelStopsFromSimulation,
  assembleCanonicalTimeline
} from './orchestrator-helpers';

/** Recalculate trip after changing a segment's stop type. Pure — no React state. */
export function orchestrateStopUpdate(
  localSummary: TripSummary,
  segmentIndex: number,
  newStopType: StopType,
  settings: TripSettings,
  vehicle: Vehicle,
  locations: Location[],
  roundTripMidpoint: number | undefined,
): StopUpdateResult {
  const updatedSegments = localSummary.segments.map((seg, idx) =>
    idx === segmentIndex ? { ...seg, stopType: newStopType } : seg
  );

  const segmentsWithTimes = calculateArrivalTimes(
    updatedSegments, settings.departureDate, settings.departureTime,
  );

  const updatedDays = splitTripByDays(
    segmentsWithTimes, settings,
    settings.departureDate, settings.departureTime,
    roundTripMidpoint, localSummary.fullGeometry,
  );

  const updatedCostBreakdown = updatedDays.length > 0
    ? calculateCostBreakdown(updatedDays, settings.numTravelers)
    : localSummary.costBreakdown;

  const updatedSummary: TripSummary = {
    ...localSummary,
    segments: segmentsWithTimes,
    days: updatedDays,
    costBreakdown: updatedCostBreakdown,
    budgetStatus: updatedCostBreakdown
      ? getBudgetStatus(settings.budget, updatedCostBreakdown)
      : localSummary.budgetStatus,
    budgetRemaining: updatedCostBreakdown
      ? settings.budget.total - updatedCostBreakdown.total
      : localSummary.budgetRemaining,
  };

  const refreshedSmartStops = generateSmartStops(
    segmentsWithTimes,
    createStopConfig(vehicle, settings, localSummary.fullGeometry, localSummary.segments[0]?.from.lng),
    updatedDays,
  );

  const destinationStayMinutes = getRoundTripDayTripStayMinutes(updatedSummary, updatedDays.length, settings);

  const refreshedTimeline = buildTimedTimeline(
    segmentsWithTimes, refreshedSmartStops, settings,
    roundTripMidpoint, destinationStayMinutes, updatedDays,
  );

  const canonicalTimeline = assembleCanonicalTimeline(
    applyComboOptimization(refreshedTimeline), updatedDays, updatedSummary,
    { locations: [...locations], vehicle, settings },
  );

  return {
    updatedSummary,
    canonicalTimeline,
    projectedFuelStops: projectFuelStopsFromSimulation(refreshedSmartStops),
  };
}
