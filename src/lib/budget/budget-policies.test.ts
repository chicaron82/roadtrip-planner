/**
 * Budget policy helpers — unit tests
 *
 * Covers split-by-days-policies.ts (formatHour, deriveBudgetRemaining,
 * getEffectiveMaxDriveMinutes, computeSmartDepartureHour)
 * and timezone.ts (getTimezoneOffset, getTimezoneName).
 *
 * All pure functions — no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import type { TripSettings } from '../../types';
import {
  formatHour,
  deriveBudgetRemaining,
  getEffectiveMaxDriveMinutes,
  computeSmartDepartureHour,
} from './split-by-days-policies';
import { getTimezoneOffset, getTimezoneName } from './timezone';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeSettings(overrides: Partial<TripSettings> = {}): TripSettings {
  return {
    units: 'metric', currency: 'CAD',
    maxDriveHours: 10, numTravelers: 2, numDrivers: 1,
    budgetMode: 'plan-to-budget',
    budget: { mode: 'plan-to-budget', allocation: 'flexible', profile: 'balanced',
      weights: { gas: 25, hotel: 35, food: 30, misc: 10 },
      gas: 0, hotel: 0, food: 0, misc: 0, total: 1000 },
    departureDate: '2026-08-16', departureTime: '09:00',
    returnDate: '', arrivalDate: '', arrivalTime: '',
    targetArrivalHour: 21,
    ...overrides,
  } as TripSettings;
}

// ─── formatHour ───────────────────────────────────────────────────────────────

describe('formatHour', () => {
  it('formats 9 as "09:00"', () => {
    expect(formatHour(9)).toBe('09:00');
  });

  it('formats 21 as "21:00"', () => {
    expect(formatHour(21)).toBe('21:00');
  });

  it('formats 0 as "00:00"', () => {
    expect(formatHour(0)).toBe('00:00');
  });

  it('formats 12 as "12:00"', () => {
    expect(formatHour(12)).toBe('12:00');
  });
});

// ─── deriveBudgetRemaining ────────────────────────────────────────────────────

describe('deriveBudgetRemaining', () => {
  it('returns budget.total as bankRemaining when total > 0', () => {
    const result = deriveBudgetRemaining(makeSettings({ budget: { ...makeSettings().budget, total: 1200 } }));
    expect(result.bankRemaining).toBe(1200);
  });

  it('returns 0 when budget.total is 0', () => {
    const result = deriveBudgetRemaining(makeSettings({ budget: { ...makeSettings().budget, total: 0 } }));
    expect(result.bankRemaining).toBe(0);
  });
});

// ─── getEffectiveMaxDriveMinutes ──────────────────────────────────────────────

describe('getEffectiveMaxDriveMinutes', () => {
  it('adds tolerance buffer to the raw max drive minutes', () => {
    // TRIP_CONSTANTS.dayOverflow.toleranceHours is some positive value
    const result = getEffectiveMaxDriveMinutes(600); // 10h = 600min
    expect(result).toBeGreaterThan(600);
  });

  it('is deterministic for the same input', () => {
    expect(getEffectiveMaxDriveMinutes(600)).toBe(getEffectiveMaxDriveMinutes(600));
  });
});

// ─── computeSmartDepartureHour ────────────────────────────────────────────────

describe('computeSmartDepartureHour', () => {
  it('returns at least the minimum departure hour (not before 5 AM)', () => {
    // Very long drive — would suggest departing before 5 AM, should be clamped
    const result = computeSmartDepartureHour(makeSettings(), 20); // 20h drive
    expect(result).toBeGreaterThanOrEqual(5);
  });

  it('returns a reasonable hour when drive time fits within the day', () => {
    // 6h drive, target=21 → ideal departure = 21 - 6 = 15:00
    const result = computeSmartDepartureHour(makeSettings({ targetArrivalHour: 21 }), 6);
    expect(result).toBeGreaterThanOrEqual(5);
    expect(result).toBeLessThanOrEqual(21);
  });

  it('returns a number (not NaN or Infinity)', () => {
    const result = computeSmartDepartureHour(makeSettings(), 8);
    expect(Number.isFinite(result)).toBe(true);
  });
});

// ─── getTimezoneOffset ────────────────────────────────────────────────────────

describe('getTimezoneOffset', () => {
  it('CST → EST = +1 hour (Eastern is 1h ahead of Central)', () => {
    expect(getTimezoneOffset('CST', 'EST')).toBe(1);
  });

  it('EST → CST = -1 hour', () => {
    expect(getTimezoneOffset('EST', 'CST')).toBe(-1);
  });

  it('same zone → 0 offset', () => {
    expect(getTimezoneOffset('CDT', 'CDT')).toBe(0);
  });

  it('PST → EST = +3 hours', () => {
    expect(getTimezoneOffset('PST', 'EST')).toBe(3);
  });

  it('unknown zone → treated as offset 0', () => {
    expect(getTimezoneOffset('XYZ', 'CST')).toBe(-6); // 0 - (-6) = 6... wait
    // XYZ offset = 0, CST offset = -6 → result = -6 - 0 = -6
    expect(getTimezoneOffset('XYZ', 'CST')).toBe(-6);
  });

  it('both unknown → 0 offset', () => {
    expect(getTimezoneOffset('FOO', 'BAR')).toBe(0);
  });
});

// ─── getTimezoneName ─────────────────────────────────────────────────────────

describe('getTimezoneName', () => {
  it('returns full name for CST', () => {
    expect(getTimezoneName('CST')).toBe('Central Standard Time');
  });

  it('returns full name for CDT', () => {
    expect(getTimezoneName('CDT')).toBe('Central Daylight Time');
  });

  it('returns full name for EST', () => {
    expect(getTimezoneName('EST')).toBe('Eastern Standard Time');
  });

  it('falls back to "<ABBR> Time Zone" for unknown abbreviations', () => {
    expect(getTimezoneName('XYZ')).toBe('XYZ Time Zone');
  });
});
