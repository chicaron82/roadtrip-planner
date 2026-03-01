import type { TripSummary, TripSettings, Vehicle, TripDay } from '../types';
import type { SuggestedStop } from './stop-suggestions';
import { getTankSizeLitres } from './unit-conversions';
import { flattenDrivingSegments } from './flatten-driving-segments';

export interface SimulationItem {
  type: 'gas' | 'stop' | 'suggested';
  arrivalTime: Date;
  cost?: number;
  litres?: number;
  segment?: TripSummary['segments'][number];
  /** Flat sub-segment index — unique per iteration item.
   *  Used for dayStartMap keying and React keys. */
  index?: number;
  /** Original segment index (for callbacks like onUpdateStopType).
   *  Only differs from `index` when days contain processed sub-segments. */
  originalIndex?: number;
  suggestedStop?: SuggestedStop;
  fuelPriority?: 'critical' | 'recommended' | 'optional';
}

interface BuildSimulationItemsParams {
  summary: TripSummary;
  settings: TripSettings;
  vehicle: Vehicle | undefined;
  days: TripDay[] | undefined;
  startTime: Date;
  activeSuggestions: SuggestedStop[];
}

/**
 * Build the ordered list of simulation items for the timeline.
 *
 * When `days` is available, iterates the processed sub-segments from each
 * driving day (same granularity as generateSmartStops). This gives correct
 * timing for multi-day transit routes where a single OSRM segment is split
 * across several days by splitLongSegments.
 *
 * Falls back to `summary.segments` when days aren't computed yet.
 */
export function buildSimulationItems({
  summary,
  settings,
  vehicle,
  days,
  startTime,
  activeSuggestions,
}: BuildSimulationItemsParams): SimulationItem[] {
  const items: SimulationItem[] = [];
  let currentTime = new Date(startTime);

  const VIRTUAL_TANK_CAPACITY = vehicle
    ? getTankSizeLitres(vehicle, settings.units)
    : 55;
  let currentFuel = VIRTUAL_TANK_CAPACITY;

  // Exclude overnight-midpoint stops — already rendered by DaySection.
  const acceptedByOrigIdx = new Map<number, SuggestedStop[]>();
  activeSuggestions
    .filter(s => s.accepted && s.type !== 'overnight')
    .forEach(stop => {
      const existing = acceptedByOrigIdx.get(stop.afterSegmentIndex) || [];
      acceptedByOrigIdx.set(stop.afterSegmentIndex, [...existing, stop]);
    });

  // Initial stops at the origin (afterSegmentIndex: -1)
  const initialStops = acceptedByOrigIdx.get(-1) || [];
  initialStops.forEach(stop => {
    items.push({ type: 'suggested', arrivalTime: new Date(currentTime), suggestedStop: stop });
    currentTime = new Date(currentTime.getTime() + (stop.duration * 60 * 1000));
    if (stop.type === 'fuel') currentFuel = VIRTUAL_TANK_CAPACITY;
  });

  // Build flat iteration list from processed sub-segments (when days available)
  // or original segments (fallback). Same pattern as generateSmartStops.
  const { segments: iterList, dayBoundaries } = flattenDrivingSegments(summary.segments, days);

  for (let fi = 0; fi < iterList.length; fi++) {
    const { seg: segment } = iterList[fi];
    const origIdx = segment._originalIndex;

    // Day boundary: reset clock + tank to next morning's departure
    const boundary = dayBoundaries.get(fi);
    if (boundary) {
      let dayStart: Date;
      if (boundary.totals?.departureTime) {
        dayStart = new Date(boundary.totals.departureTime);
      } else {
        const [dh, dm] = settings.departureTime.split(':').map(Number);
        dayStart = new Date(boundary.date + 'T00:00:00');
        dayStart.setHours(dh, dm, 0, 0);
      }
      if (dayStart > currentTime) currentTime = dayStart;
      currentFuel = VIRTUAL_TANK_CAPACITY;
    }

    const fuelNeeded = segment.fuelNeededLitres ?? 0;

    // Safety-net fuel check.
    // Skip when tank is nearly full (trip start, after overnight resets).
    const tankNearlyFull = currentFuel >= VIRTUAL_TANK_CAPACITY * 0.9;
    if (!tankNearlyFull && currentFuel - fuelNeeded < (VIRTUAL_TANK_CAPACITY * 0.15)) {
      const hasAcceptedFuelStop = acceptedByOrigIdx.get(origIdx)?.some(s => s.type === 'fuel');
      if (!hasAcceptedFuelStop) {
        const refillAmount = VIRTUAL_TANK_CAPACITY - currentFuel;
        const refillCost = refillAmount * settings.gasPrice;
        const fuelPercent = currentFuel / VIRTUAL_TANK_CAPACITY;
        const fuelPriority: 'critical' | 'recommended' | 'optional' =
          fuelPercent < 0.10 ? 'critical' :
          fuelPercent < 0.25 ? 'recommended' : 'optional';

        const stopTime = new Date(currentTime);
        currentTime = new Date(currentTime.getTime() + (15 * 60 * 1000));
        currentFuel = VIRTUAL_TANK_CAPACITY;
        items.push({ type: 'gas', arrivalTime: stopTime, cost: refillCost, litres: refillAmount, fuelPriority });
      }
    }

    // Drive the segment
    const durationMs = (segment.durationMinutes || 0) * 60 * 1000;
    currentTime = new Date(currentTime.getTime() + durationMs);
    currentFuel -= fuelNeeded;

    items.push({
      type: 'stop',
      segment,
      arrivalTime: new Date(currentTime),
      index: fi,
      originalIndex: origIdx,
    });

    // Accepted stops: emit after the LAST sub-segment of each original segment.
    // Multiple sub-segments share the same origIdx; emit only when the next
    // sub-segment has a different origIdx (or we're at the end).
    const nextOrigIdx = fi + 1 < iterList.length ? iterList[fi + 1].seg._originalIndex : -999;
    if (nextOrigIdx !== origIdx) {
      const stopsAfter = acceptedByOrigIdx.get(origIdx) || [];
      stopsAfter.forEach(stop => {
        items.push({ type: 'suggested', arrivalTime: new Date(currentTime), suggestedStop: stop });
        currentTime = new Date(currentTime.getTime() + (stop.duration * 60 * 1000));
        if (stop.type === 'fuel') currentFuel = VIRTUAL_TANK_CAPACITY;
      });
    }
  }

  return items;
}
