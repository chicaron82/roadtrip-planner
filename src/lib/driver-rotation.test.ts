import { describe, it, expect } from 'vitest';
import { assignDrivers, computeSwapAssignments, extractFuelStopIndices, formatDriveTime } from './driver-rotation';
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

  it('falls back to time-based rotation when no fuel stops provided', () => {
    // 4 equal segments, 2 drivers — should split evenly (2 each)
    const segments = makeSegments(4);
    const result = assignDrivers(segments, 2, []);

    // Driver 1 takes first half, driver 2 takes second half
    expect(result.assignments[0].driver).toBe(1);
    expect(result.assignments[1].driver).toBe(1);
    expect(result.assignments[2].driver).toBe(2);
    expect(result.assignments[3].driver).toBe(2);
    expect(result.rotationPoints).toHaveLength(1);
  });

  it('treats driver 1 as primary when total time is uneven', () => {
    const segments = [
      makeSegment({ durationMinutes: 100 }),
      makeSegment({ durationMinutes: 100 }),
      makeSegment({ durationMinutes: 100 }),
      makeSegment({ durationMinutes: 101 }),
    ];

    const result = assignDrivers(segments, 3, []);

    const d1 = result.stats.find(s => s.driver === 1)!;
    const d2 = result.stats.find(s => s.driver === 2)!;
    const d3 = result.stats.find(s => s.driver === 3)!;

    expect(Math.abs(d2.totalMinutes - d3.totalMinutes)).toBeLessThanOrEqual(1);
    expect(d1.totalMinutes).toBeGreaterThanOrEqual(d2.totalMinutes);
    expect(d1.totalMinutes).toBeGreaterThanOrEqual(d3.totalMinutes);
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
    expect(result.stats).toHaveLength(0); // no segments → no driver drove anything
    expect(result.rotationPoints).toHaveLength(0);
  });

  it('time-based fallback fails for asymmetric 2-segment trips — documents known fragility', () => {
    // OSRM returns slightly asymmetric durations for round trips (127+128 instead of 128+128).
    // When segment[0].durationMinutes < primaryShare = ceil(total/2), accumulated time
    // never hits nextTarget and no rotation fires — driver 1 takes both legs.
    //
    // TripPrintView works around this by using day-boundary indices instead of
    // time-based rotation when no fuel stops exist.
    const segments = [
      makeSegment({ durationMinutes: 127 }),
      makeSegment({ durationMinutes: 128 }),
    ];
    const result = assignDrivers(segments, 2, []);
    // With time-based fallback: primaryShare=128, accumulated after seg0=127 < 128 → no rotation
    expect(result.assignments[0].driver).toBe(1);
    expect(result.assignments[1].driver).toBe(1); // BUG: should be driver 2
    expect(result.stats).toHaveLength(1); // only driver 1 appears
  });

  it('day-boundary index (0) correctly rotates 2-segment round trip', () => {
    // TripPrintView passes flatIdx-1 per new day as the rotation index.
    // For a 2-day trip (Day1: seg0, Day2: seg1) that's [0].
    const segments = [
      makeSegment({ durationMinutes: 127 }),
      makeSegment({ durationMinutes: 128 }),
    ];
    const result = assignDrivers(segments, 2, [0]); // day boundary after seg0
    expect(result.assignments[0].driver).toBe(1);
    expect(result.assignments[1].driver).toBe(2);
    expect(result.stats).toHaveLength(2);
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

describe('computeSwapAssignments', () => {
  it('returns empty when no fuel stops', () => {
    const segments = makeSegments(2);
    const rotation = assignDrivers(segments, 4, [0]);
    expect(computeSwapAssignments([], rotation, 4)).toEqual({});
  });

  it('returns empty for single driver', () => {
    const segments = makeSegments(2);
    const rotation = assignDrivers(segments, 1, []);
    expect(computeSwapAssignments([{ id: 'f1', segmentIndex: 0 }], rotation, 1)).toEqual({});
  });

  it('assigns all non-primary drivers round-robin across fuel stops in one segment', () => {
    // 2 segments, 4 drivers: seg0=D1, seg1=D2
    const segments = makeSegments(2);
    const rotation = assignDrivers(segments, 4, [0]);
    const stops = [
      { id: 's1', segmentIndex: 0 },
      { id: 's2', segmentIndex: 0 },
      { id: 's3', segmentIndex: 0 },
    ];
    const result = computeSwapAssignments(stops, rotation, 4);
    // seg0 primary=D1, candidates=[2,3,4], global idx 0,1,2
    expect(result['s1']).toBe(2);
    expect(result['s2']).toBe(3);
    expect(result['s3']).toBe(4);
  });

  it('gives each driver both inbound and outbound stints on a 4-driver round trip', () => {
    // 2 flat segments (1 per leg), 4 drivers, rotation at [0] (day boundary)
    // seg0=D1 (DiZee), seg1=D2 (Aaron)
    const segments = makeSegments(2);
    const rotation = assignDrivers(segments, 4, [0]);

    const stops = [
      // 3 fuel stops in seg0 (DiZee's leg)
      { id: 's1', segmentIndex: 0 },
      { id: 's2', segmentIndex: 0 },
      { id: 's3', segmentIndex: 0 },
      // 3 fuel stops in seg1 (Aaron's leg)
      { id: 's4', segmentIndex: 1 },
      { id: 's5', segmentIndex: 1 },
      { id: 's6', segmentIndex: 1 },
    ];

    const result = computeSwapAssignments(stops, rotation, 4);

    // seg0 (primary=DiZee=1): candidates=[2,3,4], idx 0,1,2 → Aaron, Tori, Belle
    expect(result['s1']).toBe(2); // Aaron gets a stint outbound
    expect(result['s2']).toBe(3); // Tori gets a stint outbound
    expect(result['s3']).toBe(4); // Belle gets a stint outbound

    // seg1 (primary=Aaron=2): candidates=[1,3,4], idx 3,4,5 → 3%3=0→D1, 1→D3, 2→D4
    expect(result['s4']).toBe(1); // DiZee gets a stint inbound
    expect(result['s5']).toBe(3); // Tori gets a stint inbound
    expect(result['s6']).toBe(4); // Belle gets a stint inbound
  });

  it('falls back to driver 1 as primary when segmentIndex is absent', () => {
    const segments = makeSegments(2);
    const rotation = assignDrivers(segments, 2, [0]); // seg0=D1, seg1=D2
    const stops = [{ id: 'f1' }]; // no segmentIndex
    const result = computeSwapAssignments(stops, rotation, 2);
    // default primary = D1, candidates = [2]
    expect(result['f1']).toBe(2);
  });

  it('works when all drivers already have assigned segments', () => {
    // 4 segments, 4 drivers — everyone is assigned, old code returned {} early
    const segments = makeSegments(4);
    const rotation = assignDrivers(segments, 4, [0, 1, 2]);
    const stops = [{ id: 'f1', segmentIndex: 0 }, { id: 'f2', segmentIndex: 2 }];
    const result = computeSwapAssignments(stops, rotation, 4);
    // seg0 primary=D1, candidates=[2,3,4] → f1=D2
    // seg2 primary=D3, candidates=[1,2,4] → f2 cycles from globalIdx=1 → D2
    expect(result['f1']).toBe(2);
    expect(result['f2']).toBe(2); // idx=1%3=1 → candidates[1] of [1,2,4] = D2
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
