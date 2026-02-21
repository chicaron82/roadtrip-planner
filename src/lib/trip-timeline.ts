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
import { getTankSizeLitres } from './unit-conversions';

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
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
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
 * @param segments    Route segments from TripSummary
 * @param suggestions All smart stop suggestions (accepted + pending)
 * @param settings    Trip settings (departure date/time, etc.)
 * @param vehicle     Vehicle (for tank size used in safety-net fuel logic)
 */
export function buildTimedTimeline(
  segments: RouteSegment[],
  suggestions: SuggestedStop[],
  settings: TripSettings,
  vehicle?: Vehicle,
): TimedEvent[] {
  if (segments.length === 0) return [];

  const events: TimedEvent[] = [];
  let currentTime = new Date(`${settings.departureDate}T${settings.departureTime}`);
  let cumulativeKm = 0;

  const tankCapacity = vehicle ? getTankSizeLitres(vehicle, settings.units) : 55;
  let currentFuel = tankCapacity;

  // Group suggestions by afterSegmentIndex (only non-dismissed)
  const bySegment = new Map<number, SuggestedStop[]>();
  suggestions
    .filter(s => !s.dismissed)
    .forEach(s => {
      const key = s.afterSegmentIndex;
      bySegment.set(key, [...(bySegment.get(key) ?? []), s]);
    });

  const originName = segments[0].from.name;

  const makeLocationHint = (km: number, nearestWpName?: string): string => {
    if (km < 20) return nearestWpName ?? originName;
    const rounded = Math.round(km / 5) * 5; // round to nearest 5km
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

  // Helper: emit stop events for all suggestions at a given segment index slot
  const emitStops = (slotIndex: number) => {
    const stopsHere = bySegment.get(slotIndex) ?? [];
    // Sort: fuel first so ordering is deterministic
    const sorted = [...stopsHere].sort((a, b) => {
      if (a.type === 'fuel') return -1;
      if (b.type === 'fuel') return 1;
      return 0;
    });

    sorted.forEach(stop => {
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
      if (stop.type === 'fuel') currentFuel = tankCapacity;
    });
  };

  // Pre-trip stops (afterSegmentIndex: -1)
  emitStops(-1);

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segKm = seg.distanceKm ?? 0;
    const segMin = seg.durationMinutes ?? 0;

    // Safety-net fuel check
    const fuelNeeded = seg.fuelNeededLitres ?? (segKm / 100) * 9;
    if (currentFuel - fuelNeeded < tankCapacity * 0.10) {
      const hasAcceptedFuel = (bySegment.get(i - 1) ?? []).some(s => s.type === 'fuel') ||
                              (bySegment.get(i) ?? []).some(s => s.type === 'fuel');
      if (!hasAcceptedFuel) {
        const refillCost = tankCapacity * settings.gasPrice;
        const arr = new Date(currentTime);
        const dep = new Date(currentTime.getTime() + 15 * 60 * 1000);
        events.push({
          id: `safety-fuel-${i}`,
          type: 'fuel',
          arrivalTime: arr,
          departureTime: dep,
          durationMinutes: 15,
          distanceFromOriginKm: cumulativeKm,
          locationHint: makeLocationHint(cumulativeKm),
          stops: [{
            id: `safety-fuel-stop-${i}`,
            type: 'fuel',
            reason: 'Tank critically low — refuel before continuing.',
            afterSegmentIndex: i - 1,
            estimatedTime: arr,
            duration: 15,
            priority: 'required',
            details: { fuelCost: refillCost },
          }],
        });
        currentTime = dep;
        currentFuel = tankCapacity;
      }
    }

    // Drive segment
    const driveArrival = new Date(currentTime.getTime() + segMin * 60 * 1000);
    cumulativeKm += segKm;
    currentFuel -= fuelNeeded;

    const isLastSegment = i === segments.length - 1;

    events.push({
      id: `drive-${i}`,
      type: 'drive',
      arrivalTime: new Date(currentTime),
      departureTime: new Date(driveArrival),
      durationMinutes: segMin,
      distanceFromOriginKm: cumulativeKm - segKm,
      locationHint: makeLocationHint(cumulativeKm - segKm, seg.from.name),
      segmentDistanceKm: segKm,
      segmentDurationMinutes: segMin,
      stops: [],
    });

    currentTime = driveArrival;

    // Waypoint / arrival
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
      // Intermediate waypoint (only if segment.to differs meaningfully from next.from)
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

    // Post-segment stops
    emitStops(i);
  }

  return events;
}
