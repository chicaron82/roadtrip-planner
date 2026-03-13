import { describe, it, expect } from 'vitest';
import {
  checkOvernightStop,
  driveSegment,
  handleDayBoundaryReset,
  checkArrivalWindow,
  applyTimezoneShift,
} from './stop-checks-overnight';
import type { SimState } from './types';
import type { StopSuggestionConfig } from '../stop-suggestion-types';
import type { RouteSegment, TripDay } from '../../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TANK = 60;
const LOC_A = { id: 'a', name: 'Winnipeg', lat: 49.895, lng: -97.138, type: 'origin' as const };
const LOC_B = { id: 'b', name: 'Brandon', lat: 49.845, lng: -99.950, type: 'waypoint' as const };
const LOC_C = { id: 'c', name: 'Regina', lat: 50.445, lng: -104.619, type: 'waypoint' as const };

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
    currentFuel: TANK,
    distanceSinceLastFill: 0,
    hoursSinceLastFill: 0,
    costSinceLastFill: 0,
    currentTime: new Date('2026-08-01T16:00:00'),
    hoursOnRoad: 6,
    totalDrivingToday: 6,
    lastBreakTime: new Date('2026-08-01T14:00:00'),
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
    fuelNeededLitres: 20,
    fuelCost: 30,
    ...overrides,
  };
}

function makeDay(dayNumber: number, date: string): TripDay {
  return {
    dayNumber,
    date,
    dateFormatted: date,
    route: 'A → B',
    segments: [],
    segmentIndices: [],
    timezoneChanges: [],
    budget: { gasUsed: 0, hotelCost: 0, foodEstimate: 0, miscCost: 0, dayTotal: 0, bankRemaining: 1000 },
    totals: {
      distanceKm: 0,
      driveTimeMinutes: 0,
      stopTimeMinutes: 0,
      departureTime: `${date}T08:00:00`,
      arrivalTime: `${date}T16:00:00`,
    },
  };
}

// ─── driveSegment ──────────────────────────────────────────────────────────────

describe('driveSegment', () => {
  it('returns arrival time = segmentStartTime + durationMinutes', () => {
    const state = makeState();
    const segStartTime = new Date('2026-08-01T08:00:00');
    const seg = makeSeg({ durationMinutes: 120 });
    const arrival = driveSegment(state, seg, segStartTime, makeConfig());
    const expected = new Date('2026-08-01T10:00:00');
    expect(arrival.getTime()).toBe(expected.getTime());
  });

  it('consumes fuelNeededLitres from state.currentFuel', () => {
    const state = makeState({ currentFuel: TANK });
    const segStartTime = new Date('2026-08-01T08:00:00');
    const seg = makeSeg({ fuelNeededLitres: 20 });
    driveSegment(state, seg, segStartTime, makeConfig());
    expect(state.currentFuel).toBe(TANK - 20);
  });

  it('increments hoursOnRoad by segment hours', () => {
    const state = makeState({ hoursOnRoad: 2 });
    const segStartTime = new Date('2026-08-01T08:00:00');
    const seg = makeSeg({ durationMinutes: 120 }); // 2h
    driveSegment(state, seg, segStartTime, makeConfig());
    expect(state.hoursOnRoad).toBeCloseTo(4, 5);
  });

  it('increments totalDrivingToday by segment hours', () => {
    const state = makeState({ totalDrivingToday: 4 });
    const segStartTime = new Date('2026-08-01T08:00:00');
    const seg = makeSeg({ durationMinutes: 120 });
    driveSegment(state, seg, segStartTime, makeConfig());
    expect(state.totalDrivingToday).toBeCloseTo(6, 5);
  });

  it('falls back to L/100km calculation when fuelNeededLitres is absent', () => {
    const state = makeState({ currentFuel: TANK });
    const segStartTime = new Date('2026-08-01T08:00:00');
    // distanceKm=100, fuelEconomy=10 L/100km → should consume 10L
    const seg = { ...makeSeg({ distanceKm: 100 }), fuelNeededLitres: undefined } as unknown as RouteSegment;
    driveSegment(state, seg, segStartTime, makeConfig({ fuelEconomyL100km: 10 }));
    expect(state.currentFuel).toBe(TANK - 10);
  });
});

// ─── checkOvernightStop ────────────────────────────────────────────────────────

describe('checkOvernightStop', () => {
  it('returns null when totalDrivingToday is below the daily limit', () => {
    const state = makeState({ totalDrivingToday: 6 });
    const arrivalTime = new Date('2026-08-01T16:00:00');
    const result = checkOvernightStop(state, 1, makeConfig({ maxDriveHoursPerDay: 8 }), new Set(), arrivalTime, false);
    expect(result).toBeNull();
  });

  it('returns null on the final segment even when limit is exceeded', () => {
    const state = makeState({ totalDrivingToday: 10 });
    const arrivalTime = new Date('2026-08-01T18:00:00');
    const result = checkOvernightStop(state, 1, makeConfig({ maxDriveHoursPerDay: 8 }), new Set(), arrivalTime, true);
    expect(result).toBeNull();
  });

  it('advances currentTime to arrivalTime when no overnight triggered', () => {
    const state = makeState({ totalDrivingToday: 6 });
    const arrivalTime = new Date('2026-08-01T16:00:00');
    checkOvernightStop(state, 1, makeConfig({ maxDriveHoursPerDay: 8 }), new Set(), arrivalTime, false);
    expect(state.currentTime.getTime()).toBe(arrivalTime.getTime());
  });

  describe('overnight triggered', () => {
    it('returns an overnight suggestion when limit exceeded and not final segment', () => {
      const state = makeState({ totalDrivingToday: 9 });
      const arrivalTime = new Date('2026-08-01T17:00:00');
      const result = checkOvernightStop(state, 1, makeConfig({ maxDriveHoursPerDay: 8 }), new Set(), arrivalTime, false);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('overnight');
    });

    it('sets priority to required', () => {
      const state = makeState({ totalDrivingToday: 9 });
      const arrivalTime = new Date('2026-08-01T17:00:00');
      const result = checkOvernightStop(state, 1, makeConfig({ maxDriveHoursPerDay: 8 }), new Set(), arrivalTime, false);
      expect(result!.priority).toBe('required');
    });

    it('sets duration to 480 minutes (8 hours)', () => {
      const state = makeState({ totalDrivingToday: 9 });
      const arrivalTime = new Date('2026-08-01T17:00:00');
      const result = checkOvernightStop(state, 1, makeConfig({ maxDriveHoursPerDay: 8 }), new Set(), arrivalTime, false);
      expect(result!.duration).toBe(8 * 60);
    });

    it('resets totalDrivingToday to 0 after overnight', () => {
      const state = makeState({ totalDrivingToday: 9 });
      const arrivalTime = new Date('2026-08-01T17:00:00');
      checkOvernightStop(state, 1, makeConfig({ maxDriveHoursPerDay: 8 }), new Set(), arrivalTime, false);
      expect(state.totalDrivingToday).toBe(0);
    });

    it('resets currentFuel to full tank after overnight', () => {
      const state = makeState({ totalDrivingToday: 9, currentFuel: 20 });
      const arrivalTime = new Date('2026-08-01T17:00:00');
      checkOvernightStop(state, 1, makeConfig({ maxDriveHoursPerDay: 8 }), new Set(), arrivalTime, false);
      expect(state.currentFuel).toBe(TANK);
    });

    it('advances currentDayNumber by 1', () => {
      const state = makeState({ totalDrivingToday: 9, currentDayNumber: 1 });
      const arrivalTime = new Date('2026-08-01T17:00:00');
      checkOvernightStop(state, 1, makeConfig({ maxDriveHoursPerDay: 8 }), new Set(), arrivalTime, false);
      expect(state.currentDayNumber).toBe(2);
    });

    it('sets currentTime to next-morning departure', () => {
      const state = makeState({ totalDrivingToday: 9 });
      const arrivalTime = new Date('2026-08-01T17:00:00');
      const config = makeConfig({ maxDriveHoursPerDay: 8, departureTime: new Date('2026-08-01T08:00:00') });
      checkOvernightStop(state, 1, config, new Set(), arrivalTime, false);
      expect(state.currentTime.getHours()).toBe(8);
      expect(state.currentTime.getDate()).toBe(2); // next day
    });

    it('includes early check-in note when arriving before 3 PM', () => {
      const state = makeState({ totalDrivingToday: 9 });
      const earlyArrival = new Date('2026-08-01T13:00:00'); // 1 PM
      const result = checkOvernightStop(state, 1, makeConfig({ maxDriveHoursPerDay: 8 }), new Set(), earlyArrival, false);
      expect(result!.reason).toContain('3 PM');
    });

    it('does NOT include early check-in note when arriving after 3 PM', () => {
      const state = makeState({ totalDrivingToday: 9 });
      const lateArrival = new Date('2026-08-01T16:00:00'); // 4 PM
      const result = checkOvernightStop(state, 1, makeConfig({ maxDriveHoursPerDay: 8 }), new Set(), lateArrival, false);
      expect(result!.reason).not.toContain('3 PM');
    });
  });

  describe('daysWithHotel — no duplicate overnight', () => {
    it('returns null when current day is already in daysWithHotel (hotel already placed)', () => {
      const state = makeState({ totalDrivingToday: 9, currentDayNumber: 1 });
      const arrivalTime = new Date('2026-08-01T17:00:00');
      const daysWithHotel = new Set([1]);
      const result = checkOvernightStop(state, 1, makeConfig({ maxDriveHoursPerDay: 8 }), daysWithHotel, arrivalTime, false);
      expect(result).toBeNull();
    });

    it('still resets state even when no suggestion emitted (hotel already placed)', () => {
      const state = makeState({ totalDrivingToday: 9, currentDayNumber: 1, currentFuel: 20 });
      const arrivalTime = new Date('2026-08-01T17:00:00');
      checkOvernightStop(state, 1, makeConfig({ maxDriveHoursPerDay: 8 }), new Set([1]), arrivalTime, false);
      expect(state.currentFuel).toBe(TANK);
      expect(state.totalDrivingToday).toBe(0);
    });
  });
});

// ─── handleDayBoundaryReset ────────────────────────────────────────────────────

describe('handleDayBoundaryReset', () => {
  it('does nothing when segment index is not in the driving day map', () => {
    const state = makeState({ currentFuel: 20 });
    const map = new Map<number, TripDay>();
    handleDayBoundaryReset(state, 5, map, makeConfig());
    expect(state.currentFuel).toBe(20); // unchanged
  });

  it('resets fuel to full when segment is the start of a new driving day', () => {
    const state = makeState({ currentFuel: 20 });
    const map = new Map([[3, makeDay(2, '2026-08-02')]]);
    handleDayBoundaryReset(state, 3, map, makeConfig());
    expect(state.currentFuel).toBe(TANK);
  });

  it('resets totalDrivingToday to 0', () => {
    const state = makeState({ totalDrivingToday: 8 });
    const map = new Map([[3, makeDay(2, '2026-08-02')]]);
    handleDayBoundaryReset(state, 3, map, makeConfig());
    expect(state.totalDrivingToday).toBe(0);
  });

  it('resets hoursOnRoad to 0', () => {
    const state = makeState({ hoursOnRoad: 8 });
    const map = new Map([[3, makeDay(2, '2026-08-02')]]);
    handleDayBoundaryReset(state, 3, map, makeConfig());
    expect(state.hoursOnRoad).toBe(0);
  });

  it('updates currentDayNumber to the new driving day', () => {
    const state = makeState({ currentDayNumber: 1 });
    const map = new Map([[3, makeDay(2, '2026-08-02')]]);
    handleDayBoundaryReset(state, 3, map, makeConfig());
    expect(state.currentDayNumber).toBe(2);
  });

  it('uses departureTime from day totals when present', () => {
    const state = makeState();
    const day = makeDay(2, '2026-08-02');
    day.totals!.departureTime = '2026-08-02T09:30:00.000Z';
    const map = new Map([[3, day]]);
    handleDayBoundaryReset(state, 3, map, makeConfig());
    // currentTime should reflect the day's departure time
    expect(state.currentTime.toISOString()).toBe('2026-08-02T09:30:00.000Z');
  });
});

// ─── checkArrivalWindow ────────────────────────────────────────────────────────

describe('checkArrivalWindow', () => {
  it('returns null when totalDrivingToday is 0 (no driving yet)', () => {
    const state = makeState({ totalDrivingToday: 0 });
    const seg = makeSeg({ durationMinutes: 90 }); // would arrive at 17:30
    const result = checkArrivalWindow(state, seg, 1, makeConfig(), new Set());
    expect(result).toBeNull();
  });

  it('returns null when projected arrival is before 9 PM', () => {
    // currentTime = 4 PM, segment = 90 min → arrival 5:30 PM (before 9 PM)
    const state = makeState({ totalDrivingToday: 4, currentTime: new Date('2026-08-01T16:00:00') });
    const seg = makeSeg({ durationMinutes: 90 });
    const result = checkArrivalWindow(state, seg, 1, makeConfig(), new Set());
    expect(result).toBeNull();
  });

  it('returns an overnight suggestion when projected arrival is at or after 9 PM', () => {
    // currentTime = 8 PM, segment = 90 min → arrival 9:30 PM (after 9 PM cutoff)
    const state = makeState({ totalDrivingToday: 6, currentTime: new Date('2026-08-01T20:00:00') });
    const seg = makeSeg({ durationMinutes: 90, from: LOC_B, to: LOC_C });
    const result = checkArrivalWindow(state, seg, 1, makeConfig(), new Set());
    expect(result).not.toBeNull();
    expect(result!.type).toBe('overnight');
  });

  it('includes destination city name in overnight reason', () => {
    const state = makeState({ totalDrivingToday: 6, currentTime: new Date('2026-08-01T20:00:00') });
    const seg = makeSeg({ durationMinutes: 90, from: LOC_B, to: LOC_C });
    const result = checkArrivalWindow(state, seg, 1, makeConfig(), new Set());
    expect(result!.reason).toContain(LOC_C.name);
  });

  it('resets totalDrivingToday to 0 after overnight trigger', () => {
    const state = makeState({ totalDrivingToday: 6, currentTime: new Date('2026-08-01T20:00:00') });
    const seg = makeSeg({ durationMinutes: 90, from: LOC_B, to: LOC_C });
    checkArrivalWindow(state, seg, 1, makeConfig(), new Set());
    expect(state.totalDrivingToday).toBe(0);
  });

  it('increments currentDayNumber after overnight trigger', () => {
    const state = makeState({ totalDrivingToday: 6, currentTime: new Date('2026-08-01T20:00:00'), currentDayNumber: 1 });
    const seg = makeSeg({ durationMinutes: 90, from: LOC_B, to: LOC_C });
    checkArrivalWindow(state, seg, 1, makeConfig(), new Set());
    expect(state.currentDayNumber).toBe(2);
  });

  it('returns null when day already has a hotel (no duplicate)', () => {
    const state = makeState({ totalDrivingToday: 6, currentTime: new Date('2026-08-01T20:00:00'), currentDayNumber: 1 });
    const seg = makeSeg({ durationMinutes: 90, from: LOC_B, to: LOC_C });
    const result = checkArrivalWindow(state, seg, 1, makeConfig(), new Set([1]));
    expect(result).toBeNull();
  });
});

// ─── applyTimezoneShift ────────────────────────────────────────────────────────

describe('applyTimezoneShift', () => {
  it('does nothing when segment has no timezone abbr', () => {
    const state = makeState({ currentTzAbbr: 'CST', currentTime: new Date('2026-08-01T10:00:00') });
    const timeBefore = state.currentTime.getTime();
    applyTimezoneShift(state, makeSeg()); // no weather/timezoneAbbr
    expect(state.currentTime.getTime()).toBe(timeBefore);
  });

  it('does nothing when timezone abbr matches current state', () => {
    const state = makeState({ currentTzAbbr: 'CST' });
    const seg = makeSeg({ weather: { timezoneAbbr: 'CST' } as RouteSegment['weather'] });
    const timeBefore = state.currentTime.getTime();
    applyTimezoneShift(state, seg);
    expect(state.currentTime.getTime()).toBe(timeBefore);
  });

  it('updates currentTzAbbr when timezone changes', () => {
    const state = makeState({ currentTzAbbr: 'CST' });
    const seg = makeSeg({ weather: { timezoneAbbr: 'EST' } as RouteSegment['weather'] });
    applyTimezoneShift(state, seg);
    expect(state.currentTzAbbr).toBe('EST');
  });
});
