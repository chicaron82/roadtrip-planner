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
 * Primary: rotates at fuel stops (natural pause points on any road trip).
 * Fallback: if fuel stops don't create enough rotations, splits total
 * drive time evenly across drivers using time-based rotation points.
 *
 * @param segments - Route segments to assign drivers to
 * @param numDrivers - Number of available drivers (1 = no rotation)
 * @param fuelStopIndices - Segment indices where fuel stops occur
 * @returns Driver assignments, stats, and rotation points
 */
export function assignDrivers(
  segments: RouteSegment[],
  numDrivers: number,
  fuelStopIndices: number[] = [],
): DriverRotationResult {
  if (numDrivers < 1) numDrivers = 1;

  // Deduplicate fuel stop indices: multiple en-route stops within one flat segment
  // all resolve to the same flatIndex. Without dedup, [0,0,0].length=3 triggers the
  // fuel-only path for 4 drivers, then new Set collapses to {0} — one real swap point.
  const uniqueFuelIndices = [...new Set(fuelStopIndices)];

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
 * Compute driver swap suggestions for fuel stops.
 *
 * Returns a map of stopId → driver number for each fuel stop that should
 * carry a "swap here" annotation. For each fuel stop, the current segment's
 * primary driver is excluded, and the remaining drivers are assigned in
 * round-robin order — so every driver gets inbound AND outbound stints on a
 * multi-day round trip, not just the drivers who lack segment assignments.
 *
 * @param fuelStops - Fuel stop events, each with an optional `segmentIndex`
 *   (the flatIndex of the segment the stop falls within — same convention as
 *   `DriverAssignment.segmentIndex`). When absent, driver 1 is treated as primary.
 */
export function computeSwapAssignments(
  fuelStops: Array<{ id: string; segmentIndex?: number }>,
  rotation: DriverRotationResult,
  numDrivers: number,
): Record<string, number> {
  if (fuelStops.length === 0 || numDrivers < 2) return {};

  // Build segment → primary driver lookup
  const segPrimaryMap = new Map<number, number>();
  for (const a of rotation.assignments) {
    segPrimaryMap.set(a.segmentIndex, a.driver);
  }
  const defaultPrimary = rotation.assignments[0]?.driver ?? 1;

  const swapMap: Record<string, number> = {};
  let globalIdx = 0;

  for (const stop of fuelStops) {
    const primaryDriver =
      stop.segmentIndex !== undefined
        ? (segPrimaryMap.get(stop.segmentIndex) ?? defaultPrimary)
        : defaultPrimary;

    // All drivers except the current segment's primary, in ascending order
    const candidates = Array.from({ length: numDrivers }, (_, i) => i + 1).filter(
      d => d !== primaryDriver,
    );
    if (candidates.length === 0) continue;

    swapMap[stop.id] = candidates[globalIdx % candidates.length];
    globalIdx++;
  }

  return swapMap;
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
