/**
 * budget/sanity-hints.ts — unit tests for getBudgetSanityHints.
 *
 * Pure function — no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import type { CostBreakdown } from '../../types/route';
import { getBudgetSanityHints } from './sanity-hints';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeBreakdown(overrides: Partial<CostBreakdown> = {}): CostBreakdown {
  return {
    fuel: 100,
    accommodation: 100,
    meals: 100,
    misc: 100,
    total: 400,
    perPerson: 200,
    ...overrides,
  };
}

// ─── getBudgetSanityHints ─────────────────────────────────────────────────────

describe('getBudgetSanityHints', () => {
  it('returns empty when total is 0', () => {
    const b = makeBreakdown({ fuel: 0, accommodation: 0, meals: 0, misc: 0, total: 0 });
    expect(getBudgetSanityHints(b)).toHaveLength(0);
  });

  it('returns empty when only one category is non-zero (< 2 non-zero guard)', () => {
    const b = makeBreakdown({ fuel: 500, accommodation: 0, meals: 0, misc: 0, total: 500 });
    expect(getBudgetSanityHints(b)).toHaveLength(0);
  });

  it('returns empty when no category dominates (all equal split)', () => {
    // Each is 25% — below 65% threshold
    const b = makeBreakdown({ fuel: 100, accommodation: 100, meals: 100, misc: 100, total: 400 });
    expect(getBudgetSanityHints(b)).toHaveLength(0);
  });

  it('returns a hint when gas dominates at >= 65%', () => {
    // fuel=700, total=900 → 78% > 65
    const b = makeBreakdown({ fuel: 700, accommodation: 100, meals: 50, misc: 50, total: 900 });
    const hints = getBudgetSanityHints(b);
    expect(hints.length).toBeGreaterThan(0);
    const gasHint = hints.find(h => h.category === 'Gas');
    expect(gasHint).toBeDefined();
    expect(gasHint?.emoji).toBe('⛽');
    expect(gasHint?.percentage).toBeGreaterThanOrEqual(65);
  });

  it('hint message contains the category name and percentage', () => {
    const b = makeBreakdown({ fuel: 700, accommodation: 100, meals: 50, misc: 50, total: 900 });
    const hints = getBudgetSanityHints(b);
    const gasHint = hints.find(h => h.category === 'Gas');
    expect(gasHint?.message).toMatch(/Gas/);
    expect(gasHint?.message).toMatch(/%/);
  });

  it('returns a hint when hotel dominates', () => {
    const b = makeBreakdown({ fuel: 50, accommodation: 700, meals: 50, misc: 50, total: 850 });
    const hints = getBudgetSanityHints(b);
    const hotelHint = hints.find(h => h.category === 'Hotel');
    expect(hotelHint).toBeDefined();
    expect(hotelHint?.emoji).toBe('🏨');
  });

  it('returns a hint when food dominates', () => {
    const b = makeBreakdown({ fuel: 50, accommodation: 50, meals: 700, misc: 50, total: 850 });
    const hints = getBudgetSanityHints(b);
    const foodHint = hints.find(h => h.category === 'Food');
    expect(foodHint).toBeDefined();
  });

  it('percentage is a whole number', () => {
    const b = makeBreakdown({ fuel: 700, accommodation: 100, meals: 50, misc: 50, total: 900 });
    const hints = getBudgetSanityHints(b);
    for (const hint of hints) {
      expect(Number.isInteger(hint.percentage)).toBe(true);
    }
  });

  it('does not emit hint when category is exactly at threshold boundary', () => {
    // 64% — just below threshold of 65
    // fuel=64, rest=36 of 100 total. But we need 2 non-zero.
    const b = makeBreakdown({ fuel: 64, accommodation: 36, meals: 0, misc: 0, total: 100 });
    const hints = getBudgetSanityHints(b);
    expect(hints.every(h => h.percentage >= 65)).toBe(true);
  });
});
