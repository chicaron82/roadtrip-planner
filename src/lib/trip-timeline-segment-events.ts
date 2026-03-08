import type { ProcessedSegment, RouteSegment, TripDay } from '../types';
import type { SuggestedStop } from './stop-suggestions';
import type { TimedEvent } from './trip-timeline-types';

interface DestinationDwellParams {
  events: TimedEvent[];
  currentTime: Date;
  cumulativeKm: number;
  segments: RouteSegment[];
  roundTripMidpoint: number;
  destinationStayMinutes: number;
  activeTimezone: string;
}

export function emitDestinationDwell({
  events,
  currentTime,
  cumulativeKm,
  segments,
  roundTripMidpoint,
  destinationStayMinutes,
  activeTimezone,
}: DestinationDwellParams): Date {
  const destinationName = segments[roundTripMidpoint - 1]?.to.name ?? 'Destination';
  const arrivalTime = new Date(currentTime);
  const departureTime = new Date(arrivalTime.getTime() + destinationStayMinutes * 60 * 1000);

  events.push({
    id: 'destination-dwell',
    type: 'destination',
    arrivalTime,
    departureTime,
    durationMinutes: destinationStayMinutes,
    distanceFromOriginKm: cumulativeKm,
    locationHint: destinationName,
    stops: [],
    timezone: activeTimezone,
  });

  return departureTime;
}

interface MidStopDriveParams {
  midDrive: SuggestedStop[];
  segKm: number;
  segMin: number;
  driveStartTime: Date;
  emitDrive: (km: number, minutes: number, segIndex: number, subIndex?: number) => void;
  emitStop: (stop: SuggestedStop) => void;
  segIndex: number;
  cumulativeKm: number;
}

export function runDriveWithMidStops({
  midDrive,
  segKm,
  segMin,
  driveStartTime,
  emitDrive,
  emitStop,
  segIndex,
  cumulativeKm,
}: MidStopDriveParams): number {
  let drivenKm = 0;
  let drivenMin = 0;

  for (let midIndex = 0; midIndex < midDrive.length; midIndex++) {
    const stop = midDrive[midIndex];
    const stopTimeMs = stop.estimatedTime ? stop.estimatedTime.getTime() - driveStartTime.getTime() : NaN;
    let fraction = stopTimeMs / (segMin * 60 * 1000);
    if (isNaN(fraction) || fraction <= 0.05 || fraction >= 0.95) {
      fraction = (midIndex + 1) / (midDrive.length + 1);
    }

    const stopKm = segKm * fraction;
    const stopMin = segMin * fraction;
    const driveKm = Math.max(0, stopKm - drivenKm);
    const driveMin = Math.max(0, stopMin - drivenMin);

    if (driveKm > 1) {
      emitDrive(driveKm, driveMin, segIndex, midIndex);
    }

    drivenKm = stopKm;
    drivenMin = stopMin;
    emitStop(stop);
  }

  const remainingKm = segKm - drivenKm;
  const remainingMin = segMin - drivenMin;
  if (remainingKm > 1) {
    emitDrive(remainingKm, remainingMin, segIndex, midDrive.length);
  }

  // Return the correct final cumulative km.  emitDrive (a closure) already
  // advanced the outer cumulativeKm for driven portions; adding segKm to the
  // entry value accounts for any tiny (≤1 km) remainder that was too small
  // to emit as a drive event.
  return cumulativeKm + segKm;
}

interface WaypointOrArrivalParams {
  events: TimedEvent[];
  currentTime: Date;
  cumulativeKm: number;
  activeTimezone: string;
  segment: ProcessedSegment;
  iterSegments: ProcessedSegment[];
  segmentIndex: number;
  originalIndex: number;
  dayStartMap: Map<number, TripDay>;
}

export function emitWaypointOrArrival({
  events,
  currentTime,
  cumulativeKm,
  activeTimezone,
  segment,
  iterSegments,
  segmentIndex,
  originalIndex,
  dayStartMap,
}: WaypointOrArrivalParams): boolean {
  const isLastSegment = segmentIndex === iterSegments.length - 1;
  if (isLastSegment) {
    events.push({
      id: 'arrival',
      type: 'arrival',
      arrivalTime: new Date(currentTime),
      departureTime: new Date(currentTime),
      durationMinutes: 0,
      distanceFromOriginKm: cumulativeKm,
      locationHint: segment.to.name,
      stops: [],
      timezone: activeTimezone,
      segment,
      flatIndex: segmentIndex,
      originalIndex,
    });
    return true;
  }

  const nextSegment = iterSegments[segmentIndex + 1];
  const isTransitBoundary = segment._transitPart && nextSegment?.from?.name === segment.to.name;
  const isDayBoundary = dayStartMap.has(segmentIndex) || dayStartMap.has(segmentIndex + 1);
  if (nextSegment && (!isTransitBoundary || isDayBoundary)) {
    events.push({
      id: `waypoint-${segmentIndex}`,
      type: 'waypoint',
      arrivalTime: new Date(currentTime),
      departureTime: new Date(currentTime),
      durationMinutes: 0,
      distanceFromOriginKm: cumulativeKm,
      locationHint: segment.to.name,
      stops: [],
      timezone: activeTimezone,
      segment,
      flatIndex: segmentIndex,
      originalIndex,
    });
  }

  return false;
}

export function sortBoundaryAfterStops(
  stops: SuggestedStop[],
  useDayFiltering: boolean,
): SuggestedStop[] {
  return [...stops].sort((left, right) => {
    if (useDayFiltering) {
      const leftTime = left.estimatedTime?.getTime() ?? 0;
      const rightTime = right.estimatedTime?.getTime() ?? 0;
      if (leftTime !== rightTime) return leftTime - rightTime;
    }
    const order: Record<string, number> = { fuel: 0, meal: 1, rest: 2, overnight: 3 };
    return (order[left.type] ?? 2) - (order[right.type] ?? 2);
  });
}