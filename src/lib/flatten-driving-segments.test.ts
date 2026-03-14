/**
 * flatten-driving-segments.ts — unit tests for flattenDrivingSegments.
 *
 * Pure function — no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import type { TripDay, RouteSegment } from '../types';
import { flattenDrivingSegments } from './flatten-driving-segments';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LOC_A = { id: 'a', name: 'A', lat: 49.0, lng: -97.0, type: 'origin' as const };
const LOC_B = { id: 'b', name: 'B', lat: 50.0, lng: -96.0, type: 'destination' as const };
const LOC_C = { id: 'c', name: 'C', lat: 51.0, lng: -95.0, type: 'waypoint' as const };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeSeg(from: any = LOC_A, to: any = LOC_B, idx = 0) {
  return { from, to, distanceKm: 100, durationMinutes: 60,
    fuelCost: 10, fuelLitres: 5, region: 'MB', _originalIndex: idx } as unknown as TripDay['segments'][number];
}

function makeDay(dayNumber: number, segs: TripDay['segments']): TripDay {
  return {
    dayNumber, date: '2026-08-16', dateFormatted: 'Sat',
    route: 'A → B', segments: segs,
    segmentIndices: segs.map((_, i) => i),
    timezoneChanges: [],
    budget: { gasUsed: 0, hotelCost: 0, foodEstimate: 0, miscCost: 0, dayTotal: 0, bankRemaining: 0 },
    totals: { distanceKm: 0, driveTimeMinutes: 0, stopTimeMinutes: 0, departureTime: '', arrivalTime: '' },
  } as TripDay;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function makeOriginalSeg(_idx: number): RouteSegment {
  return { from: LOC_A, to: LOC_B, distanceKm: 100, durationMinutes: 60 } as RouteSegment;
}

// ─── flattenDrivingSegments ───────────────────────────────────────────────────

describe('flattenDrivingSegments — with days', () => {
  it('returns empty result for empty days array', () => {
    const { segments, dayBoundaries } = flattenDrivingSegments([], []);
    expect(segments).toHaveLength(0);
    expect(dayBoundaries.size).toBe(0);
  });

  it('flattens single day with one segment into flatIdx 0', () => {
    const day = makeDay(1, [makeSeg()]);
    const { segments } = flattenDrivingSegments([], [day]);
    expect(segments).toHaveLength(1);
    expect(segments[0].flatIdx).toBe(0);
  });

  it('assigns sequential flatIdx across multiple segments', () => {
    const day = makeDay(1, [makeSeg(LOC_A, LOC_B, 0), makeSeg(LOC_B, LOC_C, 1)]);
    const { segments } = flattenDrivingSegments([], [day]);
    expect(segments[0].flatIdx).toBe(0);
    expect(segments[1].flatIdx).toBe(1);
  });

  it('records day boundary at the flatIdx where day 2 starts', () => {
    const day1 = makeDay(1, [makeSeg()]);
    const day2 = makeDay(2, [makeSeg(LOC_B, LOC_C)]);
    const { dayBoundaries } = flattenDrivingSegments([], [day1, day2]);
    // day2 starts at flatIdx 1 (after day1's 1 segment)
    expect(dayBoundaries.has(1)).toBe(true);
    expect(dayBoundaries.get(1)).toBe(day2);
  });

  it('does not record a boundary for the first day', () => {
    const day1 = makeDay(1, [makeSeg()]);
    const { dayBoundaries } = flattenDrivingSegments([], [day1]);
    expect(dayBoundaries.size).toBe(0);
  });

  it('skips days with no segmentIndices', () => {
    const day1 = makeDay(1, [makeSeg()]);
    const freeDay: TripDay = { ...makeDay(2, []), segmentIndices: [] }; // no segments
    const day3 = makeDay(3, [makeSeg(LOC_B, LOC_C)]);
    const { segments } = flattenDrivingSegments([], [day1, freeDay, day3]);
    // freeDay has segmentIndices=[] so it's filtered out
    expect(segments).toHaveLength(2);
  });
});

describe('flattenDrivingSegments — fallback (no days)', () => {
  it('wraps originalSegments as ProcessedSegments when days is undefined', () => {
    const origSegs = [makeOriginalSeg(0), makeOriginalSeg(1)];
    const { segments, dayBoundaries } = flattenDrivingSegments(origSegs, undefined);
    expect(segments).toHaveLength(2);
    expect(dayBoundaries.size).toBe(0);
  });

  it('assigns _originalIndex matching the array position', () => {
    const origSegs = [makeOriginalSeg(0), makeOriginalSeg(1), makeOriginalSeg(2)];
    const { segments } = flattenDrivingSegments(origSegs, undefined);
    expect(segments[0].seg._originalIndex).toBe(0);
    expect(segments[1].seg._originalIndex).toBe(1);
    expect(segments[2].seg._originalIndex).toBe(2);
  });

  it('assigns flatIdx matching array position', () => {
    const origSegs = [makeOriginalSeg(0), makeOriginalSeg(1)];
    const { segments } = flattenDrivingSegments(origSegs, undefined);
    expect(segments[0].flatIdx).toBe(0);
    expect(segments[1].flatIdx).toBe(1);
  });

  it('returns empty for empty originalSegments with no days', () => {
    const { segments } = flattenDrivingSegments([], undefined);
    expect(segments).toHaveLength(0);
  });
});
