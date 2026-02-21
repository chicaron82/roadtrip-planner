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

import type { RouteSegment, TripSettings, Vehicle } from '../types';
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
  | 'combo';     // merged fuel + meal (or fuel + rest)

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
  _vehicle?: Vehicle,
): TimedEvent[] {
  if (segments.length === 0) return [];

  const events: TimedEvent[] = [];
  let currentTime = new Date(`${settings.departureDate}T${settings.departureTime}`);
  let cumulativeKm = 0;
  const emittedIds = new Set<string>();

  const originName = segments[0].from.name;

  const makeLocationHint = (km: number, nearestWpName?: string): string => {
    if (km < 20) return nearestWpName ?? originName;
    const rounded = Math.round(km / 5) * 5;
    return `~${rounded} km from ${originName}`;
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
    events.push({
      id: `event-${stop.id}`,
      type: stopTypeToEventType(stop.type),
      arrivalTime: arr,
      departureTime: dep,
      durationMinutes: stop.duration,
      distanceFromOriginKm: cumulativeKm,
      locationHint: makeLocationHint(cumulativeKm),
      stops: [stop],
    });

    // Overnight: advance to next morning at departure time (not just +8h)
    if (stop.type === 'overnight') {
      const [dH, dM] = settings.departureTime.split(':').map(Number);
      const nextMorning = new Date(arr);
      nextMorning.setDate(nextMorning.getDate() + 1);
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

      // Check if this stop belongs to the current segment's time window
      const hasMidDriveTime = s.estimatedTime &&
        s.estimatedTime.getTime() > driveStartTime.getTime() + 60_000 && // >1 min after start
        s.estimatedTime.getTime() < driveEndTime.getTime() - 60_000;     // >1 min before end

      if (hasMidDriveTime) {
        midDrive.push(s);
        continue;
      }

      // Boundary classification by afterSegmentIndex
      if (s.afterSegmentIndex === i - 1) {
        // "Before this segment" — but skip en-route fuel (they should be mid-drive)
        // If their estimatedTime didn't match mid-drive, they're boundary stops
        if (s.id.startsWith('fuel-enroute-')) {
          // En-route fuel whose time didn't match mid-drive — skip entirely
          // (this means it was generated for a different segment)
          continue;
        }
        boundaryBefore.push(s);
      } else if (s.afterSegmentIndex === i) {
        boundaryAfter.push(s);
      }
    }

    // Sort mid-drive by estimated time
    midDrive.sort((a, b) => (a.estimatedTime!.getTime()) - (b.estimatedTime!.getTime()));

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
        // Proportion of the segment where this stop falls
        const stopTimeMs = stop.estimatedTime!.getTime() - driveStartTime.getTime();
        const fraction = Math.max(0, Math.min(1, stopTimeMs / (segMin * 60 * 1000)));
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
