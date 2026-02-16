import { describe, it, expect } from 'vitest';
import { assignDrivers, extractFuelStopIndices, formatDriveTime } from './driver-rotation';
import type { RouteSegment } from '../types';

// ==================== HELPERS ====================

function makeSegment(overrides: Partial<RouteSegment> = {}): RouteSegment {
  return {
    from: { id: 'a', name: 'A', lat: 0, lng: 0, type: 'waypoint' },
    to: { id: 'b', name: 'B', lat: 0, lng: 0, type: 'waypoint' },
    distanceKm: 200,
    durationMinutes: 120,
    fuelNeededLitres: 15,
    fuelCost: 25,
    ...overrides,
  };
}

function makeSegments(count: number, overrides?: Partial<RouteSegment>): RouteSegment[] {
  return Array.from({ length: count }, () => makeSegment(overrides));
}

// ==================== TESTS ====================

describe('assignDrivers', () => {
  it('assigns all segments to driver 1 when numDrivers is 1', () => {
    const segments = makeSegments(5);
    const result = assignDrivers(segments, 1, [2]);

    expect(result.assignments).toHaveLength(5);
    result.assignments.forEach(a => expect(a.driver).toBe(1));
    expect(result.rotationPoints).toHaveLength(0);
  });

  it('rotates drivers at fuel stop indices with 2 drivers', () => {
    const segments = makeSegments(6);
    // Fuel stop after segment 2 → rotation happens at segment 3
    const result = assignDrivers(segments, 2, [2]);

    expect(result.assignments[0].driver).toBe(1);
    expect(result.assignments[1].driver).toBe(1);
    expect(result.assignments[2].driver).toBe(1);
    expect(result.assignments[3].driver).toBe(2); // rotated
    expect(result.assignments[4].driver).toBe(2);
    expect(result.assignments[5].driver).toBe(2);
    expect(result.rotationPoints).toEqual([3]);
  });

  it('round-robins through 3 drivers', () => {
    const segments = makeSegments(9);
    // Fuel stops after segments 2 and 5 → rotations at 3 and 6
    const result = assignDrivers(segments, 3, [2, 5]);

    expect(result.assignments[0].driver).toBe(1);
    expect(result.assignments[2].driver).toBe(1);
    expect(result.assignments[3].driver).toBe(2); // first rotation
    expect(result.assignments[5].driver).toBe(2);
    expect(result.assignments[6].driver).toBe(3); // second rotation
    expect(result.assignments[8].driver).toBe(3);
  });

  it('wraps around to driver 1 after all drivers have driven', () => {
    const segments = makeSegments(8);
    // 3 fuel stops with 2 drivers → driver 1, 2, 1, 2
    const result = assignDrivers(segments, 2, [1, 3, 5]);

    expect(result.assignments[0].driver).toBe(1);
    expect(result.assignments[2].driver).toBe(2); // after fuel at 1
    expect(result.assignments[4].driver).toBe(1); // wrap around
    expect(result.assignments[6].driver).toBe(2); // after fuel at 5
  });

  it('handles no fuel stops (single driver the whole way)', () => {
    const segments = makeSegments(4);
    const result = assignDrivers(segments, 2, []);

    result.assignments.forEach(a => expect(a.driver).toBe(1));
    expect(result.rotationPoints).toHaveLength(0);
  });

  it('accumulates per-driver stats correctly', () => {
    const segments = [
      makeSegment({ durationMinutes: 100, distanceKm: 150 }),
      makeSegment({ durationMinutes: 80, distanceKm: 120 }),
      makeSegment({ durationMinutes: 60, distanceKm: 90 }),
      makeSegment({ durationMinutes: 110, distanceKm: 160 }),
    ];
    // Fuel stop after segment 1 → rotation at segment 2
    const result = assignDrivers(segments, 2, [1]);

    const d1 = result.stats.find(s => s.driver === 1)!;
    const d2 = result.stats.find(s => s.driver === 2)!;

    expect(d1.totalMinutes).toBe(180); // 100 + 80
    expect(d1.totalKm).toBe(270);      // 150 + 120
    expect(d1.segmentCount).toBe(2);

    expect(d2.totalMinutes).toBe(170); // 60 + 110
    expect(d2.totalKm).toBe(250);      // 90 + 160
    expect(d2.segmentCount).toBe(2);
  });

  it('handles numDrivers < 1 gracefully', () => {
    const segments = makeSegments(3);
    const result = assignDrivers(segments, 0, [1]);

    result.assignments.forEach(a => expect(a.driver).toBe(1));
  });

  it('handles empty segments', () => {
    const result = assignDrivers([], 2, []);

    expect(result.assignments).toHaveLength(0);
    expect(result.stats).toHaveLength(2);
    expect(result.rotationPoints).toHaveLength(0);
  });

  it('ignores fuel stops beyond segment range', () => {
    const segments = makeSegments(3);
    // Fuel stop at index 99 — beyond range, should be ignored
    const result = assignDrivers(segments, 2, [99]);

    result.assignments.forEach(a => expect(a.driver).toBe(1));
    expect(result.rotationPoints).toHaveLength(0);
  });

  it('does not rotate at the very first segment even if fuel stop exists at -1', () => {
    const segments = makeSegments(4);
    const result = assignDrivers(segments, 2, [0]);

    // Fuel at 0 means rotation after segment 0 → segment 1 should be driver 2
    expect(result.assignments[0].driver).toBe(1);
    expect(result.assignments[1].driver).toBe(2);
  });
});

describe('extractFuelStopIndices', () => {
  it('extracts indices from simulation items', () => {
    const items = [
      { type: 'gas' },
      { type: 'stop', index: 2 },
      { type: 'stop', index: 3 },
      { type: 'gas' },
      { type: 'stop', index: 5 },
    ];

    expect(extractFuelStopIndices(items)).toEqual([2, 5]);
  });

  it('returns empty array when no gas stops', () => {
    const items = [
      { type: 'stop', index: 0 },
      { type: 'stop', index: 1 },
    ];

    expect(extractFuelStopIndices(items)).toEqual([]);
  });

  it('handles gas stop at end with no following waypoint', () => {
    const items = [
      { type: 'stop', index: 0 },
      { type: 'gas' },
    ];

    // No waypoint after gas → nothing to extract
    expect(extractFuelStopIndices(items)).toEqual([]);
  });

  it('skips suggested stops between gas and waypoint', () => {
    const items = [
      { type: 'gas' },
      { type: 'suggested' },
      { type: 'stop', index: 1 },
    ];

    expect(extractFuelStopIndices(items)).toEqual([1]);
  });
});

describe('formatDriveTime', () => {
  it('formats minutes only', () => {
    expect(formatDriveTime(45)).toBe('45m');
  });

  it('formats hours only', () => {
    expect(formatDriveTime(120)).toBe('2h');
  });

  it('formats hours and minutes', () => {
    expect(formatDriveTime(185)).toBe('3h 5m');
  });

  it('formats zero', () => {
    expect(formatDriveTime(0)).toBe('0m');
  });

  it('formats large values', () => {
    expect(formatDriveTime(600)).toBe('10h');
  });
});
