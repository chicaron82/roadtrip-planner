/**
 * Driver Rotation System
 *
 * Computes driver assignments as a read-only overlay — never mutates segment data.
 * Drivers rotate at natural swap points on the road trip.
 *
 * The algorithm:
 * 1. Start with driver 1
 * 2. Rotate at fuel stops when present (natural swap points)
 * 3. Fallback: if fuel stops are too infrequent to create rotations,
 *    generate time-based rotation points — Driver 1 (primary) takes
 *    the first stint and absorbs any remainder; others split evenly
 * 4. Round-robin through all drivers at each rotation point
 * 5. Track cumulative driving time per driver for fairness stats
 */

import type { RouteSegment } from '../types';
import type { TimedEvent } from './trip-timeline-types';

// ==================== TYPES ====================

export interface DriverAssignment {
  segmentIndex: number;
  driver: number; // 1-indexed driver number
}

export interface DriverStats {
  driver: number;
  totalMinutes: number;
  totalKm: number;
  segmentCount: number;
}

export interface DriverRotationResult {
  assignments: DriverAssignment[];
  stats: DriverStats[];
  rotationPoints: number[]; // segment indices where rotation happens
}

// ==================== CORE ALGORITHM ====================

/**
 * Generate time-based rotation indices by splitting total drive time evenly.
 * Used as a fallback when fuel stops are too infrequent to create rotations.
 *
 * Driver 1 is treated as primary: non-primary drivers each get floor(total/N) minutes,
 * and Driver 1 absorbs the remainder. For perfectly divisible totals the split is equal;
 * for any remainder Driver 1 drives slightly more (first and longest stint).
 */
function buildTimeBasedRotationIndices(
  segments: RouteSegment[],
  numDrivers: number,
): number[] {
  const totalMinutes = segments.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const nonPrimaryShare = Math.floor(totalMinutes / numDrivers);
  // Driver 1 takes the first stint (total minus what the others split evenly).
  const primaryShare = totalMinutes - (numDrivers - 1) * nonPrimaryShare;

  const indices: number[] = [];
  let accumulated = 0;
  let nextTarget = primaryShare; // first rotation: after Driver 1's stint

  for (let i = 0; i < segments.length - 1; i++) {
    accumulated += segments[i].durationMinutes || 0;
    if (accumulated >= nextTarget && indices.length < numDrivers - 1) {
      indices.push(i);
      nextTarget += nonPrimaryShare;
    }
  }

  return indices;
}

/**
 * Assign drivers to segments, rotating at natural swap points.
 *
 * Primary: rotates at fuel stops and any intent-declared stops (fuel, meal, overnight).
 * Fallback: if stop-based rotation points don't create enough rotations, splits total
 * drive time evenly across drivers using time-based rotation points.
 *
 * @param segments - Route segments to assign drivers to
 * @param numDrivers - Number of available drivers (1 = no rotation)
 * @param fuelStopIndices - Segment indices where fuel stops occur
 * @param extraRotationIndices - Additional rotation points (intent waypoints, overnight boundaries)
 * @returns Driver assignments, stats, and rotation points
 */
export function assignDrivers(
  segments: RouteSegment[],
  numDrivers: number,
  fuelStopIndices: number[] = [],
  extraRotationIndices: number[] = [],
): DriverRotationResult {
  if (numDrivers < 1) numDrivers = 1;

  // Deduplicate all rotation indices: fuel stops + intent waypoints + overnight boundaries.
  // Multiple en-route stops within one flat segment all resolve to the same flatIndex —
  // dedup prevents phantom rotation points inflating the fuel-only path check.
  const uniqueFuelIndices = [...new Set([...fuelStopIndices, ...extraRotationIndices])];

  // Determine rotation points: fuel stops if they create enough rotations,
  // otherwise fall back to time-based even distribution
  const effectiveIndices =
    uniqueFuelIndices.length >= numDrivers - 1
      ? uniqueFuelIndices
      : [
          ...uniqueFuelIndices,
          ...buildTimeBasedRotationIndices(segments, numDrivers).filter(
            i => !uniqueFuelIndices.includes(i),
          ),
        ];

  const rotationSet = new Set(effectiveIndices);

  const assignments: DriverAssignment[] = [];
  const statsMap = new Map<number, DriverStats>();

  // Initialize stats for each driver
  for (let d = 1; d <= numDrivers; d++) {
    statsMap.set(d, { driver: d, totalMinutes: 0, totalKm: 0, segmentCount: 0 });
  }

  let currentDriver = 1;
  const actualRotationPoints: number[] = [];

  for (let i = 0; i < segments.length; i++) {
    // Rotate at fuel stops (but not at the very first segment)
    if (i > 0 && rotationSet.has(i - 1) && numDrivers > 1) {
      currentDriver = (currentDriver % numDrivers) + 1;
      actualRotationPoints.push(i);
    }

    assignments.push({ segmentIndex: i, driver: currentDriver });

    // Accumulate stats
    const stats = statsMap.get(currentDriver)!;
    stats.totalMinutes += segments[i].durationMinutes || 0;
    stats.totalKm += segments[i].distanceKm || 0;
    stats.segmentCount += 1;
  }

  return {
    assignments,
    // Only include drivers who actually drove — with fewer segments than drivers,
    // trailing drivers get 0 minutes and showing them is misleading.
    stats: Array.from(statsMap.values()).filter(s => s.segmentCount > 0),
    rotationPoints: actualRotationPoints,
  };
}

/**
 * Extract fuel stop indices from simulation items.
 * Works with the ItineraryTimeline simulation output.
 */
export function extractFuelStopIndices(
  simulationItems: Array<{ type: string; index?: number; suggestedStop?: { type: string } }>,
): number[] {
  const indices: number[] = [];
  for (let i = 0; i < simulationItems.length; i++) {
    const item = simulationItems[i];
    // Handle both legacy 'gas' type and current 'suggested' type with a fuel suggestedStop.
    // buildSimulationItems emits type='suggested' for fuel events (type='gas' is legacy).
    const isFuelStop = item.type === 'gas' ||
      (item.type === 'suggested' && item.suggestedStop?.type === 'fuel');
    if (isFuelStop) {
      // The fuel stop happens before the next waypoint — find the next 'stop' item
      for (let j = i + 1; j < simulationItems.length; j++) {
        if (simulationItems[j].type === 'stop' && typeof simulationItems[j].index === 'number') {
          indices.push(simulationItems[j].index!);
          break;
        }
      }
    }
  }
  return indices;
}

/**
 * Extract fuel stop flat-segment indices from the pre-built TimedEvent array.
 * Used by the print path, which has precomputedEvents but not raw simulation items.
 *
 * TimedEvent uses type='fuel'|'combo' for fuel events; flatIndex is only set on
 * subsequent waypoint/arrival/destination events, so we scan forward (mirrors the
 * simulation-item logic in extractFuelStopIndices).
 */
export function extractFuelIndicesFromTimedEvents(
  events: Array<{ type: string; flatIndex?: number }>,
): number[] {
  const indices: number[] = [];
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.type === 'fuel' || ev.type === 'combo') {
      for (let j = i + 1; j < events.length; j++) {
        const next = events[j];
        if (
          (next.type === 'waypoint' || next.type === 'arrival' || next.type === 'destination') &&
          typeof next.flatIndex === 'number'
        ) {
          indices.push(next.flatIndex);
          break;
        }
      }
    }
  }
  return indices;
}

/**
 * Compute driver swap suggestions for fuel stops when not all drivers are
 * assigned segments (i.e. the trip has fewer flat segments than numDrivers).
 *
 * Returns a map of stopId → driver number for each fuel stop that should
 * carry a "swap here" annotation. Unassigned drivers are distributed across
 * the provided fuel stops in round-robin order by estimated time.
 *
 * Returns an empty map when every driver already has assigned segments — the
 * swap suggestion cleanly retires itself when the rotation covers everyone.
 */
export function computeSwapAssignments(
  fuelStops: Array<{ id: string }>,
  rotation: DriverRotationResult,
  numDrivers: number,
): Record<string, number> {
  const assignedNums = new Set(rotation.stats.map(s => s.driver));
  const unassigned = Array.from({ length: numDrivers }, (_, i) => i + 1)
    .filter(d => !assignedNums.has(d));

  if (unassigned.length === 0 || fuelStops.length === 0) return {};

  const swapMap: Record<string, number> = {};
  fuelStops.forEach((stop, idx) => {
    swapMap[stop.id] = unassigned[idx % unassigned.length];
  });
  return swapMap;
}

/**
 * Walk the timed-event stream to compute accurate per-driver stats when some
 * drivers only drive because of fuel-stop swap suggestions (i.e. they hold no
 * flat segments and would show "—" in the roster from segment-based stats alone).
 *
 * Algorithm:
 * - At each `departure` event, look ahead for the next indexed waypoint/arrival
 *   to identify which flat segment is starting — that segment's assignment gives
 *   the starting driver for the stint.
 * - At each `fuel`/`combo` event that has a swap suggestion, commit the current
 *   driver's elapsed time/distance and hand off to the suggested driver.
 * - At `overnight`, `arrival`, and `destination` events, commit the final stint
 *   for that driving block.
 *
 * Falls back to the existing segment-based stats when swapSuggestions is empty
 * (the intents-checked path already has enough rotation points to assign every
 * driver a real segment, so its roster is already correct).
 */
export function buildRosterStatsFromTimedEvents(
  timedEvents: TimedEvent[],
  swapSuggestions: Record<string, number>,
  rotation: DriverRotationResult,
  numDrivers: number,
): DriverStats[] {
  if (Object.keys(swapSuggestions).length === 0) return rotation.stats;

  const statsMap = new Map<number, DriverStats>();
  for (let d = 1; d <= numDrivers; d++) {
    statsMap.set(d, { driver: d, totalMinutes: 0, totalKm: 0, segmentCount: 0 });
  }

  let currentDriver = 1;
  let stintStartTime: Date | null = null;
  let stintStartKm = 0;

  for (let i = 0; i < timedEvents.length; i++) {
    const event = timedEvents[i];

    if (event.type === 'departure') {
      // Look ahead (up to the next departure) for the first event with a flat
      // segment index — that tells us which assignment owns this driving block.
      for (let j = i + 1; j < timedEvents.length; j++) {
        const next = timedEvents[j];
        if (next.type === 'departure') break;
        if (typeof next.flatIndex === 'number') {
          const assignment = rotation.assignments.find(a => a.segmentIndex === next.flatIndex);
          if (assignment) currentDriver = assignment.driver;
          break;
        }
      }
      stintStartTime = event.departureTime;
      stintStartKm = event.distanceFromOriginKm;

    } else if ((event.type === 'fuel' || event.type === 'combo') && event.stops[0]) {
      const swapTo = swapSuggestions[event.stops[0].id];
      if (swapTo !== undefined && stintStartTime) {
        const mins = (event.arrivalTime.getTime() - stintStartTime.getTime()) / 60000;
        const km = event.distanceFromOriginKm - stintStartKm;
        const stats = statsMap.get(currentDriver)!;
        stats.totalMinutes += Math.max(0, mins);
        stats.totalKm += Math.max(0, km);
        stats.segmentCount += 1;
        currentDriver = swapTo;
        stintStartTime = event.departureTime;
        stintStartKm = event.distanceFromOriginKm;
      }

    } else if (
      event.type === 'overnight' ||
      event.type === 'destination' ||
      event.type === 'arrival'
    ) {
      if (stintStartTime) {
        const mins = (event.arrivalTime.getTime() - stintStartTime.getTime()) / 60000;
        const km = event.distanceFromOriginKm - stintStartKm;
        const stats = statsMap.get(currentDriver)!;
        stats.totalMinutes += Math.max(0, mins);
        stats.totalKm += Math.max(0, km);
        stats.segmentCount += 1;
        stintStartTime = null;
      }
    }
  }

  return Array.from(statsMap.values()).filter(s => s.segmentCount > 0);
}

/**
 * Format driving time for display.
 * e.g., 185 → "3h 5m"
 */
export function formatDriveTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Resolve a 1-indexed driver number to its display name.
 * Falls back to "Driver N" when names are absent or the entry is blank.
 */
export function getDriverName(driver: number, names?: string[]): string {
  const name = names?.[driver - 1]?.trim();
  return name || `Driver ${driver}`;
}
