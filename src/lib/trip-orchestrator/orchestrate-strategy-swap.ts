import type { Location, Vehicle, TripSettings, TripSummary } from '../../types';
import type { StrategicFuelStop } from '../calculations';
import type { SuggestedStop } from '../stop-suggestion-types';
import type { CanonicalTripTimeline } from '../canonical-trip';
import { generateSmartStops, createStopConfig } from '../stop-suggestions';
import { buildTimedTimeline } from '../trip-timeline';
import { applyComboOptimization } from '../stop-consolidator';

import {
  getRoundTripDayTripStayMinutes,
  projectFuelStopsFromSimulation,
  assembleCanonicalTimeline
} from './orchestrator-helpers';

/** Rebuild canonical timeline + fuel stops after switching a named route strategy.
 *  The summary is already built by buildStrategyUpdate — this just re-runs the
 *  fast synchronous pipeline (generateSmartStops → buildTimedTimeline).
 *
 *  Pass `externalStops` to merge user-added POI stops into the timeline so they
 *  appear in both the itinerary view and the print output. */
export function orchestrateStrategySwap(
  updatedSummary: TripSummary,
  settings: TripSettings,
  vehicle: Vehicle,
  locations: Location[],
  roundTripMidpoint: number | undefined,
  externalStops?: SuggestedStop[],
): { canonicalTimeline: CanonicalTripTimeline; projectedFuelStops: StrategicFuelStop[] } {
  const tripDays = updatedSummary.days ?? [];
  const smartStops = generateSmartStops(
    updatedSummary.segments,
    createStopConfig(vehicle, settings, updatedSummary.fullGeometry, updatedSummary.segments[0]?.from.lng),
    tripDays,
  );
  const destinationStayMinutes = getRoundTripDayTripStayMinutes(updatedSummary, tripDays.length, settings);
  const timedRaw = buildTimedTimeline(
    updatedSummary.segments,
    [...smartStops, ...(externalStops ?? [])],
    settings,
    roundTripMidpoint, destinationStayMinutes, tripDays,
  );
  const canonicalTimeline = assembleCanonicalTimeline(
    applyComboOptimization(timedRaw), tripDays, updatedSummary,
    { locations: [...locations], vehicle, settings },
  );
  return { canonicalTimeline, projectedFuelStops: projectFuelStopsFromSimulation(smartStops) };
}
