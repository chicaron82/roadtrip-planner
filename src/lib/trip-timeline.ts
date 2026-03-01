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

import type { RouteSegment, TripSettings, TripDay } from '../types';
import type { SuggestedStop } from './stop-suggestions';
import { lngToIANA, normalizeToIANA, parseLocalDateInTZ, formatTimeInZone } from './trip-timezone';

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
}

/**
 * Format a Date as "9:00 AM" / "12:15 PM" in the given IANA timezone.
 * Falls back to browser local time when no timezone provided (legacy).
 */
export const formatTime = (d: Date, ianaTimezone?: string): string =>
  formatTimeInZone(d, ianaTimezone);

/**
 * Format a duration in minutes as "1h 15min" / "45 min"
 */
export const formatDuration = (minutes: number): string => {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}min`;
};

/**
 * Map a SuggestedStop type to a TimedEventType.
 */
const stopTypeToEventType = (type: SuggestedStop['type']): TimedEventType => {
  switch (type) {
    case 'fuel': return 'fuel';
    case 'meal': return 'meal';
    case 'rest': return 'rest';
    case 'overnight': return 'overnight';
    default: return 'rest';
  }
};


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
): TimedEvent[] {
  if (segments.length === 0) return [];

  const events: TimedEvent[] = [];

  // Determine origin IANA timezone from the departure location's longitude.
  // This fixes `new Date('YYYY-MMDDThh:mm')` being parsed in browser local time.
  let activeTimezone = lngToIANA(segments[0].from.lng);

  // Parse the departure time in the ORIGIN's timezone (not browser local).
  let currentTime = parseLocalDateInTZ(settings.departureDate, settings.departureTime, activeTimezone);
  let cumulativeKm = 0;
  const emittedIds = new Set<string>();

  const originName = segments[0].from.name;

  // Build an ordered list of driving-day departure dates for overnight advancement.
  // When a free day sits between two driving days, the overnight handler needs
  // to skip past it rather than just advancing +1 calendar day.
  const drivingDayDates: string[] = [];
  if (tripDays) {
    for (const d of tripDays) {
      if (d.segmentIndices.length > 0) {
        drivingDayDates.push(d.date);
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
   * Two passes:
   *  1. afterSegmentIndex match — stop explicitly tagged to a segment endpoint.
   *  2. Proximity scan — any segment endpoint within 20 km of the current km
   *     (catches en-route stops with afterSegmentIndex=-1 that land near a city).
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
    // Pass 2: proximity scan over all segment endpoints
    for (let i = 0; i < segments.length; i++) {
      if (Math.abs(currentKm - segEndKm[i]) <= 20) {
        return segments[i].to.name;
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
      const [dH, dM] = settings.departureTime.split(':').map(Number);
      const nextMorning = new Date(arr);

      // How many calendar days to advance?  Default +1.
      // If we have tripDays info, find the next driving day after the overnight
      // and jump directly to that date.
      let daysToAdvance = 1;
      if (drivingDayDates.length > 0) {
        // Use LOCAL date (not UTC via toISOString) — overnight can arrive after 6 PM
        // in negative-UTC-offset timezones (CST, MST, PST), which would tick the UTC
        // date forward a day and cause drivingDayDates.find() to skip the very next
        // driving day, advancing currentTime too far forward.
        const pad = (n: number) => String(n).padStart(2, '0');
        const overnightDate = `${arr.getFullYear()}-${pad(arr.getMonth() + 1)}-${pad(arr.getDate())}`;
        const nextDrivingDate = drivingDayDates.find(d => d > overnightDate);
        if (nextDrivingDate) {
          const overnightDay = new Date(overnightDate + 'T00:00:00');
          const nextDay = new Date(nextDrivingDate + 'T00:00:00');
          daysToAdvance = Math.round((nextDay.getTime() - overnightDay.getTime()) / 86_400_000);
        }
      }

      nextMorning.setDate(nextMorning.getDate() + daysToAdvance);
      nextMorning.setHours(dH ?? 9, dM ?? 0, 0, 0);
      currentTime = nextMorning;
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
  type TimelineSegment = RouteSegment & {
    _originalIndex: number;
    _transitPart?: { index: number; total: number };
  };
  let iterSegments: TimelineSegment[];
  let useDayFiltering = false;
  const dayStartMap = new Map<number, TripDay>();
  let currentDayNumber = 1;

  if (tripDays) {
    const drivingDays = tripDays.filter(d => d.segmentIndices.length > 0);
    // Only use day-filtering when tripDays contain actual sub-segments.
    // Some callers provide tripDays for overnight-advancement only (empty segments[]).
    const hasPopulatedSegments = drivingDays.some(d => d.segments.length > 0);
    if (drivingDays.length > 0 && hasPopulatedSegments) {
      iterSegments = drivingDays.flatMap(d => d.segments as TimelineSegment[]);
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

  // ── Segment loop ───────────────────────────────────────────────────────────
  let prevOrigIdx = -1;
  for (let i = 0; i < iterSegments.length; i++) {
    const seg = iterSegments[i];

    // ── Day boundary handling ─────────────────────────────────────────────
    const newDay = dayStartMap.get(i);
    if (newDay) {
      currentDayNumber = newDay.dayNumber;

      // Emit a departure event for transit days 2+ so the timeline shows
      // "🚗 Depart [City]" at each new driving day's start.
      events.push({
        id: `departure-day${newDay.dayNumber}`,
        type: 'departure',
        arrivalTime: new Date(currentTime),
        departureTime: new Date(currentTime),
        durationMinutes: 0,
        distanceFromOriginKm: cumulativeKm,
        locationHint: seg.from.name,
        stops: [],
        timezone: activeTimezone,
      });
    }

    // Update the active timezone when this segment crosses a boundary.
    // Transit sub-segments (_transitPart) inherit the parent's DESTINATION
    // timezone which is wrong for intermediate parts. Derive from the
    // sub-segment's FROM longitude instead (accurately interpolated on route).
    if (seg._transitPart) {
      const derivedTz = lngToIANA(seg.from.lng);
      if (derivedTz !== activeTimezone) {
        activeTimezone = derivedTz;
      }
    } else if (seg.timezoneCrossing && seg.timezone) {
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
    //
    // Two modes:
    //   Day-filtering (useDayFiltering): filter by dayNumber, classify by time.
    //     Stops whose estimatedTime falls after this sub-segment's window are
    //     deferred to a later sub-segment (same day, multi-segment days).
    //   Legacy (no tripDays): classify by afterSegmentIndex + time window.

    const boundaryBefore: SuggestedStop[] = [];
    const midDrive: SuggestedStop[] = [];
    const boundaryAfter: SuggestedStop[] = [];

    // Is this the last sub-segment for the current day?
    // Used to catch remaining day stops that didn't match any earlier sub-segment.
    const isLastDaySegment = (i === iterSegments.length - 1) || dayStartMap.has(i + 1);

    for (const s of suggestions) {
      if (s.dismissed || emittedIds.has(s.id)) continue;

      // Check if this stop belongs to the current segment's time window
      const hasMidDriveTime = s.estimatedTime &&
        s.estimatedTime.getTime() > driveStartTime.getTime() + 60_000 &&
        s.estimatedTime.getTime() < driveEndTime.getTime() - 60_000;

      if (useDayFiltering) {
        // Day-based filtering: only consider stops for the current day.
        if (s.dayNumber !== undefined && s.dayNumber !== currentDayNumber) continue;

        // Defer stops whose time falls after this sub-segment's window to a
        // later sub-segment in the same day. On the last sub-segment of the day,
        // accept everything remaining so no stops are orphaned.
        const isAfterThisSegment = s.estimatedTime &&
          s.estimatedTime.getTime() > driveEndTime.getTime() + 60_000;
        if (isAfterThisSegment && !isLastDaySegment) continue;

        // Overnight is always boundary-after (end of day). Everything else
        // with a valid mid-drive time is mid-drive.
        if (s.type !== 'overnight' && hasMidDriveTime) {
          midDrive.push(s);
        } else {
          boundaryAfter.push(s);
        }
      } else {
        // Original afterSegmentIndex-based classification (simple day trips)
        const isMidDriveForThisSegment =
          (s.type === 'fuel' || s.type === 'rest' || s.type === 'meal') &&
          Math.floor(s.afterSegmentIndex) === i - 1;

        if (hasMidDriveTime || isMidDriveForThisSegment) {
          midDrive.push(s);
          continue;
        }

        const flooredIdx = Math.floor(s.afterSegmentIndex);
        if (flooredIdx === i - 1) {
          boundaryBefore.push(s);
        } else if (flooredIdx === i) {
          const isEnRouteFuel = s.id.includes('enroute');
          if (isEnRouteFuel && i + 1 < iterSegments.length) {
            // Deferred to next segment's midDrive classification
          } else {
            boundaryAfter.push(s);
          }
        }
      }
    }

    // Sort mid-drive by estimated time
    midDrive.sort((a, b) => (a.estimatedTime?.getTime() ?? 0) - (b.estimatedTime?.getTime() ?? 0));

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
      });
    } else {
      // Transit splits generate sub-segments with matching from/to names,
      // so the name check naturally suppresses false waypoints between them.
      const nextSeg = iterSegments[i + 1];
      if (nextSeg && nextSeg.from?.name !== seg.to.name) {
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
