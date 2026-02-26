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

  // Combo metadata (set by stop-consolidator)
  timeSavedMinutes?: number;
  comboLabel?: string; // e.g. "Fuel + Lunch"
}

/**
 * Format a Date as "9:00 AM" / "12:15 PM"
 */
export const formatTime = (d: Date): string =>
  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

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
  let currentTime = new Date(`${settings.departureDate}T${settings.departureTime}`);
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
   */
  const makeLocationHint = (km: number, wpName?: string): string => {
    if (km < 20) return wpName ?? originName;
    if (wpName) return wpName; // named waypoint always wins over a distance string
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
      locationHint: makeLocationHint(cumulativeKm, wpName),
      stops: [stop],
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
        const overnightDate = arr.toISOString().slice(0, 10); // "YYYY-MM-DD"
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
    });
    currentTime = driveEnd;
  };

  // ── Segment loop ───────────────────────────────────────────────────────────
  for (let i = 0; i < segments.length; i++) {
    // ── Day-trip destination dwell ──────────────────────────────────────────
    // At the round-trip midpoint (first return segment), inject a "Time at
    // [Destination]" stop before driving back. This only fires when the user
    // has set dayTripDurationHours > 0 and the trip fits in a single day.
    if (
      roundTripMidpoint !== undefined &&
      destinationStayMinutes &&
      destinationStayMinutes > 0 &&
      i === roundTripMidpoint
    ) {
      const destName = segments[i - 1]?.to.name ?? 'Destination';
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
      });
      currentTime = dep;
    }

    const seg = segments[i];
    const segKm = seg.distanceKm ?? 0;
    const segMin = seg.durationMinutes ?? 0;

    // Compute the time window for this segment's pure driving time.
    // This is BEFORE any stops — the window in which a stop's estimatedTime
    // would fall if it happens during the drive.
    const driveStartTime = new Date(currentTime);
    const driveEndTime = new Date(currentTime.getTime() + segMin * 60 * 1000);

    // ── Classify all non-emitted suggestions for this segment ────────────
    //
    // "Boundary" stops: afterSegmentIndex === i-1 (before) or i (after).
    //   For i=0, boundary-before = afterSegmentIndex -1.
    //
    // "Mid-drive" stops: estimatedTime falls strictly within the drive window,
    //   regardless of afterSegmentIndex. This is the key fix for single-segment
    //   routes where en-route fuel and meals share the same afterSegmentIndex.
    //
    // A stop can only be in ONE bucket. Mid-drive takes priority.

    const boundaryBefore: SuggestedStop[] = [];
    const midDrive: SuggestedStop[] = [];
    const boundaryAfter: SuggestedStop[] = [];

    for (const s of suggestions) {
      if (s.dismissed || emittedIds.has(s.id)) continue;

      // Check if this stop belongs to the current segment's time window strictly based on time
      const hasMidDriveTime = s.estimatedTime &&
        s.estimatedTime.getTime() > driveStartTime.getTime() + 60_000 && // >1 min after start
        s.estimatedTime.getTime() < driveEndTime.getTime() - 60_000;     // >1 min before end

      // Robust check: explicitly pull in ALL mid-drive stops (fuel, rest, meal)
      // that were generated for this segment, even if their `estimatedTime` drifted slightly
      // due to timezone or stop accumulations.
      // `generateSmartStops` tags them with `afterSegmentIndex: i - 1` when they belong *inside* segment `i`
      // Note: en-route fuel stops use fractional values (e.g. 0.01, 0.02) to avoid false
      // consolidation, so we floor before comparing.
      const isMidDriveForThisSegment =
        (s.type === 'fuel' || s.type === 'rest' || s.type === 'meal') && 
        Math.floor(s.afterSegmentIndex) === i - 1;

      if (hasMidDriveTime || isMidDriveForThisSegment) {
        midDrive.push(s);
        continue;
      }

      // Boundary classification by afterSegmentIndex (floor for fractional en-route values)
      const flooredIdx = Math.floor(s.afterSegmentIndex);
      if (flooredIdx === i - 1) {
        // "Before this segment" — note: en-route fuel is now handled fully by midDrive above
        boundaryBefore.push(s);
      } else if (flooredIdx === i) {
        // En-route fuel stops for the NEXT segment use afterSegmentIndex = index-1,
        // which equals `i` here. They belong as midDrive for segment i+1, not as
        // a boundary-after for segment i. Skip them — the next iteration will
        // catch them via isMidDriveForThisSegment.
        const isEnRouteFuel = s.id.includes('enroute');
        if (isEnRouteFuel && i + 1 < segments.length) {
          // Deferred to next segment's midDrive classification
        } else {
          boundaryAfter.push(s);
        }
      }
    }

    // Sort mid-drive by estimated time (fallback to 0 if undefined to push them to start or let failsafe distribute them)
    midDrive.sort((a, b) => (a.estimatedTime?.getTime() ?? 0) - (b.estimatedTime?.getTime() ?? 0));

    // ── Pre-segment boundary stops ────────────────────────────────────────
    // Skip redundant "fill up before leaving" fuel when we have en-route
    // fuel stops that handle mid-drive refueling for this segment.
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
        // Proportion of the segment where this stop falls.
        // Failsafe: Time drift across multiday single segments can cause stopTimeMs to blow past bounds or NaN.
        // Rather than clumping them at the boundary, we geometrically distribute them evenly.
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
    const isLastSegment = i === segments.length - 1;
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
      });
    } else {
      const nextFrom = segments[i + 1]?.from;
      if (nextFrom && nextFrom.name !== seg.to.name) {
        events.push({
          id: `waypoint-${i}`,
          type: 'waypoint',
          arrivalTime: new Date(currentTime),
          departureTime: new Date(currentTime),
          durationMinutes: 0,
          distanceFromOriginKm: cumulativeKm,
          locationHint: seg.to.name,
          stops: [],
        });
      }
    }

    // ── Post-segment boundary stops ───────────────────────────────────────
    boundaryAfter
      .filter(s => !emittedIds.has(s.id))
      .sort((a, b) => {
        // Fuel first, then meals, then overnight last
        const order = { fuel: 0, meal: 1, rest: 2, overnight: 3 };
        return (order[a.type] ?? 2) - (order[b.type] ?? 2);
      })
      .forEach(emitStop);
  }

  return events;
}
