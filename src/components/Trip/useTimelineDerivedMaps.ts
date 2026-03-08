import { useMemo } from 'react';
import type { TripSummary, TripSettings, Vehicle, TripDay } from '../../types';
import { assignDrivers, extractFuelStopIndices } from '../../lib/driver-rotation';
import { flattenDrivingSegments } from '../../lib/flatten-driving-segments';
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

export function useTimelineDerivedMaps({
  summary,
  settings,
  vehicle,
  days,
  startTime,
  activeSuggestions,
}: UseTimelineDerivedMapsParams) {
  const simulationItems = useMemo(() => buildSimulationItems({
    summary,
    settings,
    vehicle,
    days,
    startTime,
    activeSuggestions,
  }), [summary, settings, vehicle, days, startTime, activeSuggestions]);

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

  const flatResult = useMemo(
    () => flattenDrivingSegments(summary.segments, days),
    [summary.segments, days],
  );

  const dayStartMap = useMemo(() => {
    const map = new Map<number, { day: TripDay; isFirst: boolean }[]>();
    if (!days) return map;

    const drivingDays = days.filter(day => day.segmentIndices.length > 0);
    if (drivingDays.length > 0) {
      const firstIndex = days.indexOf(drivingDays[0]);
      map.set(0, [{ day: drivingDays[0], isFirst: firstIndex === 0 }]);
    }

    flatResult.dayBoundaries.forEach((day, flatIndex) => {
      const dayIndex = days.indexOf(day);
      const existing = map.get(flatIndex) ?? [];
      map.set(flatIndex, [...existing, { day, isFirst: dayIndex === 0 }]);
    });

    return map;
  }, [days, flatResult]);

  const freeDaysAfterSegment = useMemo(() => {
    const map = new Map<number, TripDay[]>();
    if (!days) return map;

    const dayLastFlat = new Map<number, number>();
    const drivingDays = days.filter(day => day.segmentIndices.length > 0);
    let runningIndex = 0;
    drivingDays.forEach(day => {
      dayLastFlat.set(day.dayNumber, runningIndex + day.segments.length - 1);
      runningIndex += day.segments.length;
    });

    days.forEach(day => {
      if (day.segmentIndices.length > 0) return;
      const dayIndex = days.indexOf(day);
      for (let index = dayIndex - 1; index >= 0; index--) {
        if (days[index].segmentIndices.length > 0) {
          const lastFlat = dayLastFlat.get(days[index].dayNumber);
          if (lastFlat !== undefined) {
            const existing = map.get(lastFlat) ?? [];
            map.set(lastFlat, [...existing, day]);
          }
          break;
        }
      }
    });

    return map;
  }, [days]);

  return {
    simulationItems,
    overnightNightsByDay,
    driverRotation,
    driverBySegment,
    dayStartMap,
    freeDaysAfterSegment,
  };
}