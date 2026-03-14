/**
 * border-avoidance.ts — unit tests for isLikelyInUS and detectBorderCrossing.
 *
 * Pure functions — no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import { isLikelyInUS, detectBorderCrossing } from './border-avoidance';

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
