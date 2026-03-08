import { useMemo } from 'react';
import type { TripSummary, TripSettings, Vehicle, TripDay } from '../../types';
import type { AcceptedItineraryInput } from '../../lib/canonical-trip';
import { assignDrivers, extractFuelStopIndices } from '../../lib/driver-rotation';
import { buildAcceptedItineraryTimeline } from '../../lib/accepted-itinerary-timeline';
import { buildSimulationItems } from '../../lib/timeline-simulation';
import type { SuggestedStop } from '../../lib/stop-suggestions';

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
  simulationItems: ReturnType<typeof buildSimulationItems>;
  overnightNightsByDay: Map<number, number>;
  driverRotation: ReturnType<typeof assignDrivers> | null;
  driverBySegment: Map<number, number>;
  dayStartMap: Map<number, { day: TripDay; isFirst: boolean }[]>;
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
  const tripDays = days ?? summary.days ?? [];

  const acceptedItinerary = useMemo(() => buildAcceptedItineraryTimeline({
    summary,
    settings,
    tripDays,
    startTime,
    activeSuggestions,
  }), [summary, settings, tripDays, startTime, activeSuggestions]);

  const simulationItems = useMemo(() => buildSimulationItems({
    summary,
    settings,
    vehicle,
    days,
    startTime,
    activeSuggestions,
    precomputedEvents: acceptedItinerary.events,
  }), [summary, settings, vehicle, days, startTime, activeSuggestions, acceptedItinerary.events]);

  const overnightNightsByDay = useMemo(() => {
    const map = new Map<number, number>();
    if (!days) return map;

    days.forEach((day, index) => {
      if (!day.overnight) return;
      const nextDriving = days.slice(index + 1).find(nextDay => nextDay.segmentIndices.length > 0);
      if (nextDriving) {
        const nights = Math.round(
          (new Date(nextDriving.date + 'T00:00:00').getTime() - new Date(day.date + 'T00:00:00').getTime())
          / (1000 * 60 * 60 * 24),
        );
        if (nights > 0) map.set(day.dayNumber, nights);
      }
    });

    return map;
  }, [days]);

  const driverRotation = useMemo(() => {
    if (settings.numDrivers <= 1) return null;

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

    return assignDrivers(flatSegments, settings.numDrivers, fuelIndices);
  }, [summary.segments, settings.numDrivers, simulationItems, days]);

  const driverBySegment = useMemo(() => {
    if (!driverRotation) return new Map<number, number>();
    return new Map(driverRotation.assignments.map(assignment => [assignment.segmentIndex, assignment.driver]));
  }, [driverRotation]);

  const drivingDayFlatBounds = useMemo(() => {
    const bounds = new Map<number, { start: number; end: number }>();
    let nextFlatIndex = 0;

    acceptedItinerary.days.forEach(day => {
      if (day.meta.segmentIndices.length === 0) return;
      const start = nextFlatIndex;
      const end = start + Math.max(day.meta.segments.length - 1, 0);
      bounds.set(day.meta.dayNumber, { start, end });
      nextFlatIndex += day.meta.segments.length;
    });

    return bounds;
  }, [acceptedItinerary.days]);

  const dayStartMap = useMemo(() => {
    const map = new Map<number, { day: TripDay; isFirst: boolean }[]>();
    const firstDrivingDayNumber = acceptedItinerary.days.find(day => day.meta.segmentIndices.length > 0)?.meta.dayNumber;

    acceptedItinerary.days.forEach(day => {
      if (day.meta.segmentIndices.length === 0) return;
      const startEvent = day.events.find(event =>
        (event.type === 'waypoint' || event.type === 'arrival') && event.flatIndex !== undefined,
      );
      const fallback = drivingDayFlatBounds.get(day.meta.dayNumber)?.start;
      const flatIndex = startEvent?.flatIndex ?? fallback;
      if (flatIndex === undefined) return;

      const existing = map.get(flatIndex) ?? [];
      map.set(flatIndex, [...existing, { day: day.meta, isFirst: day.meta.dayNumber === firstDrivingDayNumber }]);
    });

    return map;
  }, [acceptedItinerary.days, drivingDayFlatBounds]);

  const freeDaysAfterSegment = useMemo(() => {
    const map = new Map<number, TripDay[]>();
    let lastDrivingFlatIndex: number | undefined;

    acceptedItinerary.days.forEach(day => {
      if (day.meta.segmentIndices.length > 0) {
        const lastStopEvent = [...day.events].reverse().find(event =>
          (event.type === 'waypoint' || event.type === 'arrival') && event.flatIndex !== undefined,
        );
        lastDrivingFlatIndex = lastStopEvent?.flatIndex ?? drivingDayFlatBounds.get(day.meta.dayNumber)?.end;
        return;
      }

      if (lastDrivingFlatIndex !== undefined) {
        const existing = map.get(lastDrivingFlatIndex) ?? [];
        map.set(lastDrivingFlatIndex, [...existing, day.meta]);
      }
    });

    return map;
  }, [acceptedItinerary.days, drivingDayFlatBounds]);

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