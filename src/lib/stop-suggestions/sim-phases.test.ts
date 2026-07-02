import { describe, it, expect } from 'vitest';
import {
  buildSynthesizedOvernight,
  applyTransitTimezoneShift,
  syncStateAfterEnRouteFills,
  applyWaypointIntentReset,
  refillTank,
} from './sim-phases';
import { TRIP_CONSTANTS } from '../trip-constants';
import { lngToIANA, ianaToAbbr } from '../trip-timezone';
import { getTimezoneShiftHours } from './timezone';
import type { SimState } from './types';
import type { StopSuggestionConfig } from '../stop-suggestion-types';
import type { ProcessedSegment, TripDay } from '../../types';

// ─── Fixtures (mirroring the stop-checks sibling tests) ───────────────────────

const TANK = 60; // litres
const LOC_A = { id: 'a', name: 'Winnipeg', lat: 49.895, lng: -97.138, type: 'waypoint' as const };
const LOC_B = { id: 'b', name: 'Brandon', lat: 49.845, lng: -99.950, type: 'waypoint' as const };

function makeConfig(overrides: Partial<StopSuggestionConfig> = {}): StopSuggestionConfig {
  return {
    tankSizeLitres: TANK,
    fuelEconomyL100km: 10,
    maxDriveHoursPerDay: 8,
    numDrivers: 1,
    departureTime: new Date('2026-08-01T08:00:00'),
    gasPrice: 1.60,
    ...overrides,
  };
}

function makeState(overrides: Partial<SimState> = {}): SimState {
  return {
    currentFuel: TANK * 0.5,
    distanceSinceLastFill: 150,
    hoursSinceLastFill: 1.5,
    costSinceLastFill: 20,
    currentTime: new Date('2026-08-01T10:00:00'),
    hoursOnRoad: 2,
    totalDrivingToday: 2,
    lastBreakTime: new Date('2026-08-01T08:00:00'),
    currentDayNumber: 1,
    currentTzAbbr: 'CST',
    restBreakInterval: 2,
    comfortRefuelHours: 3.5,
    ...overrides,
  };
}

function makeSeg(overrides: Partial<ProcessedSegment> = {}): ProcessedSegment {
  return {
    from: LOC_A,
    to: LOC_B,
    distanceKm: 200,
    durationMinutes: 120,
    fuelNeededLitres: 10,
    fuelCost: 15,
    _originalIndex: 0,
    ...overrides,
  };
}

function makeDay(dayNumber: number, overrides: Partial<TripDay> = {}): TripDay {
  return {
    dayNumber,
    segmentIndices: [0],
    segments: [],
    ...overrides,
  } as TripDay;
}

// ─── refillTank ───────────────────────────────────────────────────────────────

describe('refillTank', () => {
  it('resets a gas tank to full and zeroes the since-last-fill counters', () => {
    const state = makeState();
    refillTank(state, makeConfig());
    expect(state.currentFuel).toBe(TANK);
    expect(state.distanceSinceLastFill).toBe(0);
    expect(state.hoursSinceLastFill).toBe(0);
    expect(state.costSinceLastFill).toBe(0);
  });

  it('charges an EV to the charge limit, not 100%', () => {
    const state = makeState();
    refillTank(state, makeConfig({ isEV: true }));
    expect(state.currentFuel).toBe(TANK * TRIP_CONSTANTS.ev.chargeToLimit);
  });
});

// ─── applyWaypointIntentReset ─────────────────────────────────────────────────

describe('applyWaypointIntentReset', () => {
  it('fuel intent refills the tank and advances the clock by the dwell', () => {
    const state = makeState();
    const before = state.currentTime.getTime();
    const seg = makeSeg({ to: { ...LOC_B, intent: { fuel: true, dwellMinutes: 20 } } });
    applyWaypointIntentReset(state, seg, makeConfig());
    expect(state.currentFuel).toBe(TANK);
    expect(state.currentTime.getTime()).toBe(before + 20 * 60 * 1000);
    expect(state.lastBreakTime.getTime()).toBe(state.currentTime.getTime());
  });

  it('meal intent advances the clock (default 45m) without touching fuel', () => {
    const state = makeState();
    const before = state.currentTime.getTime();
    const seg = makeSeg({ to: { ...LOC_B, intent: { meal: true } } });
    applyWaypointIntentReset(state, seg, makeConfig());
    expect(state.currentFuel).toBe(TANK * 0.5); // unchanged
    expect(state.currentTime.getTime()).toBe(before + 45 * 60 * 1000);
  });

  it('does nothing without an intent, or when segment.to is not a waypoint', () => {
    const state = makeState();
    const snapshot = { ...state, currentTime: new Date(state.currentTime) };
    applyWaypointIntentReset(state, makeSeg(), makeConfig());
    applyWaypointIntentReset(
      state,
      makeSeg({ to: { ...LOC_B, type: 'destination' as const, intent: { fuel: true } } }),
      makeConfig(),
    );
    expect(state.currentFuel).toBe(snapshot.currentFuel);
    expect(state.currentTime.getTime()).toBe(snapshot.currentTime.getTime());
  });
});

// ─── syncStateAfterEnRouteFills ───────────────────────────────────────────────

describe('syncStateAfterEnRouteFills', () => {
  it('with a mid-segment fill, state reflects only the distance AFTER the fill', () => {
    const state = makeState();
    const seg = makeSeg({ distanceKm: 200, durationMinutes: 120, fuelCost: 30 });
    syncStateAfterEnRouteFills(state, seg, makeConfig(), 150); // filled 150km in
    const remainingKm = 50;
    expect(state.distanceSinceLastFill).toBe(remainingKm);
    expect(state.hoursSinceLastFill).toBeCloseTo((remainingKm / 200) * 120 / 60, 5);
    expect(state.currentFuel).toBeCloseTo(TANK - (remainingKm / 100) * 10, 5);
    expect(state.costSinceLastFill).toBeCloseTo((remainingKm / 200) * 30, 5);
  });

  it('with no fill, accumulates the whole segment cost and leaves fill counters alone', () => {
    const state = makeState({ costSinceLastFill: 20, distanceSinceLastFill: 150 });
    syncStateAfterEnRouteFills(state, makeSeg({ fuelCost: 15 }), makeConfig(), 0);
    expect(state.costSinceLastFill).toBe(35);
    expect(state.distanceSinceLastFill).toBe(150);
  });
});

// ─── applyTransitTimezoneShift ────────────────────────────────────────────────

describe('applyTransitTimezoneShift', () => {
  it('shifts the clock when the FROM-longitude zone differs from the current one', () => {
    // Derive the expected values with the same helpers the phase delegates to,
    // so the test locks the wiring without hard-coding a season-dependent abbr.
    const vancouverFrom = { ...LOC_A, name: 'Hope', lng: -121.44, lat: 49.38 };
    const derived = ianaToAbbr(lngToIANA(vancouverFrom.lng))!;
    const state = makeState({ currentTzAbbr: 'CDT' });
    const before = state.currentTime.getTime();
    const expectedShiftMs = getTimezoneShiftHours('CDT', derived) * 3600000;

    applyTransitTimezoneShift(state, makeSeg({ from: vancouverFrom }));

    expect(state.currentTzAbbr).toBe(derived);
    expect(state.currentTime.getTime()).toBe(before + expectedShiftMs);
  });

  it('no-ops when the derived zone matches the current one', () => {
    const derived = ianaToAbbr(lngToIANA(LOC_A.lng))!;
    const state = makeState({ currentTzAbbr: derived });
    const before = state.currentTime.getTime();
    applyTransitTimezoneShift(state, makeSeg());
    expect(state.currentTime.getTime()).toBe(before);
    expect(state.currentTzAbbr).toBe(derived);
  });
});

// ─── buildSynthesizedOvernight ────────────────────────────────────────────────

describe('buildSynthesizedOvernight', () => {
  const overnightDay = makeDay(1, {
    overnight: { location: { ...LOC_B, name: 'Brandon' } },
  } as Partial<TripDay>);

  it('synthesizes a pre-accepted overnight from the previous driving day hotel data', () => {
    const state = makeState({ totalDrivingToday: 6 });
    const stop = buildSynthesizedOvernight(
      [overnightDay, makeDay(2)], makeDay(2), new Set([1]), state, 3,
    );
    expect(stop).not.toBeNull();
    expect(stop!.type).toBe('overnight');
    expect(stop!.accepted).toBe(true);
    expect(stop!.hubName).toBe('Brandon');
    expect(stop!.afterSegmentIndex).toBe(2); // segOrigIdx - 1
    expect(stop!.dayNumber).toBe(1);
  });

  it('returns null when not at a day boundary, or the day has no user hotel data', () => {
    const state = makeState();
    // No incoming day (not a boundary)
    expect(buildSynthesizedOvernight([overnightDay], undefined, new Set([1]), state, 3)).toBeNull();
    // Boundary, but the previous day isn't in daysWithHotel
    expect(buildSynthesizedOvernight([overnightDay, makeDay(2)], makeDay(2), new Set(), state, 3)).toBeNull();
    // No days at all
    expect(buildSynthesizedOvernight(undefined, makeDay(2), new Set([1]), state, 3)).toBeNull();
  });
});
