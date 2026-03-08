import type { TripDay, TripSettings, TripSummary, Vehicle } from '../types';
import type { AcceptedItineraryInput } from './canonical-trip';
import type { SuggestedStop } from './stop-suggestions';
import { assignDrivers, extractFuelStopIndices } from './driver-rotation';
import { buildAcceptedItineraryTimeline } from './accepted-itinerary-timeline';
import { buildDayPlacementMaps, type DayStartEntry } from './day-placement-maps';
import { buildSimulationItems } from './timeline-simulation';

export interface AcceptedItineraryProjection {
  acceptedItinerary: AcceptedItineraryInput;
  simulationItems: ReturnType<typeof buildSimulationItems>;
  overnightNightsByDay: Map<number, number>;
  driverRotation: ReturnType<typeof assignDrivers> | null;
  driverBySegment: Map<number, number>;
  dayStartMap: Map<number, DayStartEntry[]>;
  freeDaysAfterSegment: Map<number, TripDay[]>;
}

interface BuildAcceptedItineraryProjectionParams {
  summary: TripSummary;
  settings: TripSettings;
  vehicle?: Vehicle;
  days?: TripDay[];
  startTime: Date;
  activeSuggestions: SuggestedStop[];
}

export function buildAcceptedItineraryProjection({
  summary,
  settings,
  vehicle,
  days,
  startTime,
  activeSuggestions,
}: BuildAcceptedItineraryProjectionParams): AcceptedItineraryProjection {
  const tripDays = days ?? summary.days ?? [];
  const acceptedItinerary = buildAcceptedItineraryTimeline({
    summary,
    settings,
    tripDays,
    startTime,
    activeSuggestions,
  });

  const simulationItems = buildSimulationItems({
    summary,
    settings,
    vehicle,
    days,
    startTime,
    activeSuggestions,
    precomputedEvents: acceptedItinerary.events,
  });

  const overnightNightsByDay = new Map<number, number>();
  if (days) {
    days.forEach((day, index) => {
      if (!day.overnight) return;
      const nextDriving = days.slice(index + 1).find(nextDay => nextDay.segmentIndices.length > 0);
      if (!nextDriving) return;

      const nights = Math.round(
        (new Date(nextDriving.date + 'T00:00:00').getTime() - new Date(day.date + 'T00:00:00').getTime())
        / (1000 * 60 * 60 * 24),
      );
      if (nights > 0) overnightNightsByDay.set(day.dayNumber, nights);
    });
  }

  let driverRotation: ReturnType<typeof assignDrivers> | null = null;
  if (settings.numDrivers > 1) {
    const fuelIndices = extractFuelStopIndices(simulationItems);
    const flatSegments = [];
    if (days) {
      days.forEach(day => {
        if (day.segmentIndices.length > 0) {
          flatSegments.push(...day.segments);
        }
      });
    } else {
      flatSegments.push(...summary.segments);
    }

    driverRotation = assignDrivers(flatSegments, settings.numDrivers, fuelIndices);
  }

  const driverBySegment = driverRotation
    ? new Map(driverRotation.assignments.map(assignment => [assignment.segmentIndex, assignment.driver]))
    : new Map<number, number>();

  const { dayStartMap, freeDaysAfterSegment } = buildDayPlacementMaps(acceptedItinerary.days, 'flat');

  return {
    acceptedItinerary,
    simulationItems,
    overnightNightsByDay,
    driverRotation,
    driverBySegment,
    dayStartMap,
    freeDaysAfterSegment,
  };
}