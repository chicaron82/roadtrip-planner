/**
 * map-utils.ts — unit tests for findNearestSegment.
 *
 * Pure function — no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import { findNearestSegment } from './map-utils';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeSeg(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  return { from: { lat: fromLat, lng: fromLng }, to: { lat: toLat, lng: toLng } };
}

// Midpoint of this segment: (50.0, -97.0)
const SEG_A = makeSeg(49.5, -97.5, 50.5, -96.5);
// Midpoint: (48.5, -90.0)
const SEG_B = makeSeg(48.0, -90.5, 49.0, -89.5);
// Midpoint: (49.0, -94.0)
const SEG_C = makeSeg(48.5, -94.5, 49.5, -93.5);

// ─── findNearestSegment ───────────────────────────────────────────────────────

describe('findNearestSegment', () => {
  it('returns null for an empty segments array', () => {
    expect(findNearestSegment(49.9, -97.0, [])).toBeNull();
  });

  it('returns the only segment when there is one', () => {
    const result = findNearestSegment(0, 0, [SEG_A]);
    expect(result).toBe(SEG_A);
  });

  it('returns the segment whose midpoint is closest to the click', () => {
    // Click very close to SEG_A midpoint (50.0, -97.0)
    const result = findNearestSegment(50.0, -97.0, [SEG_A, SEG_B, SEG_C]);
    expect(result).toBe(SEG_A);
  });

  it('returns SEG_B when click is near its midpoint (48.5, -90.0)', () => {
    const result = findNearestSegment(48.5, -90.0, [SEG_A, SEG_B, SEG_C]);
    expect(result).toBe(SEG_B);
  });

  it('returns SEG_C when click is near its midpoint (49.0, -94.0)', () => {
    const result = findNearestSegment(49.0, -94.0, [SEG_A, SEG_B, SEG_C]);
    expect(result).toBe(SEG_C);
  });

  it('returns the first segment when multiple are equidistant (tie-breaking)', () => {
    // Two segments with same midpoint distance from (0, 0) — returns first
    const seg1 = makeSeg(-1, -1, 1, 1); // midpoint (0, 0)
    const seg2 = makeSeg(-1, -1, 1, 1); // same midpoint
    expect(findNearestSegment(0, 0, [seg1, seg2])).toBe(seg1);
  });

  it('works with generic objects (not just RouteSegment)', () => {
    // Generic type parameter T — verify it returns the typed object
    const generic = [
      { from: { lat: 1, lng: 1 }, to: { lat: 3, lng: 3 }, label: 'first' },
      { from: { lat: 10, lng: 10 }, to: { lat: 12, lng: 12 }, label: 'far' },
    ];
    const result = findNearestSegment(2, 2, generic);
    expect(result?.label).toBe('first');
  });
});
