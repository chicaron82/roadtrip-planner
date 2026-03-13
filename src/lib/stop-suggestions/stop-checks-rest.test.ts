import { describe, it, expect } from 'vitest';
import { checkRestBreak, checkMealStop } from './stop-checks-rest';
import type { SimState } from './types';
import type { StopSuggestionConfig } from '../stop-suggestion-types';
import type { RouteSegment } from '../../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LOC_A = { id: 'a', name: 'Winnipeg', lat: 49.895, lng: -97.138, type: 'waypoint' as const };
const LOC_B = { id: 'b', name: 'Brandon', lat: 49.845, lng: -99.950, type: 'waypoint' as const };

function makeConfig(overrides: Partial<StopSuggestionConfig> = {}): StopSuggestionConfig {
  return {
    tankSizeLitres: 60,
    fuelEconomyL100km: 10,
    maxDriveHoursPerDay: 8,
    numDrivers: 1,
    departureTime: new Date('2026-08-01T08:00:00'),
    gasPrice: 1.60,
    ...overrides,
  };
}

function makeState(overrides: Partial<SimState> = {}): SimState {
  // Default: 3h since last break (enough to trigger at interval=2)
  return {
    currentFuel: 30,
    distanceSinceLastFill: 100,
    hoursSinceLastFill: 2,
    costSinceLastFill: 10,
    currentTime: new Date('2026-08-01T11:00:00'),
    hoursOnRoad: 3,
    totalDrivingToday: 3,
    lastBreakTime: new Date('2026-08-01T08:00:00'),  // 3h ago
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

// ─── checkRestBreak ────────────────────────────────────────────────────────────

describe('checkRestBreak', () => {
  describe('suppression conditions', () => {
    it('returns null when hoursSinceBreak is below restBreakInterval', () => {
      // Only 1h since break, interval is 2h
      const state = makeState({
        currentTime: new Date('2026-08-01T09:00:00'),
        lastBreakTime: new Date('2026-08-01T08:00:00'),
        restBreakInterval: 2,
      });
      expect(checkRestBreak(state, makeSeg(), 1, makeConfig(), 0)).toBeNull();
    });

    it('returns null when segment is 30 minutes or less', () => {
      const state = makeState();
      expect(checkRestBreak(state, makeSeg({ durationMinutes: 30 }), 1, makeConfig(), 0)).toBeNull();
    });

    it('returns null for a very short segment (10 min)', () => {
      const state = makeState();
      expect(checkRestBreak(state, makeSeg({ durationMinutes: 10 }), 1, makeConfig(), 0)).toBeNull();
    });
  });

  describe('rest stop triggered', () => {
    it('returns a rest suggestion when interval exceeded and segment is long enough', () => {
      const state = makeState(); // 3h since break, interval=2, segment=120min
      const result = checkRestBreak(state, makeSeg(), 1, makeConfig(), 0);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('rest');
    });

    it('sets priority to recommended', () => {
      const state = makeState();
      const result = checkRestBreak(state, makeSeg(), 1, makeConfig(), 0);
      expect(result!.priority).toBe('recommended');
    });

    it('sets duration to 15 minutes', () => {
      const state = makeState();
      const result = checkRestBreak(state, makeSeg(), 1, makeConfig(), 0);
      expect(result!.duration).toBe(15);
    });

    it('includes hours behind the wheel in the reason', () => {
      const state = makeState();
      const result = checkRestBreak(state, makeSeg(), 1, makeConfig(), 0);
      expect(result!.reason).toMatch(/hour/i);
    });

    it('sets dayNumber from state', () => {
      const state = makeState({ currentDayNumber: 2 });
      const result = checkRestBreak(state, makeSeg(), 1, makeConfig(), 0);
      expect(result!.dayNumber).toBe(2);
    });
  });

  describe('multi-driver top-up hint', () => {
    it('includes top-up note when 2+ drivers and fuel fraction is in 40–80% range', () => {
      const state = makeState();
      const result = checkRestBreak(state, makeSeg(), 1, makeConfig({ numDrivers: 2 }), 0, 0.60);
      expect(result!.reason).toContain('Tank is at 60%');
    });

    it('does not include top-up note for single driver', () => {
      const state = makeState();
      const result = checkRestBreak(state, makeSeg(), 1, makeConfig({ numDrivers: 1 }), 0, 0.60);
      expect(result!.reason).not.toContain('Tank is at');
    });

    it('does not include top-up note when tank is below 40%', () => {
      const state = makeState();
      const result = checkRestBreak(state, makeSeg(), 1, makeConfig({ numDrivers: 2 }), 0, 0.35);
      expect(result!.reason).not.toContain('Tank is at');
    });

    it('does not include top-up note when tank is above 80%', () => {
      const state = makeState();
      const result = checkRestBreak(state, makeSeg(), 1, makeConfig({ numDrivers: 2 }), 0, 0.85);
      expect(result!.reason).not.toContain('Tank is at');
    });
  });

  describe('state mutations', () => {
    it('updates lastBreakTime to current time', () => {
      const state = makeState();
      const timeBefore = new Date(state.currentTime);
      checkRestBreak(state, makeSeg(), 1, makeConfig(), 0);
      expect(state.lastBreakTime.getTime()).toBe(timeBefore.getTime());
    });

    it('advances currentTime by 15 min when no prior stop time used', () => {
      const state = makeState({ currentTime: new Date('2026-08-01T11:00:00') });
      checkRestBreak(state, makeSeg(), 1, makeConfig(), 0);
      const expected = new Date('2026-08-01T11:15:00');
      expect(state.currentTime.getTime()).toBe(expected.getTime());
    });

    it('does not double-count time when fuel stop already added 15 min', () => {
      const state = makeState({ currentTime: new Date('2026-08-01T11:00:00') });
      const timeBefore = state.currentTime.getTime();
      const stopTimeAddedMs = 15 * 60 * 1000; // fuel stop already took 15 min
      checkRestBreak(state, makeSeg(), 1, makeConfig(), stopTimeAddedMs);
      // remainingMs = max(0, 15min - 15min) = 0 → no extra time added
      expect(state.currentTime.getTime()).toBe(timeBefore);
    });
  });
});

// ─── checkMealStop ─────────────────────────────────────────────────────────────

describe('checkMealStop', () => {
  describe('suppression conditions', () => {
    it('returns null when isArrivingHome is true', () => {
      const state = makeState();
      const segStartTime = new Date('2026-08-01T10:00:00');
      const seg = makeSeg({ durationMinutes: 180 }); // crosses noon
      expect(checkMealStop(state, seg, 1, segStartTime, true)).toBeNull();
    });

    it('returns null when segment ends before any meal window', () => {
      const state = makeState();
      // 7 AM start, 60 min drive → ends at 8 AM — noon not crossed
      const segStartTime = new Date('2026-08-01T07:00:00');
      const seg = makeSeg({ durationMinutes: 60 });
      expect(checkMealStop(state, seg, 1, segStartTime)).toBeNull();
    });

    it('returns null when segment starts after dinner window', () => {
      const state = makeState();
      // 8 PM start → dinner window (6 PM) already passed
      const segStartTime = new Date('2026-08-01T20:00:00');
      const seg = makeSeg({ durationMinutes: 60 });
      expect(checkMealStop(state, seg, 1, segStartTime)).toBeNull();
    });
  });

  describe('lunch stop', () => {
    it('returns a meal suggestion when segment crosses noon (12:00)', () => {
      const state = makeState();
      // Start 10 AM, drive 2.5h → ends 12:30 — crosses noon
      const segStartTime = new Date('2026-08-01T10:00:00');
      const seg = makeSeg({ durationMinutes: 150 });
      const result = checkMealStop(state, seg, 1, segStartTime);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('meal');
    });

    it('sets meal type to Lunch in reason', () => {
      const state = makeState();
      const segStartTime = new Date('2026-08-01T10:00:00');
      const seg = makeSeg({ durationMinutes: 150 });
      const result = checkMealStop(state, seg, 1, segStartTime);
      expect(result!.reason).toContain('Lunch');
    });

    it('sets stop id with lunch label', () => {
      const state = makeState();
      const segStartTime = new Date('2026-08-01T10:00:00');
      const seg = makeSeg({ durationMinutes: 150 });
      const result = checkMealStop(state, seg, 1, segStartTime);
      expect(result!.id).toContain('lunch');
    });

    it('sets duration to 45 minutes for a meal stop', () => {
      const state = makeState();
      const segStartTime = new Date('2026-08-01T10:00:00');
      const seg = makeSeg({ durationMinutes: 150 });
      const result = checkMealStop(state, seg, 1, segStartTime);
      expect(result!.duration).toBe(45);
    });

    it('sets priority to optional', () => {
      const state = makeState();
      const segStartTime = new Date('2026-08-01T10:00:00');
      const seg = makeSeg({ durationMinutes: 150 });
      const result = checkMealStop(state, seg, 1, segStartTime);
      expect(result!.priority).toBe('optional');
    });

    it('sets estimatedTime to noon', () => {
      const state = makeState();
      const segStartTime = new Date('2026-08-01T10:00:00');
      const seg = makeSeg({ durationMinutes: 150 });
      const result = checkMealStop(state, seg, 1, segStartTime);
      expect(result!.estimatedTime.getHours()).toBe(12);
      expect(result!.estimatedTime.getMinutes()).toBe(0);
    });
  });

  describe('dinner stop', () => {
    it('returns a meal suggestion when segment crosses 6 PM', () => {
      const state = makeState();
      // Start 4 PM, drive 2.5h → ends 6:30 PM — crosses dinner (18:00)
      const segStartTime = new Date('2026-08-01T16:00:00');
      const seg = makeSeg({ durationMinutes: 150 });
      const result = checkMealStop(state, seg, 1, segStartTime);
      expect(result).not.toBeNull();
      expect(result!.reason).toContain('Dinner');
    });

    it('sets estimatedTime to 6 PM for dinner', () => {
      const state = makeState();
      const segStartTime = new Date('2026-08-01T16:00:00');
      const seg = makeSeg({ durationMinutes: 150 });
      const result = checkMealStop(state, seg, 1, segStartTime);
      expect(result!.estimatedTime.getHours()).toBe(18);
    });

    it('sets dinner stop id with dinner label', () => {
      const state = makeState();
      const segStartTime = new Date('2026-08-01T16:00:00');
      const seg = makeSeg({ durationMinutes: 150 });
      const result = checkMealStop(state, seg, 1, segStartTime);
      expect(result!.id).toContain('dinner');
    });
  });

  describe('meal stop shape', () => {
    it('sets dayNumber from state', () => {
      const state = makeState({ currentDayNumber: 3 });
      const segStartTime = new Date('2026-08-01T10:00:00');
      const seg = makeSeg({ durationMinutes: 150 });
      const result = checkMealStop(state, seg, 1, segStartTime);
      expect(result!.dayNumber).toBe(3);
    });

    it('includes hours on road in details', () => {
      const state = makeState({ hoursOnRoad: 2 });
      const segStartTime = new Date('2026-08-01T10:00:00');
      const seg = makeSeg({ durationMinutes: 150 });
      const result = checkMealStop(state, seg, 1, segStartTime);
      expect(result!.details.hoursOnRoad).toBeDefined();
    });
  });
});
