/**
 * sensitivity.ts — unit tests
 *
 * Tests for computeSensitivity (what-if scenarios) and
 * getSensitivityStatus (threshold → colour).
 *
 * Thresholds from TRIP_CONSTANTS.budget:
 *   tightThreshold = 0.85 → ≥ 85% → amber
 *   overThreshold  = 1.00 → > 100% → red
 *   (exactly 100% is still amber — the condition is strictly >)
 *
 * 💚 My Experience Engine
 */
import { describe, it, expect } from 'vitest';
import { computeSensitivity, getSensitivityStatus } from './sensitivity';
import type { BudgetSensitivitySummary } from '../trip-summary-slices';
import { makeSettings, makeBudget } from '../../test/fixtures';

// ─── Fixture factory ──────────────────────────────────────────────────────────

/**
 * Minimal BudgetSensitivitySummary from explicit cost values.
 * total is always the sum of the four categories.
 */
function makeBreakdown(
  fuel = 200,
  accommodation = 300,
  meals = 150,
  misc = 50,
): BudgetSensitivitySummary {
  const total = fuel + accommodation + meals + misc;
  return {
    costBreakdown: { fuel, accommodation, meals, misc, total, perPerson: total / 2 },
  };
}

// ─── computeSensitivity ───────────────────────────────────────────────────────

describe('computeSensitivity', () => {
  it('returns empty array when costBreakdown is absent', () => {
    // BudgetSensitivitySummary with no breakdown — early-exit guard
    expect(computeSensitivity({ costBreakdown: undefined }, makeSettings())).toEqual([]);
  });

  it('always returns exactly three scenarios', () => {
    expect(computeSensitivity(makeBreakdown(), makeSettings())).toHaveLength(3);
  });

  it('scenario labels are Base, +10% Fuel, +1 Night (in order)', () => {
    const labels = computeSensitivity(makeBreakdown(), makeSettings()).map(s => s.label);
    expect(labels).toEqual(['Base', '+10% Fuel', '+1 Night']);
  });

  it('Base: gasCost/hotelCost/totalCost match the breakdown exactly', () => {
    const base = computeSensitivity(makeBreakdown(200, 300, 150, 50), makeSettings())[0];
    expect(base.gasCost).toBe(200);
    expect(base.hotelCost).toBe(300);
    expect(base.totalCost).toBe(700); // 200+300+150+50
  });

  it('+10% Fuel: gasCost = baseGas * 1.1, hotelCost unchanged, totalCost increases', () => {
    const fuelUp = computeSensitivity(makeBreakdown(200, 300, 150, 50), makeSettings())[1];
    expect(fuelUp.gasCost).toBeCloseTo(220);
    expect(fuelUp.hotelCost).toBe(300);
    expect(fuelUp.totalCost).toBeCloseTo(720); // 220+300+150+50
  });

  it('+1 Night: hotelCost increases by hotelPricePerNight, totalCost increases the same amount', () => {
    const settings = makeSettings({ hotelPricePerNight: 120 });
    const extraNight = computeSensitivity(makeBreakdown(200, 300, 150, 50), settings)[2];
    expect(extraNight.gasCost).toBe(200);
    expect(extraNight.hotelCost).toBe(300 + 120);
    expect(extraNight.totalCost).toBe(700 + 120);
  });

  it('in open mode: all pctOfBudget values are null', () => {
    const openSettings = makeSettings({ budgetMode: 'open' });
    const result = computeSensitivity(makeBreakdown(), openSettings);
    result.forEach(s => expect(s.pctOfBudget).toBeNull());
  });

  it('in plan-to-budget mode with budget.total = 0: pctOfBudget is null (no active budget)', () => {
    // budget.total = 0 → isPlanMode = false → pct() returns null
    const settings = makeSettings({ budget: makeBudget({ total: 0 }) });
    const result = computeSensitivity(makeBreakdown(), settings);
    result.forEach(s => expect(s.pctOfBudget).toBeNull());
  });

  it('in plan-to-budget mode: pctOfBudget = round(cost / budget.total * 100)', () => {
    // budget.total = 1000, base cost = 700 → 70%
    const settings = makeSettings({ budget: makeBudget({ total: 1000 }) });
    const base = computeSensitivity(makeBreakdown(200, 300, 150, 50), settings)[0];
    expect(base.pctOfBudget).toBe(70);
  });

  it('+10% Fuel pctOfBudget is higher than Base when in plan mode', () => {
    const settings = makeSettings({ budget: makeBudget({ total: 1000 }) });
    const [base, fuelUp] = computeSensitivity(makeBreakdown(200, 300, 150, 50), settings);
    expect(fuelUp.pctOfBudget!).toBeGreaterThan(base.pctOfBudget!);
  });
});

// ─── getSensitivityStatus ─────────────────────────────────────────────────────

describe('getSensitivityStatus', () => {
  it('returns null when pctOfBudget is null (open mode)', () => {
    expect(getSensitivityStatus(null)).toBeNull();
  });

  it('returns green when well under tightThreshold (70%)', () => {
    expect(getSensitivityStatus(70)).toBe('green');
  });

  it('returns green at 84% (just below tightThreshold = 85%)', () => {
    expect(getSensitivityStatus(84)).toBe('green');
  });

  it('returns amber at exactly tightThreshold (85%)', () => {
    expect(getSensitivityStatus(85)).toBe('amber');
  });

  it('returns amber between tight and over threshold (95%)', () => {
    expect(getSensitivityStatus(95)).toBe('amber');
  });

  it('returns amber at exactly 100% (overThreshold is strictly >, so 100 is still amber)', () => {
    expect(getSensitivityStatus(100)).toBe('amber');
  });

  it('returns red when strictly above overThreshold (101%)', () => {
    expect(getSensitivityStatus(101)).toBe('red');
  });
});
