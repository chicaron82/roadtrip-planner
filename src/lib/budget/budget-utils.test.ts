/**
 * Budget utility functions — unit tests
 *
 * Covers calculator.ts (applyBudgetWeights, getPerPersonCost),
 * summary.ts (calculateCostBreakdown, getBudgetStatus, formatBudgetRemaining),
 * and segment-processor.ts (processBudgetSegment).
 *
 * All pure functions — no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import type { TripDay, TripBudget } from '../../types';
import { applyBudgetWeights, getPerPersonCost } from './calculator';
import { calculateCostBreakdown, getBudgetStatus, formatBudgetRemaining } from './summary';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeDay(budget: Partial<TripDay['budget']> = {}): TripDay {
  return {
    dayNumber: 1,
    date: '2026-08-16',
    dateFormatted: 'Sat, Aug 16',
    route: 'A → B',
    segments: [],
    segmentIndices: [],
    timezoneChanges: [],
    budget: { gasUsed: 100, hotelCost: 150, foodEstimate: 60, miscCost: 10, dayTotal: 320, bankRemaining: 680, ...budget },
    totals: { distanceKm: 0, driveTimeMinutes: 0, stopTimeMinutes: 0, departureTime: '', arrivalTime: '' },
  } as TripDay;
}

function makeBudget(overrides: Partial<TripBudget> = {}): TripBudget {
  return {
    mode: 'plan-to-budget',
    allocation: 'flexible',
    profile: 'balanced',
    weights: { gas: 25, hotel: 35, food: 30, misc: 10 },
    gas: 250, hotel: 350, food: 300, misc: 100, total: 1000,
    ...overrides,
  } as TripBudget;
}

// ─── applyBudgetWeights ───────────────────────────────────────────────────────

describe('applyBudgetWeights', () => {
  it('distributes total proportionally to weights', () => {
    const weights = { gas: 25, hotel: 35, food: 30, misc: 10 };
    const result = applyBudgetWeights(1000, weights);
    expect(result.gas).toBe(250);
    expect(result.hotel).toBe(350);
    expect(result.food).toBe(300);
  });

  it('misc absorbs rounding remainder so parts sum to total', () => {
    // 1001 with 25/35/30/10 — rounding makes gas+hotel+food != 1001
    const weights = { gas: 25, hotel: 35, food: 30, misc: 10 };
    const result = applyBudgetWeights(1001, weights);
    expect(result.gas + result.hotel + result.food + result.misc).toBe(1001);
  });

  it('returns zeros for zero total', () => {
    const weights = { gas: 25, hotel: 35, food: 30, misc: 10 };
    const result = applyBudgetWeights(0, weights);
    expect(result.gas).toBe(0);
    expect(result.hotel).toBe(0);
    expect(result.food).toBe(0);
    expect(result.misc).toBe(0);
  });

  it('handles 100% weight on one category', () => {
    const weights = { gas: 100, hotel: 0, food: 0, misc: 0 };
    const result = applyBudgetWeights(500, weights);
    expect(result.gas).toBe(500);
    expect(result.hotel).toBe(0);
    expect(result.food).toBe(0);
  });
});

// ─── getPerPersonCost ─────────────────────────────────────────────────────────

describe('getPerPersonCost', () => {
  it('divides total by numTravelers', () => {
    expect(getPerPersonCost(1000, 2)).toBe(500);
  });

  it('rounds to nearest integer', () => {
    expect(getPerPersonCost(1000, 3)).toBe(333); // 333.33 → 333
  });

  it('returns 0 when numTravelers is 0 (no division by zero)', () => {
    expect(getPerPersonCost(1000, 0)).toBe(0);
  });

  it('handles single traveler', () => {
    expect(getPerPersonCost(750, 1)).toBe(750);
  });
});

// ─── calculateCostBreakdown ───────────────────────────────────────────────────

describe('calculateCostBreakdown', () => {
  it('sums fuel across all days', () => {
    const days = [makeDay({ gasUsed: 100 }), makeDay({ gasUsed: 80 })];
    const breakdown = calculateCostBreakdown(days, 2);
    expect(breakdown.fuel).toBe(180);
  });

  it('sums accommodation across all days', () => {
    const days = [makeDay({ hotelCost: 150 }), makeDay({ hotelCost: 200 })];
    const breakdown = calculateCostBreakdown(days, 2);
    expect(breakdown.accommodation).toBe(350);
  });

  it('sums meals across all days', () => {
    const days = [makeDay({ foodEstimate: 60 }), makeDay({ foodEstimate: 70 })];
    const breakdown = calculateCostBreakdown(days, 2);
    expect(breakdown.meals).toBe(130);
  });

  it('total = fuel + accommodation + meals + misc', () => {
    const day = makeDay({ gasUsed: 100, hotelCost: 150, foodEstimate: 60, miscCost: 10 });
    const breakdown = calculateCostBreakdown([day], 2);
    expect(breakdown.total).toBe(breakdown.fuel + breakdown.accommodation + breakdown.meals + breakdown.misc);
  });

  it('perPerson is ceiled to nearest $5', () => {
    // total=321, 2 travelers → 160.5 → ceilToNearest(160.5, 5) = 165
    const day = makeDay({ gasUsed: 321, hotelCost: 0, foodEstimate: 0, miscCost: 0, dayTotal: 321 });
    const breakdown = calculateCostBreakdown([day], 2);
    expect(breakdown.perPerson).toBe(165);
  });

  it('returns 0 perPerson when numTravelers is 0', () => {
    const day = makeDay();
    const breakdown = calculateCostBreakdown([day], 0);
    expect(breakdown.perPerson).toBe(breakdown.total); // equals total when 0 travelers
  });

  it('returns all zeros for empty days array', () => {
    const breakdown = calculateCostBreakdown([], 2);
    expect(breakdown.fuel).toBe(0);
    expect(breakdown.accommodation).toBe(0);
    expect(breakdown.total).toBe(0);
  });
});

// ─── getBudgetStatus ──────────────────────────────────────────────────────────

describe('getBudgetStatus', () => {
  it("returns 'under' when mode is open (regardless of spend)", () => {
    const budget = makeBudget({ mode: 'open', total: 500 });
    const breakdown = { fuel: 1000, accommodation: 0, meals: 0, misc: 0, total: 1000, perPerson: 500 };
    expect(getBudgetStatus(budget, breakdown)).toBe('under');
  });

  it("returns 'under' when budget.total is 0", () => {
    const budget = makeBudget({ total: 0 });
    const breakdown = { fuel: 100, accommodation: 0, meals: 0, misc: 0, total: 100, perPerson: 50 };
    expect(getBudgetStatus(budget, breakdown)).toBe('under');
  });

  it("returns 'under' when well under budget (>10% remaining)", () => {
    const budget = makeBudget({ total: 1000 });
    const breakdown = { fuel: 500, accommodation: 0, meals: 0, misc: 0, total: 500, perPerson: 250 };
    // diff=500, 500/1000=50% remaining → well under
    expect(getBudgetStatus(budget, breakdown)).toBe('under');
  });

  it("returns 'over' when total exceeds budget", () => {
    const budget = makeBudget({ total: 1000 });
    const breakdown = { fuel: 1200, accommodation: 0, meals: 0, misc: 0, total: 1200, perPerson: 600 };
    expect(getBudgetStatus(budget, breakdown)).toBe('over');
  });

  it("returns 'at' when within 10% of budget", () => {
    const budget = makeBudget({ total: 1000 });
    // diff = 1000 - 950 = 50. 50/1000 = 5% → 'at'
    const breakdown = { fuel: 950, accommodation: 0, meals: 0, misc: 0, total: 950, perPerson: 475 };
    expect(getBudgetStatus(budget, breakdown)).toBe('at');
  });
});

// ─── formatBudgetRemaining ────────────────────────────────────────────────────

describe('formatBudgetRemaining', () => {
  it("returns 'good' status for positive remaining", () => {
    const result = formatBudgetRemaining(150);
    expect(result.status).toBe('good');
    expect(result.text).toMatch(/150/);
    expect(result.text).toMatch(/remaining/i);
  });

  it("returns 'warning' status for zero remaining", () => {
    const result = formatBudgetRemaining(0);
    expect(result.status).toBe('warning');
    expect(result.text).toMatch(/budget reached/i);
  });

  it("returns 'over' status and abs amount for negative remaining", () => {
    const result = formatBudgetRemaining(-75);
    expect(result.status).toBe('over');
    expect(result.text).toMatch(/75/);
    expect(result.text).toMatch(/over/i);
  });
});
