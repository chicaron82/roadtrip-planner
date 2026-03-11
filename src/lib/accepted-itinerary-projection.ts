import type { TripDay, TripSettings, Vehicle } from '../types';
import type { AcceptedItineraryInput } from './canonical-trip';
import type { SuggestedStop } from './stop-suggestions';
import { assignDrivers, extractFuelStopIndices } from './driver-rotation';
import { buildAcceptedItineraryTimeline } from './accepted-itinerary-timeline';
import { buildDayPlacementMaps, type DayStartEntry } from './day-placement-maps';
import { buildSimulationItems } from './timeline-simulation';
import type { AcceptedItineraryRouteSummary } from './trip-summary-slices';

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
  summary: AcceptedItineraryRouteSummary;
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
      // Use immediate next day (not next driving day) — free days get their own
      // overnight entry, so using nextDriving would span across free days and
      // over-count nights on the driving day before the free stay.
      const nextDay = days[index + 1];
      if (!nextDay) return;

      const nights = Math.round(
        (new Date(nextDay.date + 'T00:00:00').getTime() - new Date(day.date + 'T00:00:00').getTime())
        / (1000 * 60 * 60 * 24),
      );
      if (nights > 0) overnightNightsByDay.set(day.dayNumber, nights);
    });
  }

  let driverRotation: ReturnType<typeof assignDrivers> | null = null;
  if (settings.numDrivers > 1) {
    const fuelIndices = extractFuelStopIndices(simulationItems);
    const flatSegments: typeof summary.segments = [];
    const intentRotationIndices: number[] = [];

    if (days) {
      days.forEach(day => {
        if (day.segmentIndices.length > 0) {
          day.segments.forEach(seg => {
            const intent = seg.to?.intent;
            if (intent && (intent.fuel || intent.meal || intent.overnight)) {
              intentRotationIndices.push(flatSegments.length);
            }
            flatSegments.push(seg);
          });
        }
      });
    } else {
      summary.segments.forEach((seg, idx) => {
        const intent = seg.to?.intent;
        if (intent && (intent.fuel || intent.meal || intent.overnight)) {
          intentRotationIndices.push(idx);
        }
        flatSegments.push(seg);
      });
    }

    driverRotation = assignDrivers(flatSegments, settings.numDrivers, fuelIndices, intentRotationIndices);
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