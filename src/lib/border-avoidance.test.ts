/**
 * border-avoidance.ts — unit tests for isLikelyInUS, detectBorderCrossing,
 * isNorthwesternOntarioSouthDetour, and shouldTryLakeSuperiorCorridor.
 *
 * Pure functions — no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import { isLikelyInUS, detectBorderCrossing, isNorthwesternOntarioSouthDetour, shouldTryLakeSuperiorCorridor } from './border-avoidance';

// ─── isLikelyInUS ─────────────────────────────────────────────────────────────

describe('isLikelyInUS', () => {
  it('returns false for Winnipeg, MB', () => {
    expect(isLikelyInUS(49.9, -97.1)).toBe(false);
  });

  it('returns false for Saskatoon, SK', () => {
    expect(isLikelyInUS(52.1, -106.7)).toBe(false);
  });

  it('returns false for Toronto, ON', () => {
    expect(isLikelyInUS(43.7, -79.4)).toBe(false);
  });

  it('returns false for Montreal, QC', () => {
    expect(isLikelyInUS(45.5, -73.6)).toBe(false);
  });

  it('returns true for Fargo, ND', () => {
    expect(isLikelyInUS(46.9, -96.8)).toBe(true);
  });

  it('returns true for Minneapolis, MN', () => {
    expect(isLikelyInUS(44.98, -93.3)).toBe(true);
  });

  it('returns true for Chicago, IL', () => {
    expect(isLikelyInUS(41.9, -87.6)).toBe(true);
  });

  it('returns true for New York, NY', () => {
    expect(isLikelyInUS(40.7, -74.0)).toBe(true);
  });

  it('returns false for European coords (lng out of range)', () => {
    expect(isLikelyInUS(45.0, 10.0)).toBe(false);
  });

  it('returns false for far-west out-of-range longitude', () => {
    expect(isLikelyInUS(45.0, -200.0)).toBe(false);
  });
});

// ─── detectBorderCrossing ─────────────────────────────────────────────────────

describe('detectBorderCrossing', () => {
  it('returns crossesUS=false for empty geometry', () => {
    const result = detectBorderCrossing([]);
    expect(result.crossesUS).toBe(false);
    expect(result.crossingRegions.size).toBe(0);
  });

  it('returns crossesUS=false for single point', () => {
    const result = detectBorderCrossing([[49.9, -97.1]]);
    expect(result.crossesUS).toBe(false);
  });

  it('returns crossesUS=false for all-Canadian route', () => {
    const geometry: [number, number][] = [
      [49.895, -97.138],
      [49.5, -93.0],
      [48.38, -89.25],
    ];
    const result = detectBorderCrossing(geometry);
    expect(result.crossesUS).toBe(false);
  });

  it('detects US crossing for route through US territory', () => {
    const geometry: [number, number][] = [
      [49.895, -97.138],
      [46.877, -96.789],
      [44.978, -93.265],
    ];
    const result = detectBorderCrossing(geometry);
    expect(result.crossesUS).toBe(true);
  });

  it('returns a Set for crossingRegions', () => {
    const geometry: [number, number][] = [
      [49.895, -97.138],
      [46.877, -96.789],
    ];
    const result = detectBorderCrossing(geometry);
    expect(result.crossingRegions).toBeInstanceOf(Set);
  });

  it('all-Canadian geometry has empty crossingRegions', () => {
    const geometry: [number, number][] = [
      [49.895, -97.138],
      [52.0, -106.7],
    ];
    const result = detectBorderCrossing(geometry);
    expect(result.crossingRegions.size).toBe(0);
  });
});

// ─── isNorthwesternOntarioSouthDetour ─────────────────────────────────────────

describe('isNorthwesternOntarioSouthDetour', () => {
  it('returns false for empty geometry', () => {
    expect(isNorthwesternOntarioSouthDetour([])).toBe(false);
  });

  it('returns true when geometry has a point in the south-detour band', () => {
    // lng between -95.8 and -93.0, lat < 49.15
    const geometry: [number, number][] = [[48.5, -94.5]];
    expect(isNorthwesternOntarioSouthDetour(geometry)).toBe(true);
  });

  it('returns false when point is north of 49.15 in the band', () => {
    const geometry: [number, number][] = [[49.5, -94.5]];
    expect(isNorthwesternOntarioSouthDetour(geometry)).toBe(false);
  });

  it('returns false when point is outside the longitude band', () => {
    // lng = -98 — west of -95.8
    const geometry: [number, number][] = [[48.0, -98.0]];
    expect(isNorthwesternOntarioSouthDetour(geometry)).toBe(false);
  });

  it('returns true when only one point of many is in the band', () => {
    const geometry: [number, number][] = [
      [52.0, -106.7],  // Outside band
      [48.5, -94.5],   // Inside band — should trigger true
    ];
    expect(isNorthwesternOntarioSouthDetour(geometry)).toBe(true);
  });
});

// ─── shouldTryLakeSuperiorCorridor ────────────────────────────────────────────

describe('shouldTryLakeSuperiorCorridor', () => {
  it('returns false when fewer than 2 locations', () => {
    const loc = { id: 'a', name: 'A', lat: 49.9, lng: -97.1, type: 'origin' as const };
    expect(shouldTryLakeSuperiorCorridor([loc], [[49.9, -97.1]])).toBe(false);
  });

  it('returns false for empty geometry', () => {
    const a = { id: 'a', name: 'A', lat: 49.9, lng: -99.0, type: 'origin' as const };
    const b = { id: 'b', name: 'B', lat: 48.5, lng: -94.5, type: 'destination' as const };
    expect(shouldTryLakeSuperiorCorridor([a, b], [])).toBe(false);
  });

  it('returns false when route does not span prairies to northwestern Ontario', () => {
    // Both in eastern Canada — does not match the west.lng <= -98 condition
    const a = { id: 'a', name: 'A', lat: 43.7, lng: -79.4, type: 'origin' as const };
    const b = { id: 'b', name: 'B', lat: 45.5, lng: -73.6, type: 'destination' as const };
    const geometry: [number, number][] = [[43.7, -79.4], [45.5, -73.6]];
    expect(shouldTryLakeSuperiorCorridor([a, b], geometry)).toBe(false);
  });
});
