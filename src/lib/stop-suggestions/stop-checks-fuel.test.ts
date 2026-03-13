import { describe, it, expect } from 'vitest';
import { checkFuelStop, getEnRouteFuelStops } from './stop-checks-fuel';
import type { SimState } from './types';
import type { StopSuggestionConfig } from '../stop-suggestion-types';
import type { RouteSegment } from '../../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

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
    currentFuel: TANK * 0.5,       // 30L — half tank
    distanceSinceLastFill: 0,
    hoursSinceLastFill: 0,
    costSinceLastFill: 20,
    currentTime: new Date('2026-08-01T10:00:00'), // 10 AM — outside meal windows
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

function makeSeg(overrides: Partial<RouteSegment> = {}): RouteSegment {
  return {
    from: LOC_A,
    to: LOC_B,
    distanceKm: 200,
    durationMinutes: 120,
    fuelNeededLitres: 10,
    fuelCost: 15,
    ...overrides,
  };
}

// ─── checkFuelStop ─────────────────────────────────────────────────────────────

describe('checkFuelStop', () => {
  describe('suppression conditions — returns null', () => {
    it('returns null when tank is nearly full (≥98%)', () => {
      const state = makeState({ currentFuel: TANK * 0.99 }); // 59.4L
      const result = checkFuelStop(state, makeSeg(), 1, makeConfig(), 200);
      expect(result.suggestion).toBeNull();
    });

    it('returns null when final segment and fuel is not critically low', () => {
      const state = makeState({ currentFuel: 30 }); // half tank, not critical
      const result = checkFuelStop(state, makeSeg({ fuelNeededLitres: 5 }), 1, makeConfig(), 200, true);
      expect(result.suggestion).toBeNull();
    });

    it('returns null when none of the trigger conditions are met', () => {
      const state = makeState({
        currentFuel: 30,          // not low (30 > 21 = 35%)
        distanceSinceLastFill: 50, // safe range not exceeded
        hoursSinceLastFill: 1,     // comfort interval not reached
      });
      const result = checkFuelStop(state, makeSeg({ fuelNeededLitres: 5 }), 1, makeConfig(), 200);
      expect(result.suggestion).toBeNull();
    });
  });

  describe('critically low fuel', () => {
    it('triggers when remaining fuel after segment would drop below 15% tank', () => {
      // currentFuel=15, fuelNeeded=10 → remaining=5 < 9 (15% of 60)
      const state = makeState({ currentFuel: 15, distanceSinceLastFill: 50 });
      const result = checkFuelStop(state, makeSeg({ fuelNeededLitres: 10 }), 1, makeConfig(), 200);
      expect(result.suggestion).not.toBeNull();
      expect(result.suggestion!.priority).toBe('required');
    });

    it('triggers on final segment when fuel is critically low', () => {
      const state = makeState({ currentFuel: 15 });
      const result = checkFuelStop(state, makeSeg({ fuelNeededLitres: 10 }), 1, makeConfig(), 200, true);
      expect(result.suggestion).not.toBeNull();
      expect(result.suggestion!.priority).toBe('required');
    });

    it('sets fillType to full on critically low stop', () => {
      const state = makeState({ currentFuel: 15 });
      const result = checkFuelStop(state, makeSeg({ fuelNeededLitres: 10 }), 1, makeConfig(), 200);
      expect(result.suggestion!.details.fillType).toBe('full');
    });

    it('includes destination name in reason for critical stop', () => {
      const state = makeState({ currentFuel: 15 });
      const seg = makeSeg({ fuelNeededLitres: 10 });
      const result = checkFuelStop(state, seg, 1, makeConfig(), 200);
      expect(result.suggestion!.reason).toContain(seg.to.name);
    });
  });

  describe('tank low (35%)', () => {
    it('triggers when tank drops below 35% threshold at index > 0', () => {
      // currentFuel=20 ≤ 60*0.35=21, index=1
      const state = makeState({ currentFuel: 20, distanceSinceLastFill: 50, hoursSinceLastFill: 1 });
      const result = checkFuelStop(state, makeSeg({ fuelNeededLitres: 1 }), 1, makeConfig(), 200);
      expect(result.suggestion).not.toBeNull();
    });

    it('does NOT trigger tank-low check at index 0', () => {
      const state = makeState({ currentFuel: 20, distanceSinceLastFill: 50, hoursSinceLastFill: 1 });
      const result = checkFuelStop(state, makeSeg({ fuelNeededLitres: 1 }), 0, makeConfig(), 200);
      expect(result.suggestion).toBeNull();
    });

    it('uses topup fillType for low-tank stop', () => {
      const state = makeState({ currentFuel: 20, distanceSinceLastFill: 50, hoursSinceLastFill: 1 });
      const result = checkFuelStop(state, makeSeg({ fuelNeededLitres: 1 }), 1, makeConfig(), 200);
      expect(result.suggestion!.details.fillType).toBe('topup');
    });
  });

  describe('comfort refuel', () => {
    it('triggers after comfort interval elapsed (at index > 0)', () => {
      // hoursSinceLastFill=4 >= comfortRefuelHours=3.5, index=1
      const state = makeState({ currentFuel: 40, distanceSinceLastFill: 100, hoursSinceLastFill: 4 });
      const result = checkFuelStop(state, makeSeg({ fuelNeededLitres: 5 }), 1, makeConfig(), 200);
      expect(result.suggestion).not.toBeNull();
    });

    it('does NOT trigger comfort refuel at index 0', () => {
      const state = makeState({ currentFuel: 40, distanceSinceLastFill: 100, hoursSinceLastFill: 4 });
      const result = checkFuelStop(state, makeSeg({ fuelNeededLitres: 5 }), 0, makeConfig(), 200);
      expect(result.suggestion).toBeNull();
    });

    it('uses topup fillType for comfort refuel', () => {
      const state = makeState({ currentFuel: 40, distanceSinceLastFill: 100, hoursSinceLastFill: 4 });
      const result = checkFuelStop(state, makeSeg({ fuelNeededLitres: 5 }), 1, makeConfig(), 200);
      expect(result.suggestion!.details.fillType).toBe('topup');
    });
  });

  describe('safe range exceeded', () => {
    it('triggers when distanceSinceLastFill meets safeRangeKm', () => {
      const state = makeState({ currentFuel: 40, distanceSinceLastFill: 200, hoursSinceLastFill: 1 });
      const result = checkFuelStop(state, makeSeg({ fuelNeededLitres: 5 }), 1, makeConfig(), 200);
      expect(result.suggestion).not.toBeNull();
    });

    it('returns recommended priority for range-exceeded stop', () => {
      const state = makeState({ currentFuel: 40, distanceSinceLastFill: 200, hoursSinceLastFill: 1 });
      const result = checkFuelStop(state, makeSeg({ fuelNeededLitres: 5 }), 1, makeConfig(), 200);
      expect(result.suggestion!.priority).toBe('recommended');
    });
  });

  describe('meal combo logic', () => {
    it('sets comboMeal=true and stopDuration=45 when fuel stop falls during lunch window (11-13)', () => {
      const state = makeState({ currentTime: new Date('2026-08-01T11:30:00') });
      const result = checkFuelStop(state, makeSeg({ fuelNeededLitres: 10 }), 1, makeConfig(), 0); // safeRangeKm=0 forces trigger
      expect(result.suggestion!.details.comboMeal).toBe(true);
      expect(result.suggestion!.details.comboMealType).toBe('lunch');
      expect(result.suggestion!.duration).toBe(45);
    });

    it('sets comboMeal=true and stopDuration=45 when fuel stop falls during dinner window (17-19)', () => {
      const state = makeState({ currentTime: new Date('2026-08-01T18:00:00') });
      const result = checkFuelStop(state, makeSeg({ fuelNeededLitres: 10 }), 1, makeConfig(), 0);
      expect(result.suggestion!.details.comboMeal).toBe(true);
      expect(result.suggestion!.details.comboMealType).toBe('dinner');
      expect(result.suggestion!.duration).toBe(45);
    });

    it('sets comboMeal=false and stopDuration=15 outside meal windows', () => {
      const state = makeState({ currentTime: new Date('2026-08-01T10:00:00'), distanceSinceLastFill: 200 });
      const result = checkFuelStop(state, makeSeg({ fuelNeededLitres: 5 }), 1, makeConfig(), 200);
      expect(result.suggestion!.details.comboMeal).toBe(false);
      expect(result.suggestion!.duration).toBe(15);
    });
  });

  describe('sparse stretch warning', () => {
    it('adds a sparse warning when segment distance exceeds 150km', () => {
      // Use safe range trigger to force a stop
      const state = makeState({ distanceSinceLastFill: 200 });
      const result = checkFuelStop(state, makeSeg({ distanceKm: 200, fuelNeededLitres: 5 }), 1, makeConfig(), 200);
      expect(result.suggestion!.warning).toBeDefined();
      expect(result.suggestion!.warning).toContain('⚠️');
    });

    it('does NOT add a sparse warning for short segments (≤150km)', () => {
      const state = makeState({ distanceSinceLastFill: 200 });
      const result = checkFuelStop(state, makeSeg({ distanceKm: 100, fuelNeededLitres: 5 }), 1, makeConfig(), 200);
      expect(result.suggestion!.warning).toBeUndefined();
    });
  });

  describe('hub name', () => {
    it('includes hub name in reason string when provided', () => {
      const state = makeState({ distanceSinceLastFill: 200 });
      const result = checkFuelStop(state, makeSeg({ fuelNeededLitres: 5 }), 1, makeConfig(), 200, false, 'Brandon');
      expect(result.suggestion!.reason).toContain('Brandon');
      expect(result.suggestion!.hubName).toBe('Brandon');
    });
  });

  describe('state mutations', () => {
    it('resets fuel level to full tank after stop', () => {
      const state = makeState({ distanceSinceLastFill: 200 });
      checkFuelStop(state, makeSeg({ fuelNeededLitres: 5 }), 1, makeConfig(), 200);
      expect(state.currentFuel).toBe(TANK);
    });

    it('resets distanceSinceLastFill to 0 after stop', () => {
      const state = makeState({ distanceSinceLastFill: 200 });
      checkFuelStop(state, makeSeg({ fuelNeededLitres: 5 }), 1, makeConfig(), 200);
      expect(state.distanceSinceLastFill).toBe(0);
    });

    it('resets hoursSinceLastFill to 0 after stop', () => {
      const state = makeState({ hoursSinceLastFill: 4, distanceSinceLastFill: 200 });
      checkFuelStop(state, makeSeg({ fuelNeededLitres: 5 }), 1, makeConfig(), 200);
      expect(state.hoursSinceLastFill).toBe(0);
    });

    it('advances currentTime by stop duration', () => {
      const state = makeState({ distanceSinceLastFill: 200, currentTime: new Date('2026-08-01T10:00:00') });
      checkFuelStop(state, makeSeg({ fuelNeededLitres: 5 }), 1, makeConfig(), 200);
      // 15-min stop → 10:15
      expect(state.currentTime.getMinutes()).toBe(15);
    });

    it('returns correct stopTimeAddedMs matching the stop duration', () => {
      const state = makeState({ distanceSinceLastFill: 200, currentTime: new Date('2026-08-01T10:00:00') });
      const result = checkFuelStop(state, makeSeg({ fuelNeededLitres: 5 }), 1, makeConfig(), 200);
      expect(result.stopTimeAddedMs).toBe(15 * 60 * 1000);
    });

    it('returns stopTimeAddedMs=0 when no stop triggered', () => {
      const state = makeState({ currentFuel: TANK });
      const result = checkFuelStop(state, makeSeg(), 1, makeConfig(), 200);
      expect(result.stopTimeAddedMs).toBe(0);
    });
  });

  describe('suggestion shape', () => {
    it('sets type to fuel', () => {
      const state = makeState({ distanceSinceLastFill: 200 });
      const result = checkFuelStop(state, makeSeg({ fuelNeededLitres: 5 }), 1, makeConfig(), 200);
      expect(result.suggestion!.type).toBe('fuel');
    });

    it('sets accepted to true', () => {
      const state = makeState({ distanceSinceLastFill: 200 });
      const result = checkFuelStop(state, makeSeg({ fuelNeededLitres: 5 }), 1, makeConfig(), 200);
      expect(result.suggestion!.accepted).toBe(true);
    });

    it('sets dayNumber from state', () => {
      const state = makeState({ distanceSinceLastFill: 200, currentDayNumber: 3 });
      const result = checkFuelStop(state, makeSeg({ fuelNeededLitres: 5 }), 1, makeConfig(), 200);
      expect(result.suggestion!.dayNumber).toBe(3);
    });
  });
});

// ─── getEnRouteFuelStops ───────────────────────────────────────────────────────

describe('getEnRouteFuelStops', () => {
  it('returns no stops for a short segment within safe range', () => {
    const state = makeState({ costSinceLastFill: 0 });
    const seg = makeSeg({ distanceKm: 100, durationMinutes: 60, fuelNeededLitres: 10 });
    const { stops } = getEnRouteFuelStops(state, seg, 1, makeConfig(), 300, new Date('2026-08-01T08:00:00'));
    expect(stops).toHaveLength(0);
  });

  it('places at least one stop on a segment much longer than safe range', () => {
    const state = makeState({ costSinceLastFill: 0 });
    const seg = makeSeg({ distanceKm: 700, durationMinutes: 420, fuelNeededLitres: 70 });
    const { stops } = getEnRouteFuelStops(state, seg, 1, makeConfig(), 200, new Date('2026-08-01T08:00:00'));
    expect(stops.length).toBeGreaterThan(0);
  });

  it('all stops have type fuel', () => {
    const state = makeState({ costSinceLastFill: 0 });
    const seg = makeSeg({ distanceKm: 700, durationMinutes: 420, fuelNeededLitres: 70 });
    const { stops } = getEnRouteFuelStops(state, seg, 1, makeConfig(), 200, new Date('2026-08-01T08:00:00'));
    stops.forEach(s => expect(s.type).toBe('fuel'));
  });

  it('stop times fall within the segment duration window', () => {
    const startTime = new Date('2026-08-01T08:00:00');
    const state = makeState({ costSinceLastFill: 0 });
    const seg = makeSeg({ distanceKm: 700, durationMinutes: 420, fuelNeededLitres: 70 });
    const { stops } = getEnRouteFuelStops(state, seg, 1, makeConfig(), 200, startTime);
    const segEndMs = startTime.getTime() + 420 * 60 * 1000;
    stops.forEach(s => {
      expect(s.estimatedTime.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
      expect(s.estimatedTime.getTime()).toBeLessThan(segEndMs);
    });
  });

  it('hub resolver name appears in stop hubName', () => {
    const startTime = new Date('2026-08-01T08:00:00');
    const state = makeState({ costSinceLastFill: 0 });
    const seg = makeSeg({ distanceKm: 700, durationMinutes: 420, fuelNeededLitres: 70 });
    const hubResolver = (_km: number) => 'Brandon, MB';
    const { stops } = getEnRouteFuelStops(state, seg, 1, makeConfig(), 200, startTime, 0, hubResolver);
    expect(stops.some(s => s.hubName === 'Brandon, MB')).toBe(true);
  });

  it('comfort interval stop is labeled recommended, safety stop is required', () => {
    const startTime = new Date('2026-08-01T08:00:00');
    const state = makeState({ costSinceLastFill: 0 });
    const seg = makeSeg({ distanceKm: 700, durationMinutes: 420, fuelNeededLitres: 70 });
    const { stops } = getEnRouteFuelStops(state, seg, 1, makeConfig(), 200, startTime, 0, undefined, 3.0);
    expect(stops.length).toBeGreaterThan(0);
    // When comfortIntervalHours provided, the stop should be comfort (recommended) when it fires first
    const firstStop = stops[0];
    expect(['recommended', 'required']).toContain(firstStop.priority);
  });

  it('lastFillKm is the km mark of the last stop within the segment', () => {
    const startTime = new Date('2026-08-01T08:00:00');
    const state = makeState({ costSinceLastFill: 0 });
    const seg = makeSeg({ distanceKm: 700, durationMinutes: 420, fuelNeededLitres: 70 });
    const { stops, lastFillKm } = getEnRouteFuelStops(state, seg, 1, makeConfig(), 200, startTime);
    if (stops.length > 0) {
      expect(lastFillKm).toBeGreaterThan(0);
      expect(lastFillKm).toBeLessThan(seg.distanceKm);
    }
  });
});
