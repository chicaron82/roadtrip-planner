/**
 * Driver Rotation System
 *
 * Computes driver assignments as a read-only overlay — never mutates segment data.
 * Drivers rotate at fuel stops (the natural swap point on any road trip).
 *
 * The algorithm:
 * 1. Start with driver 1
 * 2. At each fuel stop, rotate to the next driver
 * 3. Round-robin through all drivers
 * 4. Track cumulative driving time per driver for fairness stats
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
 * Assign drivers to segments, rotating at fuel stops.
 *
 * @param segments - Route segments to assign drivers to
 * @param numDrivers - Number of available drivers (1 = no rotation)
 * @param fuelStopIndices - Segment indices where fuel stops occur (rotation points)
 * @returns Driver assignments, stats, and rotation points
 */
export function assignDrivers(
  segments: RouteSegment[],
  numDrivers: number,
  fuelStopIndices: number[] = [],
): DriverRotationResult {
  if (numDrivers < 1) numDrivers = 1;

  // Build a set of rotation points (fuel stop indices)
  const rotationSet = new Set(fuelStopIndices);

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
    stats: Array.from(statsMap.values()),
    rotationPoints: actualRotationPoints,
  };
}

/**
 * Extract fuel stop indices from simulation items.
 * Works with the ItineraryTimeline simulation output.
 */
export function extractFuelStopIndices(
  simulationItems: Array<{ type: string; index?: number }>,
): number[] {
  const indices: number[] = [];
  for (let i = 0; i < simulationItems.length; i++) {
    if (simulationItems[i].type === 'gas') {
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
