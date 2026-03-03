/**
 * trip-timeline.ts — Timed event builder
 *
 * Converts raw route segments + smart stop suggestions into a clock-annotated
 * sequence of events: departure → drive → stop → drive → ... → arrival.
 *
 * This is pure data transformation — no React, no I/O. Easy to test.
 *
 * 💚 My Experience Engine
 */

import type { RouteSegment, TripSettings, TripDay, ProcessedSegment } from '../types';
import type { SuggestedStop } from './stop-suggestions';
import { lngToIANA, normalizeToIANA, parseLocalDateInTZ, formatDateInZone } from './trip-timezone';
import { stopTypeToEventType, classifyStops } from './trip-timeline-helpers';

// Re-export formatting utilities — many consumers import these from trip-timeline.
export { formatTime, formatDuration } from './trip-timeline-helpers';

export type TimedEventType =
  | 'departure'
  | 'drive'
  | 'fuel'
  | 'meal'
  | 'rest'
  | 'overnight'
  | 'waypoint'
  | 'arrival'
  | 'combo'       // merged fuel + meal (or fuel + rest)
  | 'destination'; // day-trip dwell stop at the round-trip turnaround point

export interface TimedEvent {
  id: string;
  type: TimedEventType;
  arrivalTime: Date;
  departureTime: Date;
  durationMinutes: number;

  // Position on route
  distanceFromOriginKm: number;

  // Human label — either a waypoint name or a distance hint
  locationHint: string;

  // For drive segments
  segmentDistanceKm?: number;
  segmentDurationMinutes?: number;

  // For stops — original SuggestedStop(s) that sourced this event
  stops: SuggestedStop[];

  /**
   * IANA timezone active at this stop (e.g. 'America/Toronto').
   * Used by SmartTimeline to display times in local destination time
   * rather than the user's browser timezone. Set to the origin's timezone
   * for all events before the first crossing, then updated on each boundary.
   */
  timezone: string;

  // Combo metadata (set by stop-consolidator)
  timeSavedMinutes?: number;
  comboLabel?: string; // e.g. "Fuel + Lunch"

  // UI bridge fields — populated for 'waypoint' and 'arrival' events so the
  // SimulationItems adapter can build SimulationItem without re-deriving data.
  segment?: RouteSegment;
  flatIndex?: number;
  originalIndex?: number;
}



/**
 * Build a flat list of timed events for a route.
 *
 * Key design:
 *   1. Stops are placed by their `estimatedTime`, not just `afterSegmentIndex`.
 *      For single-segment routes (e.g. Winnipeg → Thunder Bay, 700km), all stops
 *      share the same afterSegmentIndex but have different estimatedTimes.
 *   2. Long drives are SPLIT around mid-segment stops:
 *        700km drive + fuel at km 487 →
 *        drive 487km → fuel 15min → drive 213km
 *   3. Overnight stops advance clock to next morning departure time (not +8h).
 *   4. Each stop is emitted at most once (tracked by ID).
 *
 * @param segments    Route segments from TripSummary
 * @param suggestions All smart stop suggestions (accepted + pending)
 * @param settings    Trip settings (departure date/time, etc.)
 * @param _vehicle    Vehicle (reserved for future use)
 */
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

  // Determine origin IANA timezone from the departure location's longitude.
  // This fixes `new Date('YYYY-MMDDThh:mm')` being parsed in browser local time.
  let activeTimezone = lngToIANA(segments[0].from.lng);

  // Parse the departure time in the ORIGIN's timezone (not browser local).
  // startTimeOverride lets callers (e.g. the SimulationItems adapter) supply a
  // pre-computed timezone-correct start time rather than re-deriving it here.
  let currentTime = startTimeOverride
    ? new Date(startTimeOverride)
    : parseLocalDateInTZ(settings.departureDate, settings.departureTime, activeTimezone);
  let cumulativeKm = 0;
  const emittedIds = new Set<string>();

  const originName = segments[0].from.name;

  // Build an ordered list of driving-day departure dates for overnight advancement.
  // When a free day sits between two driving days, the overnight handler needs
  // to skip past it rather than just advancing +1 calendar day.
  const drivingDayDates: string[] = [];
  // Maps date → planned departure UTC ISO time from TripDay.totals.departureTime.
  // Used by the overnight handler to match the budget engine's computed departure
  // (which accounts for targetArrivalHour) rather than settings.departureTime.
  const drivingDayDepartures = new Map<string, string>();
  if (tripDays) {
    for (const d of tripDays) {
      if (d.segmentIndices.length > 0) {
        drivingDayDates.push(d.date);
        if (d.totals?.departureTime) {
          drivingDayDepartures.set(d.date, d.totals.departureTime);
        }
      }
    }
  }

  // Pre-compute cumulative km at the END of each segment (index-aligned).
  // Used to detect when a stop falls at/near a map waypoint so we can display
  // "Chicago, Illinois" instead of "~1395 km from Winnipeg, Manitoba".
  const segEndKm: number[] = [];
  {
    let acc = 0;
    for (const s of segments) {
      acc += s.distanceKm;
      segEndKm.push(acc);
    }
  }

  /**
   * Build a human-readable location hint for a stop.
   * @param km        Cumulative km from origin at this stop.
   * @param wpName    Explicit waypoint name (segment endpoint) when the stop falls
   *                  at or very close to a known waypoint.
   * @param hubName   Hub city resolved at generation time (e.g. "Fargo, ND").
   *                  Takes precedence over a distance string but yields to a
   *                  named waypoint (which is the actual stop city).
   */
  const makeLocationHint = (km: number, wpName?: string, hubName?: string): string => {
    if (km < 20) return wpName ?? originName;
    if (wpName) return wpName;  // named waypoint always wins
    if (hubName) return `near ${hubName}`;
    const rounded = Math.round(km / 5) * 5;
    return `~${rounded} km from ${originName}`;
  };

  /**
   * Resolve the nearest named waypoint for a SuggestedStop.
   * Three passes:
   *  1. afterSegmentIndex match — stop explicitly tagged to a segment endpoint.
   *  2. Proximity scan over original segment endpoints (20 km window).
   *  3. Proximity scan over sub-segment (iterSegments) endpoints (20 km window).
   *     This catches transit split-points like "Swift Current" or "Golden, BC"
   *     that don't exist in the original 1-segment route.
   */
  const resolveWaypointName = (stop: SuggestedStop, currentKm: number): string | undefined => {
    // Pass 1: stops explicitly tagged to a segment boundary
    const idx = stop.afterSegmentIndex;
    if (idx >= 0 && idx < segments.length) {
      const endKm = segEndKm[idx];
      if (endKm !== undefined && Math.abs(currentKm - endKm) <= 30) {
        return segments[idx].to.name;
      }
    }
    // Pass 2: proximity scan over all original segment endpoints
    for (let i = 0; i < segments.length; i++) {
      if (Math.abs(currentKm - segEndKm[i]) <= 20) {
        return segments[i].to.name;
      }
    }
    // Pass 3: proximity scan over sub-segment endpoints (transit split-points)
    if (iterSegEndKm.length > 0) {
      for (let i = 0; i < iterSegEndKm.length; i++) {
        if (Math.abs(currentKm - iterSegEndKm[i]) <= 20) {
          const name = iterSegments[i]?.to.name;
          if (name && !name.includes('(transit)')) return name;
        }
      }
    }
    return undefined;
  };

  // ── Departure ──────────────────────────────────────────────────────────────
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

  // ── Emit helpers ───────────────────────────────────────────────────────────
  const emitStop = (stop: SuggestedStop) => {
    if (emittedIds.has(stop.id)) return; // dedup
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

    // Overnight: advance to next DRIVING morning (skip free days).
    // A 3-day trip [Drive, Free, Drive] should jump from Day 1 evening
    // straight to Day 3 morning — not Day 2 morning.
    if (stop.type === 'overnight') {
      // Determine the overnight's LOCAL date in the active timezone — browser
      // local time can differ from destination timezone, causing off-by-one
      // day calculations.
      const overnightLocal = formatDateInZone(arr, activeTimezone);
      let daysToAdvance = 1;
      let nextDrivingDate: string | undefined;
      if (drivingDayDates.length > 0) {
        nextDrivingDate = drivingDayDates.find(d => d > overnightLocal);
        if (nextDrivingDate) {
          const overnightDay = new Date(overnightLocal + 'T00:00:00');
          const nextDay = new Date(nextDrivingDate + 'T00:00:00');
          daysToAdvance = Math.round((nextDay.getTime() - overnightDay.getTime()) / 86_400_000);
        }
      }

      // Prefer the budget engine's planned departure time (matches the day card
      // header's Departure field). Falls back to settings.departureTime.
      const plannedDeparture = nextDrivingDate ? drivingDayDepartures.get(nextDrivingDate) : undefined;
      if (plannedDeparture) {
        currentTime = new Date(plannedDeparture);
      } else {
        // Fallback: derive next morning from settings.departureTime in active timezone
        const [dH, dM] = settings.departureTime.split(':').map(Number);
        const nextDateParts = overnightLocal.split('-').map(Number);
        const nextDate = new Date(Date.UTC(nextDateParts[0], nextDateParts[1] - 1, nextDateParts[2] + daysToAdvance));
        const pad = (n: number) => String(n).padStart(2, '0');
        const nextDateStr = `${nextDate.getUTCFullYear()}-${pad(nextDate.getUTCMonth() + 1)}-${pad(nextDate.getUTCDate())}`;
        const nextTimeStr = `${pad(dH ?? 9)}:${pad(dM ?? 0)}`;
        currentTime = parseLocalDateInTZ(nextDateStr, nextTimeStr, activeTimezone);
      }
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

  // ── Dual-path iteration ──────────────────────────────────────────────────
  //
  // When tripDays provides per-day sub-segments (from splitLongSegments),
  // iterate those instead of original segments. Each sub-segment gets its own
  // drive connector and stops are classified by dayNumber instead of
  // afterSegmentIndex — fixing the single-OSRM-segment multi-day case where
  // all sub-segments share _originalIndex 0.
  //
  // Without tripDays, fall back to original segments (simple day trips).
  let iterSegments: ProcessedSegment[];
  let useDayFiltering = false;
  const dayStartMap = new Map<number, TripDay>();
  let currentDayNumber = 1;

  if (tripDays) {
    const drivingDays = tripDays.filter(d => d.segmentIndices.length > 0);
    // Only use day-filtering when tripDays contain actual sub-segments.
    // Some callers provide tripDays for overnight-advancement only (empty segments[]).
    const hasPopulatedSegments = drivingDays.some(d => d.segments.length > 0);
    if (drivingDays.length > 0 && hasPopulatedSegments) {
      iterSegments = drivingDays.flatMap(d => d.segments);
      useDayFiltering = true;
      currentDayNumber = drivingDays[0].dayNumber;
      let flatIdx = 0;
      drivingDays.forEach((day, dayI) => {
        if (dayI > 0) dayStartMap.set(flatIdx, day);
        flatIdx += day.segments.length;
      });
    } else {
      iterSegments = segments.map((s, idx) => ({ ...s, _originalIndex: idx }));
    }
  } else {
    iterSegments = segments.map((s, idx) => ({ ...s, _originalIndex: idx }));
  }

  // Build cumulative km at the END of each iter-segment (for sub-segment
  // waypoint resolution — transit split-points like "Swift Current, SK").
  const iterSegEndKm: number[] = [];
  {
    let acc = 0;
    for (const s of iterSegments) {
      acc += s.distanceKm;
      iterSegEndKm.push(acc);
    }
  }

  // ── Segment loop ───────────────────────────────────────────────────────────
  let prevOrigIdx = -1;
  for (let i = 0; i < iterSegments.length; i++) {
    const seg = iterSegments[i];

    // ── Day boundary handling ─────────────────────────────────────────────
    const newDay = dayStartMap.get(i);
    if (newDay) {
      currentDayNumber = newDay.dayNumber;

      // Fallback clock reset: advance to this day's planned departure if an
      // overnight stop wasn't emitted to advance the clock (e.g. when callers
      // pass only accepted non-overnight suggestions, or in tests with no stops).
      // When an overnight stop DID fire, currentTime is already at next-morning
      // departure (or later), so the `>` guard makes this a no-op.
      const plannedDep = drivingDayDepartures.get(newDay.date);
      if (plannedDep) {
        const depTime = new Date(plannedDep);
        if (depTime > currentTime) currentTime = depTime;
      } else {
        const [dH, dM] = settings.departureTime.split(':').map(Number);
        const nextDate = new Date(newDay.date + 'T00:00:00');
        nextDate.setHours(dH ?? 9, dM ?? 0, 0, 0);
        if (nextDate > currentTime) currentTime = nextDate;
      }

      // Resolve a clean departure location name.
      // Prefer the previous segment's TO name (same physical point, usually hub-resolved).
      // Strip unsnapped "CityA → CityB" patterns and "(transit)" labels from fallback names.
      const prevSeg = i > 0 ? iterSegments[i - 1] : null;
      const prevToClean = prevSeg?.to.name &&
        !prevSeg.to.name.includes('(transit)') &&
        !prevSeg.to.name.includes(' → ');
      let departLocation = prevToClean ? prevSeg!.to.name : seg.from.name;
      if (departLocation.includes(' → ')) departLocation = departLocation.split(' → ')[0].trim();
      departLocation = departLocation.replace(/\s*\(transit\)/, '');

      // Emit a departure event for transit days 2+ so the timeline shows
      // "🚗 Depart [City]" at each new driving day's start.
      events.push({
        id: `departure-day${newDay.dayNumber}`,
        type: 'departure',
        arrivalTime: new Date(currentTime),
        departureTime: new Date(currentTime),
        durationMinutes: 0,
        distanceFromOriginKm: cumulativeKm,
        locationHint: departLocation,
        stops: [],
        timezone: activeTimezone,
      });
    }

    // Update timezone for explicit crossings on non-sub-segments at segment start.
    // Transit sub-segment timezone is updated AFTER the drive (based on destination)
    // so that overnight, fuel, and rest stops use the correct arrival timezone.
    if (!seg._transitPart && seg.timezoneCrossing && seg.timezone) {
      activeTimezone = normalizeToIANA(seg.timezone);
    }

    // ── Day-trip destination dwell ──────────────────────────────────────────
    // At the round-trip midpoint, inject a "Time at [Destination]" stop.
    // Detect via _originalIndex crossing rather than loop index (handles sub-segments).
    const origIdx = useDayFiltering ? (seg._originalIndex ?? i) : i;
    if (
      roundTripMidpoint !== undefined &&
      destinationStayMinutes &&
      destinationStayMinutes > 0 &&
      origIdx >= roundTripMidpoint && prevOrigIdx < roundTripMidpoint && prevOrigIdx >= 0
    ) {
      const destName = segments[roundTripMidpoint - 1]?.to.name ?? 'Destination';
      const arr = new Date(currentTime);
      const dep = new Date(arr.getTime() + destinationStayMinutes * 60 * 1000);
      events.push({
        id: 'destination-dwell',
        type: 'destination',
        arrivalTime: arr,
        departureTime: dep,
        durationMinutes: destinationStayMinutes,
        distanceFromOriginKm: cumulativeKm,
        locationHint: destName,
        stops: [],
        timezone: activeTimezone,
      });
      currentTime = dep;
    }
    prevOrigIdx = origIdx;

    const segKm = seg.distanceKm ?? 0;
    const segMin = seg.durationMinutes ?? 0;

    // Compute the time window for this sub-segment's pure driving time.
    const driveStartTime = new Date(currentTime);
    const driveEndTime = new Date(currentTime.getTime() + segMin * 60 * 1000);

    // ── Classify all non-emitted suggestions for this segment ────────────
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

    // ── Pre-segment boundary stops ────────────────────────────────────────
    const hasEnRouteForThisSeg = midDrive.some(s => s.type === 'fuel');
    const filteredBoundaryBefore = hasEnRouteForThisSeg
      ? boundaryBefore.filter(s => s.type !== 'fuel')
      : boundaryBefore;

    filteredBoundaryBefore
      .sort((a, b) => (a.type === 'fuel' ? -1 : b.type === 'fuel' ? 1 : 0))
      .forEach(emitStop);

    // ── Drive with mid-stop splitting ─────────────────────────────────────
    if (midDrive.length > 0) {
      let drivenKm = 0;
      let drivenMin = 0;

      for (let m = 0; m < midDrive.length; m++) {
        const stop = midDrive[m];
        const stopTimeMs = stop.estimatedTime ? stop.estimatedTime.getTime() - driveStartTime.getTime() : NaN;
        let fraction = stopTimeMs / (segMin * 60 * 1000);
        if (isNaN(fraction) || fraction <= 0.05 || fraction >= 0.95) {
          fraction = (m + 1) / (midDrive.length + 1);
        }

        const stopKm = segKm * fraction;
        const stopMin = segMin * fraction;

        const driveKm = Math.max(0, stopKm - drivenKm);
        const driveMin = Math.max(0, stopMin - drivenMin);

        if (driveKm > 1) {
          emitDrive(driveKm, driveMin, i, m);
        }

        drivenKm = stopKm;
        drivenMin = stopMin;
        emitStop(stop);
      }

      // Remaining drive after last mid-stop
      const remainKm = segKm - drivenKm;
      const remainMin = segMin - drivenMin;
      if (remainKm > 1) {
        emitDrive(remainKm, remainMin, i, midDrive.length);
      } else {
        cumulativeKm += remainKm;
      }
    } else {
      emitDrive(segKm, segMin, i);
    }

    // ── Post-drive timezone update ────────────────────────────────────────
    // Now that we've arrived at the destination, update to the destination's
    // timezone. This ensures overnight/fuel/rest stops at this location use
    // the correct local time (not the departure city's timezone).
    if (seg._transitPart) {
      const destTz = lngToIANA(seg.to.lng);
      if (destTz !== activeTimezone) {
        activeTimezone = destTz;
      }
    }

    // ── Waypoint / arrival ────────────────────────────────────────────────
    const isLastSegment = i === iterSegments.length - 1;
    if (isLastSegment) {
      events.push({
        id: 'arrival',
        type: 'arrival',
        arrivalTime: new Date(currentTime),
        departureTime: new Date(currentTime),
        durationMinutes: 0,
        distanceFromOriginKm: cumulativeKm,
        locationHint: seg.to.name,
        stops: [],
        timezone: activeTimezone,
        segment: seg,
        flatIndex: i,
        originalIndex: origIdx,
      });
    } else {
      // Suppress waypoints only at transit split-point boundaries — where a
      // single OSRM segment was split into sub-segments (_transitPart=true) and
      // the names happen to match across the boundary. For genuine route waypoints
      // (original segments, or named sub-segment endpoints) always emit.
      const nextSeg = iterSegments[i + 1];
      const isTransitBoundary = seg._transitPart && nextSeg?.from?.name === seg.to.name;
      if (nextSeg && !isTransitBoundary) {
        events.push({
          id: `waypoint-${i}`,
          type: 'waypoint',
          arrivalTime: new Date(currentTime),
          departureTime: new Date(currentTime),
          durationMinutes: 0,
          distanceFromOriginKm: cumulativeKm,
          locationHint: seg.to.name,
          stops: [],
          timezone: activeTimezone,
          segment: seg,
          flatIndex: i,
          originalIndex: origIdx,
        });
      }
    }

    // ── Post-segment boundary stops ───────────────────────────────────────
    // On the final segment, suppress fuel/rest/meal stops that would appear
    // after the Arrive event — you're home, no need to refuel.
    boundaryAfter
      .filter(s => !emittedIds.has(s.id) && !(isLastSegment && s.type !== 'overnight'))
      .sort((a, b) => {
        if (useDayFiltering) {
          // Day mode: sort by estimated time (chronological), type as tiebreaker.
          // Ensures fuel/meal fire before overnight at end of day.
          const timeA = a.estimatedTime?.getTime() ?? 0;
          const timeB = b.estimatedTime?.getTime() ?? 0;
          if (timeA !== timeB) return timeA - timeB;
        }
        const order: Record<string, number> = { fuel: 0, meal: 1, rest: 2, overnight: 3 };
        return (order[a.type] ?? 2) - (order[b.type] ?? 2);
      })
      .forEach(emitStop);
  }

  return events;
}
