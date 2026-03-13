/**
 * day-builder.ts — unit tests
 *
 * Covers three functions that previously had 0% or partial test coverage:
 *
 *   ceilToNearest       — round-up utility (was already ~100% via integration,
 *                         added explicit unit tests for documentation clarity)
 *   labelTransitDay     — line 47: beast-mode (> 16h) label branch
 *   finalizeTripDay     — line 166: midnight-placeholder departure replacement
 *                       — lines 198-219: fuel budget with strategic fuel stops
 *
 * 💚 My Experience Engine
 */
import { describe, it, expect } from 'vitest';
import {
  ceilToNearest,
  createEmptyDay,
  finalizeTripDay,
  labelTransitDay,
} from './day-builder';
import { makeSegment, makeSettings } from '../../test/fixtures';
import type { ProcessedSegment } from '../../types/route';
import type { StrategicFuelStop } from '../fuel-stops';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Thin wrapper so tests can override any field including _transitPart. */
function makePS(overrides: Partial<ProcessedSegment> = {}): ProcessedSegment {
  return makeSegment(overrides);
}

function makeFuelStop(distanceFromStart: number, cost: number): StrategicFuelStop {
  return {
    lat: 50,
    lng: -97,
    distanceFromStart,
    estimatedTime: '2026-08-01T10:00:00.000Z',
    fuelRemaining: 20,
    cost,
  };
}

// ─── ceilToNearest ────────────────────────────────────────────────────────────

describe('ceilToNearest', () => {
  it('rounds a fractional value up to the nearest increment', () => {
    expect(ceilToNearest(65.14, 5)).toBe(70);
  });

  it('leaves zero as zero', () => {
    expect(ceilToNearest(0, 5)).toBe(0);
  });

  it('leaves an already-multiple value unchanged', () => {
    expect(ceilToNearest(70, 5)).toBe(70);
  });

  it('works with increment of 1 (normal ceiling)', () => {
    expect(ceilToNearest(12.1, 1)).toBe(13);
  });
});

// ─── labelTransitDay ──────────────────────────────────────────────────────────

describe('labelTransitDay', () => {
  it('does nothing when the last segment has no _transitPart', () => {
    const day = createEmptyDay(1, new Date());
    day.segments.push(makePS()); // no _transitPart → early return
    labelTransitDay(day, [makeSegment()]);
    expect(day.title).toBeUndefined();
  });

  it('does nothing when the day covers the entire split (coversWholeSplit = true)', () => {
    // _transitPart {index:0, total:1} — only one part and this day has it → coversWholeSplit
    const day = createEmptyDay(1, new Date());
    day.totals.driveTimeMinutes = 120;
    day.segments.push(makePS({ _transitPart: { index: 0, total: 1 }, _originalIndex: 0 }));
    labelTransitDay(day, [makeSegment()]);
    expect(day.title).toBeUndefined(); // no label set
  });

  it('sets "In Transit to X (Day N/M)" for a partial transit day (≤ 16 h drive)', () => {
    // index=1, total=3 → day is part 2 of 3 → coversWholeSplit is false
    const day = createEmptyDay(1, new Date());
    day.totals.driveTimeMinutes = 300; // 5 hours — well under beast threshold
    day.segments.push(makePS({ _transitPart: { index: 1, total: 3 }, _originalIndex: 0 }));
    const originals = [
      makeSegment({ to: { id: 'tb', name: 'Thunder Bay', lat: 48.4, lng: -89.2, type: 'destination' } }),
    ];
    labelTransitDay(day, originals);
    expect(day.title).toBe('In Transit to Thunder Bay (Day 2/3)');
  });

  it('sets "Continuous Drive to X" when driveTimeMinutes > 960 (beast mode — line 47)', () => {
    // 961 min > 16 * 60 = 960 → beast-mode label
    const day = createEmptyDay(1, new Date());
    day.totals.driveTimeMinutes = 961;
    day.segments.push(makePS({ _transitPart: { index: 1, total: 3 }, _originalIndex: 0 }));
    const originals = [
      makeSegment({ to: { id: 'yeg', name: 'Edmonton, AB', lat: 53.5, lng: -113.5, type: 'destination' } }),
    ];
    labelTransitDay(day, originals);
    // City name is split(',')[0] → "Edmonton"
    expect(day.title).toBe('Continuous Drive to Edmonton');
  });
});

// ─── finalizeTripDay — midnight placeholder (line 166) ───────────────────────

describe('finalizeTripDay — midnight placeholder replacement', () => {
  it('replaces midnight departureTime with the first segment\'s departure time', () => {
    // createEmptyDay stamps totals.departureTime with the exact date passed in.
    // When that date IS the midnight placeholder, finalizeTripDay should replace
    // it with firstSegment.departureTime (line 166).
    //
    // Use local midnight (new Date(y, m, d)) because the midnight check uses
    // getHours() in local time — a UTC midnight ISO string would fail in
    // non-UTC environments.
    const midnight = new Date(2026, 7, 1, 0, 0, 0); // August 1, 2026 local midnight
    const day = createEmptyDay(1, midnight);
    // Simulate a segment that actually departed at 14:00 local
    const segDep = new Date(2026, 7, 1, 14, 0, 0).toISOString();
    day.segments.push(makePS({ departureTime: segDep, durationMinutes: 120, distanceKm: 200, fuelCost: 30 }));

    finalizeTripDay(day, 2000, makeSettings());

    expect(day.totals.departureTime).toBe(segDep);
  });

  it('keeps a non-midnight departureTime when the segment departs later', () => {
    // If departureTime is already correct (not midnight), it must be left alone
    const dep = '2026-08-01T13:00:00.000Z';
    const day = createEmptyDay(1, new Date(dep));
    day.segments.push(makePS({ departureTime: dep, durationMinutes: 120, distanceKm: 200, fuelCost: 30 }));

    finalizeTripDay(day, 2000, makeSettings());

    expect(day.totals.departureTime).toBe(dep);
  });
});

// ─── finalizeTripDay — fuel budget with strategic stops (lines 198-219) ──────

describe('finalizeTripDay — strategic fuel stop budget', () => {
  it('sums fuel-stop costs within the day range and adds the home-stretch segment fraction', () => {
    /**
     * Setup:
     *   seg1: distanceFromStart=0,   distanceKm=500, fuelCost=50
     *   seg2: distanceFromStart=500, distanceKm=300, fuelCost=30
     *   stop1: distanceFromStart=400, cost=80   (part A: within day range)
     *   stop2: distanceFromStart=650, cost=90   (part A: within day range)
     *   ultimateLastStopKm = 650
     *
     * Home-stretch (part B):
     *   seg1: 0 → 500, does NOT straddle 650 (500 ≤ 650) → no addition
     *   seg2: 500 → 800, STRADDLES 650 →
     *     postStopDist = 800 - 650 = 150
     *     ratio        = 150 / 300 = 0.5
     *     addition     = 30 * 0.5 = 15
     *
     * Total gasUsed = 80 + 90 + 15 = 185 → ceilToNearest(185, 5) = 185
     */
    const day = createEmptyDay(1, new Date('2026-08-01T08:00:00.000Z'));
    day.totals.departureTime = '2026-08-01T08:00:00.000Z';
    day.segments.push(
      makePS({ distanceFromStart: 0,   distanceKm: 500, fuelCost: 50, durationMinutes: 300 }),
      makePS({ distanceFromStart: 500, distanceKm: 300, fuelCost: 30, durationMinutes: 180 }),
    );

    const fuelStops: StrategicFuelStop[] = [
      makeFuelStop(400, 80),
      makeFuelStop(650, 90),
    ];

    finalizeTripDay(day, 2000, makeSettings(), fuelStops);

    expect(day.budget.gasUsed).toBe(185);
  });

  it('falls back to mathematical fuel cost when no fuel stops are provided', () => {
    // else branch (no fuelStops): gasUsed = sum of segment fuelCost
    const day = createEmptyDay(1, new Date('2026-08-01T08:00:00.000Z'));
    day.totals.departureTime = '2026-08-01T08:00:00.000Z';
    day.segments.push(
      makePS({ distanceKm: 200, fuelCost: 30, durationMinutes: 120 }),
      makePS({ distanceKm: 150, fuelCost: 25, durationMinutes: 90 }),
    );

    finalizeTripDay(day, 2000, makeSettings()); // no fuelStops

    // 30 + 25 = 55 → ceilToNearest(55, 5) = 55
    expect(day.budget.gasUsed).toBe(55);
  });

  it('reflects the fuel cost in dayTotal and reduces bankRemaining', () => {
    const day = createEmptyDay(1, new Date(2026, 7, 1, 8, 0, 0));
    day.totals.departureTime = new Date(2026, 7, 1, 8, 0, 0).toISOString();
    day.segments.push(makePS({ distanceKm: 200, fuelCost: 30, durationMinutes: 120 }));

    // numTravelers=4 (default), durationMinutes=120 → 2 h drive → ceil(2/4)=1 meal
    // foodEstimate = 1*4 * 40/3 = 53.33... → ceilToNearest(53.33,5) = 55
    // gasUsed = ceilToNearest(30,5) = 30
    // no overnight → hotelCost = 0
    // dayTotal = 30 + 0 + 55 = 85
    finalizeTripDay(day, 1000, makeSettings());

    expect(day.budget.gasUsed).toBe(30);
    expect(day.budget.dayTotal).toBe(85);
    expect(day.budget.bankRemaining).toBe(915); // 1000 - 85
  });
});
