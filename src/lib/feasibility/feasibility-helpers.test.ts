/**
 * feasibility helpers and refinements — unit tests
 *
 * deriveStatus, calculateTotalBudgetUsed (helpers.ts)
 * compareRefinements (refinements.ts)
 *
 * All pure functions — no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import type { TripDay } from '../../types';
import type { FeasibilityResult, FeasibilityWarning } from './types';
import { deriveStatus, calculateTotalBudgetUsed } from './helpers';
import { compareRefinements } from './refinements';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeDay(dayTotal: number): TripDay {
  return {
    dayNumber: 1, date: '2026-08-16', dateFormatted: 'Sat', route: 'A → B',
    segments: [], segmentIndices: [], timezoneChanges: [],
    budget: { gasUsed: dayTotal, hotelCost: 0, foodEstimate: 0, miscCost: 0, dayTotal, bankRemaining: 0 },
    totals: { distanceKm: 0, driveTimeMinutes: 0, stopTimeMinutes: 0, departureTime: '', arrivalTime: '' },
  } as TripDay;
}

function makeWarning(severity: FeasibilityWarning['severity']): FeasibilityWarning {
  return { category: 'drive-time', severity, message: 'test' };
}

function makeResult(overrides: Partial<FeasibilityResult['summary']> = {}): FeasibilityResult {
  return {
    status: 'on-track',
    warnings: [],
    summary: {
      totalBudgetUsed: 500, totalBudgetAvailable: 1000, budgetUtilization: 0.5,
      longestDriveDay: 360, maxDriveLimit: 600, perPersonCost: 250, totalDays: 2,
      ...overrides,
    },
  };
}

// ─── calculateTotalBudgetUsed ─────────────────────────────────────────────────

describe('calculateTotalBudgetUsed', () => {
  it('returns 0 for empty days', () => {
    expect(calculateTotalBudgetUsed([])).toBe(0);
  });

  it('sums dayTotal across all days', () => {
    expect(calculateTotalBudgetUsed([makeDay(100), makeDay(200)])).toBe(300);
  });

  it('handles single day', () => {
    expect(calculateTotalBudgetUsed([makeDay(450)])).toBe(450);
  });
});

// ─── deriveStatus ─────────────────────────────────────────────────────────────

describe('deriveStatus', () => {
  it("returns 'on-track' for empty warnings", () => {
    expect(deriveStatus([])).toBe('on-track');
  });

  it("returns 'on-track' for info-only warnings", () => {
    expect(deriveStatus([makeWarning('info')])).toBe('on-track');
  });

  it("returns 'tight' when at least one warning exists", () => {
    expect(deriveStatus([makeWarning('warning')])).toBe('tight');
  });

  it("returns 'over' when at least one critical warning exists", () => {
    expect(deriveStatus([makeWarning('critical')])).toBe('over');
  });

  it("returns 'over' even when mixed with warnings and info", () => {
    expect(deriveStatus([makeWarning('info'), makeWarning('warning'), makeWarning('critical')])).toBe('over');
  });
});

// ─── compareRefinements ───────────────────────────────────────────────────────

describe('compareRefinements — traveler changes', () => {
  it('returns empty when nothing changed', () => {
    const before = makeResult({ perPersonCost: 250 });
    const after  = makeResult({ perPersonCost: 250 });
    expect(compareRefinements(before, after, {})).toHaveLength(0);
  });

  it('emits passenger warning when traveler count changes', () => {
    const before = makeResult({ perPersonCost: 500 });
    const after  = makeResult({ perPersonCost: 250 });
    const warnings = compareRefinements(before, after, { travelersBefore: 1, travelersAfter: 2 });
    expect(warnings.some(w => w.category === 'passenger')).toBe(true);
  });

  it('warning severity is info when cost diff <= $50', () => {
    const before = makeResult({ perPersonCost: 300 });
    const after  = makeResult({ perPersonCost: 330 }); // +$30 diff → info
    const warnings = compareRefinements(before, after, { travelersBefore: 2, travelersAfter: 3 });
    const w = warnings.find(x => x.category === 'passenger');
    expect(w?.severity).toBe('info');
  });

  it('warning severity is warning when cost diff > $50', () => {
    const before = makeResult({ perPersonCost: 200 });
    const after  = makeResult({ perPersonCost: 260 }); // +$60 diff → warning
    const warnings = compareRefinements(before, after, { travelersBefore: 3, travelersAfter: 4 });
    const w = warnings.find(x => x.category === 'passenger');
    expect(w?.severity).toBe('warning');
  });

  it('message references "decreased" when per-person cost goes down', () => {
    const before = makeResult({ perPersonCost: 400 });
    const after  = makeResult({ perPersonCost: 250 });
    const warnings = compareRefinements(before, after, { travelersBefore: 2, travelersAfter: 3 });
    const w = warnings.find(x => x.category === 'passenger');
    expect(w?.message).toMatch(/decreased/i);
  });
});

describe('compareRefinements — driver changes', () => {
  it('emits driver warning when drivers reduced to 1', () => {
    const before = makeResult();
    const after  = makeResult();
    const warnings = compareRefinements(before, after, { driversBefore: 2, driversAfter: 1 });
    const w = warnings.find(x => x.category === 'driver');
    expect(w).toBeDefined();
    expect(w?.severity).toBe('warning');
  });

  it('emits info when drivers reduced from 3 to 2', () => {
    const before = makeResult();
    const after  = makeResult();
    const warnings = compareRefinements(before, after, { driversBefore: 3, driversAfter: 2 });
    const w = warnings.find(x => x.category === 'driver');
    expect(w?.severity).toBe('info');
  });

  it('does not emit driver warning when drivers increase', () => {
    const before = makeResult();
    const after  = makeResult();
    const warnings = compareRefinements(before, after, { driversBefore: 1, driversAfter: 2 });
    expect(warnings.filter(x => x.category === 'driver')).toHaveLength(0);
  });
});

describe('compareRefinements — stop changes', () => {
  it('emits warning when stops are added', () => {
    const before = makeResult({ longestDriveDay: 300 });
    const after  = makeResult({ longestDriveDay: 400 }); // 100min longer
    const warnings = compareRefinements(before, after, { stopsAdded: 2 });
    expect(warnings.some(w => w.category !== 'passenger' && w.category !== 'driver')).toBe(true);
  });

  it('returns empty when stopsAdded is 0', () => {
    const before = makeResult();
    const after  = makeResult();
    const warnings = compareRefinements(before, after, { stopsAdded: 0 });
    expect(warnings).toHaveLength(0);
  });
});
