import { useMemo } from 'react';
import type { TripSummary, TripSettings, Vehicle, TripDay } from '../../types';
import type { AcceptedItineraryInput } from '../../lib/canonical-trip';
import type { AcceptedItineraryProjection } from '../../lib/accepted-itinerary-projection';
import type { DayStartEntry } from '../../lib/day-placement-maps';
import type { SuggestedStop } from '../../lib/stop-suggestions';
import { buildAcceptedItineraryProjection } from '../../lib/accepted-itinerary-projection';

interface UseTimelineDerivedMapsParams {
  summary: TripSummary;
  settings: TripSettings;
  vehicle?: Vehicle;
  days?: TripDay[];
  startTime: Date;
  activeSuggestions: SuggestedStop[];
}

interface UseTimelineDerivedMapsResult {
  acceptedItinerary: AcceptedItineraryInput;
  simulationItems: AcceptedItineraryProjection['simulationItems'];
  overnightNightsByDay: Map<number, number>;
  driverRotation: AcceptedItineraryProjection['driverRotation'];
  driverBySegment: Map<number, number>;
  dayStartMap: Map<number, DayStartEntry[]>;
  freeDaysAfterSegment: Map<number, TripDay[]>;
}

export function useTimelineDerivedMaps({
  summary,
  settings,
  vehicle,
  days,
  startTime,
  activeSuggestions,
}: UseTimelineDerivedMapsParams): UseTimelineDerivedMapsResult {
  const projection = useMemo(() => buildAcceptedItineraryProjection({
    summary,
    settings,
    vehicle,
    days,
    startTime,
    activeSuggestions,
  }), [summary, settings, vehicle, days, startTime, activeSuggestions]);

  return {
    acceptedItinerary: projection.acceptedItinerary,
    simulationItems: projection.simulationItems,
    overnightNightsByDay: projection.overnightNightsByDay,
    driverRotation: projection.driverRotation,
    driverBySegment: projection.driverBySegment,
    dayStartMap: projection.dayStartMap,
    freeDaysAfterSegment: projection.freeDaysAfterSegment,
  };
}