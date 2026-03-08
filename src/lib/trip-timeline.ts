/**
 * trip-timeline.ts — Timed event builder
 */

import type { RouteSegment, TripSettings, TripDay } from '../types';
import type { SuggestedStop } from './stop-suggestions';
import { lngToIANA, normalizeToIANA, parseLocalDateInTZ } from './trip-timezone';
import { stopTypeToEventType, classifyStops } from './trip-timeline-helpers';
import type { TimedEvent } from './trip-timeline-types';
import { buildSegmentEndKm, createTimelineLocationResolver } from './trip-timeline-location';
import {
  advanceOvernightClock,
  applyDayBoundary,
  buildDrivingDayMetadata,
  buildTimelineIterationPlan,
} from './trip-timeline-day-state';
import {
  emitDestinationDwell,
  emitWaypointOrArrival,
  runDriveWithMidStops,
  sortBoundaryAfterStops,
} from './trip-timeline-segment-events';

// Re-export formatting utilities — many consumers import these from trip-timeline.
export { formatTime, formatDuration } from './trip-timeline-helpers';
export type { TimedEvent, TimedEventType } from './trip-timeline-types';

export function buildTimedTimeline(
  segments: RouteSegment[],
  suggestions: SuggestedStop[],
  settings: TripSettings,
  roundTripMidpoint?: number,
  destinationStayMinutes?: number,
  tripDays?: TripDay[],
  startTimeOverride?: Date,
): TimedEvent[] {
  if (segments.length === 0) return [];

  const events: TimedEvent[] = [];
  let activeTimezone = lngToIANA(segments[0].from.lng);
  let currentTime = startTimeOverride
    ? new Date(startTimeOverride)
    : parseLocalDateInTZ(settings.departureDate, settings.departureTime, activeTimezone);
  let cumulativeKm = 0;
  const emittedIds = new Set<string>();

  const originName = segments[0].from.name;
  const { drivingDayDates, drivingDayDepartures } = buildDrivingDayMetadata(tripDays);

  events.push({
    id: 'departure',
    type: 'departure',
    arrivalTime: new Date(currentTime),
    departureTime: new Date(currentTime),
    durationMinutes: 0,
    distanceFromOriginKm: 0,
    locationHint: originName,
    stops: [],
    timezone: activeTimezone,
  });

  const emitStop = (stop: SuggestedStop) => {
    if (emittedIds.has(stop.id)) return;
    emittedIds.add(stop.id);

    const arr = new Date(currentTime);
    const dep = new Date(arr.getTime() + stop.duration * 60 * 1000);
    const wpName = resolveWaypointName(stop, cumulativeKm);
    events.push({
      id: `event-${stop.id}`,
      type: stopTypeToEventType(stop.type),
      arrivalTime: arr,
      departureTime: dep,
      durationMinutes: stop.duration,
      distanceFromOriginKm: cumulativeKm,
      locationHint: makeLocationHint(cumulativeKm, wpName, stop.hubName),
      stops: [stop],
      timezone: activeTimezone,
    });

    if (stop.type === 'overnight') {
      currentTime = advanceOvernightClock(
        arr,
        activeTimezone,
        settings,
        drivingDayDates,
        drivingDayDepartures,
      );
    } else {
      currentTime = dep;
    }
  };

  const emitDrive = (km: number, minutes: number, segIndex: number, subIndex?: number) => {
    const driveEnd = new Date(currentTime.getTime() + minutes * 60 * 1000);
    const startKm = cumulativeKm;
    cumulativeKm += km;
    const id = subIndex !== undefined ? `drive-${segIndex}-${subIndex}` : `drive-${segIndex}`;
    events.push({
      id,
      type: 'drive',
      arrivalTime: new Date(currentTime),
      departureTime: new Date(driveEnd),
      durationMinutes: minutes,
      distanceFromOriginKm: startKm,
      locationHint: makeLocationHint(startKm),
      segmentDistanceKm: km,
      segmentDurationMinutes: minutes,
      segment: iterSegments[segIndex],
      stops: [],
      timezone: activeTimezone,
    });
    currentTime = driveEnd;
  };

  const {
    iterSegments,
    useDayFiltering,
    dayStartMap,
    currentDayNumber: startingDayNumber,
  } = buildTimelineIterationPlan(segments, tripDays);
  const segEndKm = buildSegmentEndKm(segments);
  const iterSegEndKm = buildSegmentEndKm(iterSegments);
  const { makeLocationHint, resolveWaypointName } = createTimelineLocationResolver(
    originName,
    segments,
    segEndKm,
    iterSegments,
    iterSegEndKm,
  );
  let currentDayNumber = startingDayNumber;

  let prevOrigIdx = -1;
  for (let i = 0; i < iterSegments.length; i++) {
    const seg = iterSegments[i];

    const newDay = dayStartMap.get(i);
    if (newDay) {
      const boundary = applyDayBoundary({
        newDay,
        currentTime,
        cumulativeKm,
        activeTimezone,
        tripDays,
        suggestions,
        events,
        iterSegments,
        segmentIndex: i,
        settings,
        drivingDayDepartures,
      });
      currentDayNumber = boundary.currentDayNumber;
      currentTime = boundary.currentTime;
      events.push(boundary.departureEvent);
    }

    if (!seg._transitPart && seg.timezoneCrossing && seg.timezone) {
      activeTimezone = normalizeToIANA(seg.timezone);
    }

    const origIdx = useDayFiltering ? (seg._originalIndex ?? i) : i;
    if (
      roundTripMidpoint !== undefined &&
      destinationStayMinutes &&
      destinationStayMinutes > 0 &&
      origIdx >= roundTripMidpoint && prevOrigIdx < roundTripMidpoint && prevOrigIdx >= 0
    ) {
      currentTime = emitDestinationDwell({
        events,
        currentTime,
        cumulativeKm,
        segments,
        roundTripMidpoint,
        destinationStayMinutes,
        activeTimezone,
      });
    }
    prevOrigIdx = origIdx;

    const segKm = seg.distanceKm ?? 0;
    const segMin = seg.durationMinutes ?? 0;
    const driveStartTime = new Date(currentTime);
    const driveEndTime = new Date(currentTime.getTime() + segMin * 60 * 1000);

    const isLastDaySegment = (i === iterSegments.length - 1) || dayStartMap.has(i + 1);
    const { boundaryBefore, midDrive, boundaryAfter } = classifyStops({
      suggestions,
      emittedIds,
      driveStartTime,
      driveEndTime,
      useDayFiltering,
      currentDayNumber,
      i,
      iterSegmentsLength: iterSegments.length,
      isLastDaySegment,
    });

    const hasEnRouteForThisSeg = midDrive.some(s => s.type === 'fuel');
    const filteredBoundaryBefore = hasEnRouteForThisSeg
      ? boundaryBefore.filter(s => s.type !== 'fuel')
      : boundaryBefore;

    filteredBoundaryBefore
      .sort((a, b) => (a.type === 'fuel' ? -1 : b.type === 'fuel' ? 1 : 0))
      .forEach(emitStop);

    if (midDrive.length > 0) {
      cumulativeKm = runDriveWithMidStops({
        midDrive,
        segKm,
        segMin,
        driveStartTime,
        emitDrive,
        emitStop,
        segIndex: i,
        cumulativeKm,
      });
    } else {
      emitDrive(segKm, segMin, i);
    }

    if (seg._transitPart) {
      const destTz = lngToIANA(seg.to.lng);
      if (destTz !== activeTimezone) {
        activeTimezone = destTz;
      }
    }

    const isLastSegment = emitWaypointOrArrival({
      events,
      currentTime,
      cumulativeKm,
      activeTimezone,
      segment: seg,
      iterSegments,
      segmentIndex: i,
      originalIndex: origIdx,
      dayStartMap,
    });

    sortBoundaryAfterStops(
      boundaryAfter.filter(s => !emittedIds.has(s.id) && !(isLastSegment && s.type !== 'overnight')),
      useDayFiltering,
    )
      .forEach(emitStop);
  }

  return events;
}
