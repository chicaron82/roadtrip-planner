/**
 * geo.ts — unit tests for route geometry helpers.
 *
 * Pure functions — no mocks needed.
 * These functions underpin the corridor-sampling fix in poi.ts,
 * so correctness here directly protects the POI filter feature.
 */

import { describe, it, expect } from 'vitest';
import { estimateRouteDistanceKm, sampleRouteByKm, haversineDistanceSimple, computeRouteBbox } from './geo';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Known distance: Winnipeg → Thunder Bay ≈ 700km
const WPG: [number, number] = [49.8954, -97.1385];
const TB:  [number, number] = [48.3809, -89.2477];

// Short 3-point route covering ~30km
const SHORT_ROUTE: [number, number][] = [
  [49.8, -97.1],
  [50.0, -97.3],
  [50.2, -97.5],
];

// ─── haversineDistanceSimple ───────────────────────────────────────────────────

describe('haversineDistanceSimple', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistanceSimple(49.8, -97.1, 49.8, -97.1)).toBe(0);
  });

  it('returns a positive distance for different points', () => {
    const d = haversineDistanceSimple(WPG[0], WPG[1], TB[0], TB[1]);
    expect(d).toBeGreaterThan(0);
  });

  it('is symmetric (A→B = B→A)', () => {
    const ab = haversineDistanceSimple(WPG[0], WPG[1], TB[0], TB[1]);
    const ba = haversineDistanceSimple(TB[0], TB[1], WPG[0], WPG[1]);
    expect(ab).toBeCloseTo(ba, 5);
  });

  it('WPG→TB straight-line is approximately 600km', () => {
    // Haversine = great-circle distance (~598km). Road distance is ~700km.
    const d = haversineDistanceSimple(WPG[0], WPG[1], TB[0], TB[1]);
    expect(d).toBeGreaterThan(550);
    expect(d).toBeLessThan(650);
  });
});

// ─── estimateRouteDistanceKm ─────────────────────────────────────────────────

describe('estimateRouteDistanceKm', () => {
  it('returns 0 for an empty route', () => {
    expect(estimateRouteDistanceKm([])).toBe(0);
  });

  it('returns 0 for a single-point route', () => {
    expect(estimateRouteDistanceKm([WPG])).toBe(0);
  });

  it('returns a positive distance for a two-point route', () => {
    expect(estimateRouteDistanceKm([WPG, TB])).toBeGreaterThan(0);
  });

  it('WPG→TB two-point route is approximately 600km (straight-line)', () => {
    const d = estimateRouteDistanceKm([WPG, TB]);
    expect(d).toBeGreaterThan(550);
    expect(d).toBeLessThan(650);
  });

  it('sums segments for a multi-point route', () => {
    const mid: [number, number] = [49.1, -93.2];
    const twoLeg = estimateRouteDistanceKm([WPG, mid, TB]);
    const direct = estimateRouteDistanceKm([WPG, TB]);
    // Via midpoint is longer or equal (triangle inequality)
    expect(twoLeg).toBeGreaterThanOrEqual(direct);
  });

  it('is additive: A→B→C = A→B + B→C', () => {
    const mid: [number, number] = [49.1, -93.2];
    const total = estimateRouteDistanceKm([WPG, mid, TB]);
    const leg1  = estimateRouteDistanceKm([WPG, mid]);
    const leg2  = estimateRouteDistanceKm([mid, TB]);
    expect(total).toBeCloseTo(leg1 + leg2, 8);
  });
});

// ─── sampleRouteByKm ──────────────────────────────────────────────────────────

describe('sampleRouteByKm', () => {
  it('returns empty array for empty route', () => {
    expect(sampleRouteByKm([], 50)).toEqual([]);
  });

  it('always includes the first point', () => {
    const samples = sampleRouteByKm(SHORT_ROUTE, 5);
    expect(samples[0]).toEqual(SHORT_ROUTE[0]);
  });

  it('returns at least one sample for any non-empty route', () => {
    expect(sampleRouteByKm([WPG, TB], 1000).length).toBeGreaterThan(0);
  });

  it('respects maxSamples cap', () => {
    // 700km route, 10km steps would produce ~70 points — cap at 5
    const samples = sampleRouteByKm([WPG, TB], 10, 5);
    expect(samples.length).toBeLessThanOrEqual(5);
  });

  it('produces more samples with a smaller step size', () => {
    const coarse = sampleRouteByKm([WPG, TB], 200, 15);
    const fine   = sampleRouteByKm([WPG, TB], 50,  15);
    expect(fine.length).toBeGreaterThanOrEqual(coarse.length);
  });

  it('produces fewer samples on a short route than a long one (same step)', () => {
    const shortSamples = sampleRouteByKm(SHORT_ROUTE, 50, 15);
    const longSamples  = sampleRouteByKm([WPG, TB], 50, 15);
    expect(longSamples.length).toBeGreaterThanOrEqual(shortSamples.length);
  });

  it('all returned samples are valid [lat, lng] pairs', () => {
    const samples = sampleRouteByKm([WPG, TB], 100, 15);
    for (const [lat, lng] of samples) {
      expect(typeof lat).toBe('number');
      expect(typeof lng).toBe('number');
      expect(isFinite(lat)).toBe(true);
      expect(isFinite(lng)).toBe(true);
    }
  });

  it('default maxSamples is 15 (does not exceed)', () => {
    // Very dense: 1km steps on a 700km route → would be 700 without cap
    const samples = sampleRouteByKm([WPG, TB], 1);
    expect(samples.length).toBeLessThanOrEqual(15);
  });
});

// ─── computeRouteBbox ────────────────────────────────────────────────────────

describe('computeRouteBbox', () => {
  it('returns a comma-separated string with four values', () => {
    const bbox = computeRouteBbox(SHORT_ROUTE, 10);
    const parts = bbox.split(',');
    expect(parts).toHaveLength(4);
    expect(parts.every(p => isFinite(parseFloat(p)))).toBe(true);
  });

  it('south < north in the returned bbox', () => {
    const [south, , north] = computeRouteBbox(SHORT_ROUTE, 0).split(',').map(Number);
    expect(south).toBeLessThan(north);
  });

  it('west < east in the returned bbox', () => {
    const [, west, , east] = computeRouteBbox(SHORT_ROUTE, 0).split(',').map(Number);
    expect(west).toBeLessThan(east);
  });

  it('buffer expands the box beyond the raw point extents', () => {
    const noBuf = computeRouteBbox(SHORT_ROUTE, 0).split(',').map(Number);
    const buf   = computeRouteBbox(SHORT_ROUTE, 20).split(',').map(Number);
    expect(buf[0]).toBeLessThan(noBuf[0]);    // south more south
    expect(buf[2]).toBeGreaterThan(noBuf[2]); // north more north
  });
});
