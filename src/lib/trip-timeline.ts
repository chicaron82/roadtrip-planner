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
 * Collect ALL suggestions that should fire during or at the boundaries of
 * segment `i`. This includes:
 *   - afterSegmentIndex === i-1 → "before this segment" (pre-segment)
 *   - afterSegmentIndex === i   → "after this segment" (post-segment)
 * AND en-route stops whose `estimatedTime` falls INSIDE this segment's
 * time window (for long single-segment routes where multiple stops share
 * the same afterSegmentIndex because there's nothing else to anchor to).
 */
function collectStopsForSegment(
  i: number,
  suggestions: SuggestedStop[],
  segStartTime: Date,
  segEndTime: Date,
): { preStops: SuggestedStop[]; midStops: SuggestedStop[]; postStops: SuggestedStop[] } {
  const preStops: SuggestedStop[] = [];
  const midStops: SuggestedStop[] = [];
  const postStops: SuggestedStop[] = [];

  for (const s of suggestions) {
    if (s.dismissed) continue;

    // En-route stops — identified by id pattern fuel-enroute-* or by having
    // estimatedTime strictly between segment start and end
    const isEnRoute = s.id.startsWith('fuel-enroute-') || s.id.startsWith('meal-');
    if (isEnRoute && s.afterSegmentIndex === i - 1 && s.estimatedTime) {
      const t = s.estimatedTime.getTime();
      // If the estimated time falls within this segment's driving window,
      // it's a mid-segment stop
      if (t > segStartTime.getTime() && t < segEndTime.getTime()) {
        midStops.push(s);
        continue;
      }
    }

    // Meal stops use afterSegmentIndex === i (post-segment)
    if (s.type === 'meal' && s.afterSegmentIndex === i) {
      // Check if the meal time actually falls mid-segment (it usually does —
      // "lunch at 12 PM" during a 9AM-5PM drive means it's mid-drive)
      if (s.estimatedTime) {
        const t = s.estimatedTime.getTime();
        if (t > segStartTime.getTime() && t < segEndTime.getTime()) {
          midStops.push(s);
          continue;
        }
      }
      postStops.push(s);
      continue;
    }

    if (s.afterSegmentIndex === i - 1) {
      preStops.push(s);
    } else if (s.afterSegmentIndex === i) {
      postStops.push(s);
    }
  }

  // Sort mid-stops by estimatedTime
  midStops.sort((a, b) => (a.estimatedTime?.getTime() ?? 0) - (b.estimatedTime?.getTime() ?? 0));

  return { preStops, midStops, postStops };
}


/**
 * Build a flat list of timed events for a route.
 *
 * Key capability: for long segments with mid-drive stops (fuel, meals),
 * the drive is SPLIT into sub-drives around each stop. A 700km segment
 * with a fuel stop at km 487 becomes: drive 487km → fuel 15min → drive 213km.
 *
 * @param segments    Route segments from TripSummary
 * @param suggestions All smart stop suggestions (accepted + pending)
 * @param settings    Trip settings (departure date/time, etc.)
 * @param vehicle     Vehicle (for tank size used in safety-net fuel logic)
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

  const originName = segments[0].from.name;

  const makeLocationHint = (km: number, nearestWpName?: string): string => {
    if (km < 20) return nearestWpName ?? originName;
    const rounded = Math.round(km / 5) * 5;
    return `~${rounded} km from ${originName}`;
  };

  // Departure event
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

  // Emit a single stop event
  const emitStop = (stop: SuggestedStop) => {
    const arr = new Date(currentTime);
    const dep = new Date(currentTime.getTime() + stop.duration * 60 * 1000);
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
    currentTime = dep;
  };

  // Emit a drive event for a sub-portion of a segment
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

  // Pre-trip stops (afterSegmentIndex: -1)
  const preTrip = suggestions.filter(s => !s.dismissed && s.afterSegmentIndex === -1);
  // Sort: fuel first
  preTrip.sort((a, b) => (a.type === 'fuel' ? -1 : b.type === 'fuel' ? 1 : 0));
  preTrip.forEach(emitStop);

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segKm = seg.distanceKm ?? 0;
    const segMin = seg.durationMinutes ?? 0;
    const segStartTime = new Date(currentTime);
    const segEndTime = new Date(currentTime.getTime() + segMin * 60 * 1000);

    const { preStops, midStops, postStops } = collectStopsForSegment(
      i, suggestions, segStartTime, segEndTime,
    );

    // Pre-segment stops (fuel check triggered for this segment, placed before driving)
    preStops.sort((a, b) => (a.type === 'fuel' ? -1 : b.type === 'fuel' ? 1 : 0));
    preStops.forEach(emitStop);

    // === DRIVE with mid-segment splits ===
    if (midStops.length > 0) {
      // Split the drive around each mid-stop using estimatedTime proportions
      let drivenKm = 0;
      let drivenMin = 0;

      for (let m = 0; m < midStops.length; m++) {
        const stop = midStops[m];
        // Calculate how far into the segment this stop falls
        const stopTimeMs = (stop.estimatedTime?.getTime() ?? segStartTime.getTime()) - segStartTime.getTime();
        const fractionIntoSeg = Math.max(0, Math.min(1, stopTimeMs / (segMin * 60 * 1000)));
        const stopKmFromSegStart = segKm * fractionIntoSeg;
        const stopMinFromSegStart = segMin * fractionIntoSeg;

        // Drive from current position to the stop
        const driveKm = Math.max(0, stopKmFromSegStart - drivenKm);
        const driveMin = Math.max(0, stopMinFromSegStart - drivenMin);

        if (driveKm > 1) { // Don't emit tiny sub-drives
          emitDrive(driveKm, driveMin, i, m);
        }

        drivenKm = stopKmFromSegStart;
        drivenMin = stopMinFromSegStart;

        // Emit the stop
        emitStop(stop);
      }

      // Drive the remaining distance after the last mid-stop
      const remainKm = segKm - drivenKm;
      const remainMin = segMin - drivenMin;
      if (remainKm > 1) {
        emitDrive(remainKm, remainMin, i, midStops.length);
      } else {
        cumulativeKm += remainKm; // Still count it even if we skip the drive event
      }
    } else {
      // Single unbroken drive
      emitDrive(segKm, segMin, i);
    }

    // Waypoint / arrival
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

    // Post-segment stops (overnight, end-of-segment fuel, etc.)
    postStops.sort((a, b) => (a.type === 'fuel' ? -1 : b.type === 'fuel' ? 1 : 0));
    postStops.forEach(emitStop);
  }

  return events;
}
