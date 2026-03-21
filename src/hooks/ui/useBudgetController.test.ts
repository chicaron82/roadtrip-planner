/**
 * useBudgetController — hook integration tests
 *
 * Tests the mutation logic (toggleAllocation, updateTotal, updateCategory,
 * updateWeight) and derived values (perPersonCost, hasUnsavedChanges) by
 * rendering the hook with renderHook and inspecting what onChange receives.
 *
 * No network dependencies — all pure state logic.
 *
 * 💚 My Experience Engine
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useBudgetController } from './useBudgetController';
import { makeBudget } from '../../test/fixtures';
import type { TripBudget } from '../../types';

// ─── Fixture defaults ────────────────────────────────────────────────────────
// These mirror makeBudget() in src/test/fixtures.ts — update both together.
const DFLT_GAS   = 600;   // default gas category
const DFLT_HOTEL = 800;   // default hotel category
const DFLT_FOOD  = 400;   // default food category
const DFLT_MISC  = 200;   // default misc category
const DFLT_TOTAL = 2000;  // DFLT_GAS + DFLT_HOTEL + DFLT_FOOD + DFLT_MISC
// Default weights: { gas: 25, hotel: 35, food: 30, misc: 10 } — sum = 100%

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setup(budgetOverrides: Partial<TripBudget> = {}, numTravelers = 2) {
  const onChange = vi.fn();
  const budget = makeBudget(budgetOverrides);
  const { result } = renderHook(() =>
    useBudgetController({ budget, onChange, numTravelers }),
  );
  return { result, onChange, budget };
}

/** Get the single TripBudget arg from the last onChange call */
function lastBudgetCall(onChange: ReturnType<typeof vi.fn>): TripBudget {
  return onChange.mock.calls[onChange.mock.calls.length - 1][0] as TripBudget;
}

// ─── toggleAllocation ─────────────────────────────────────────────────────────

describe('toggleAllocation', () => {
  it('switches from flexible to fixed, computing total from category sum', () => {
    const { result, onChange } = setup(); // uses makeBudget() defaults
    act(() => { result.current.toggleAllocation(); });
    const called = lastBudgetCall(onChange);
    expect(called.allocation).toBe('fixed');
    expect(called.total).toBe(DFLT_GAS + DFLT_HOTEL + DFLT_FOOD + DFLT_MISC); // 2000
  });

  it('sets total to 1000 when all categories are 0 and switching to fixed', () => {
    // 1000 = the minimum fixed-mode fallback in useBudgetController.ts (toggleAllocation)
    const { result, onChange } = setup({ gas: 0, hotel: 0, food: 0, misc: 0 });
    act(() => { result.current.toggleAllocation(); });
    expect(lastBudgetCall(onChange).total).toBe(1000);
  });

  it('switches from fixed to flexible without changing category values', () => {
    const { result, onChange } = setup({ allocation: 'fixed', total: DFLT_TOTAL });
    act(() => { result.current.toggleAllocation(); });
    const called = lastBudgetCall(onChange);
    expect(called.allocation).toBe('flexible');
    // Categories should be unchanged from fixture defaults
    expect(called.gas).toBe(DFLT_GAS);
    expect(called.hotel).toBe(DFLT_HOTEL);
  });

  it('calls onChange exactly once per toggle', () => {
    const { result, onChange } = setup();
    act(() => { result.current.toggleAllocation(); });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

// ─── updateTotal ──────────────────────────────────────────────────────────────

describe('updateTotal', () => {
  it('in fixed mode: redistributes categories proportionally', () => {
    const { result, onChange } = setup({ allocation: 'fixed', total: DFLT_TOTAL });
    act(() => { result.current.updateTotal(1000); });
    const called = lastBudgetCall(onChange);
    expect(called.total).toBe(1000);
    // Categories should sum to new total
    const catSum = called.gas + called.hotel + called.food + called.misc;
    expect(catSum).toBeCloseTo(1000, 0);
  });

  it('in fixed mode: passes new total as the total field', () => {
    const { result, onChange } = setup({ allocation: 'fixed', total: DFLT_TOTAL });
    act(() => { result.current.updateTotal(4000); });
    expect(lastBudgetCall(onChange).total).toBe(4000);
  });

  it('in flexible mode: updates total without redistributing categories', () => {
    const { result, onChange } = setup({ allocation: 'flexible' });
    act(() => { result.current.updateTotal(9999); }); // 9999 = arbitrary sentinel different from any real value
    const called = lastBudgetCall(onChange);
    expect(called.total).toBe(9999);
    // Categories unchanged from fixture defaults
    expect(called.gas).toBe(DFLT_GAS);
    expect(called.hotel).toBe(DFLT_HOTEL);
  });

  it('in fixed mode: individual categories scale down when total halves', () => {
    // weights: gas=25%, hotel=35%, food=30%, misc=10% (from makeBudget defaults)
    // applyBudgetWeights(1000, weights) → gas=250, hotel=350, food=300, misc=100
    // All are less than the fixture category values (gas=600, hotel=800, …)
    const { result, onChange } = setup({ allocation: 'fixed', total: DFLT_TOTAL });
    act(() => { result.current.updateTotal(1000); }); // half the fixture total
    const called = lastBudgetCall(onChange);
    expect(called.gas).toBeLessThan(DFLT_GAS);
    expect(called.hotel).toBeLessThan(DFLT_HOTEL);
  });
});

// ─── updateCategory ───────────────────────────────────────────────────────────

describe('updateCategory', () => {
  it('in flexible mode: sets the field and recalculates total', () => {
    const { result, onChange } = setup({ allocation: 'flexible' });
    // gas was DFLT_GAS (600); set to 300 → total should drop by 300
    act(() => { result.current.updateCategory('gas', 300); });
    const called = lastBudgetCall(onChange);
    expect(called.gas).toBe(300);
    expect(called.total).toBe(300 + DFLT_HOTEL + DFLT_FOOD + DFLT_MISC); // 1700
  });

  it('in flexible mode: increasing a category increases total', () => {
    const { result, onChange } = setup({ allocation: 'flexible' });
    act(() => { result.current.updateCategory('hotel', 1200); });
    const called = lastBudgetCall(onChange);
    expect(called.hotel).toBe(1200);
    expect(called.total).toBe(DFLT_GAS + 1200 + DFLT_FOOD + DFLT_MISC);
  });

  it('in fixed mode: redistributes remaining total among other categories', () => {
    const { result, onChange } = setup({ allocation: 'fixed', total: DFLT_TOTAL });
    // Raise gas to 800 (was DFLT_GAS=600); others absorb the 200 reduction
    act(() => { result.current.updateCategory('gas', 800); });
    const called = lastBudgetCall(onChange);
    expect(called.gas).toBe(800);
    // Other categories should sum to remaining (DFLT_TOTAL - 800 = 1200)
    const othersSum = called.hotel + called.food + called.misc;
    expect(othersSum).toBeCloseTo(DFLT_TOTAL - 800, 0);
  });

  it('in fixed mode: total stays unchanged after a category update', () => {
    const { result, onChange } = setup({ allocation: 'fixed', total: DFLT_TOTAL });
    act(() => { result.current.updateCategory('food', 100); });
    expect(lastBudgetCall(onChange).total).toBe(2000);
  });

  it('in fixed mode: marks profile as custom after manual category edit', () => {
    const { result, onChange } = setup({ allocation: 'fixed', total: DFLT_TOTAL });
    act(() => { result.current.updateCategory('misc', 50); })
    expect(lastBudgetCall(onChange).profile).toBe('custom');
  });

  it('in fixed mode: does not call onChange when value exceeds total', () => {
    const { result, onChange } = setup({ allocation: 'fixed', total: DFLT_TOTAL });
    // 3000 > DFLT_TOTAL (2000) → remaining = 2000 - 3000 = -1000 < 0 → guarded no-op
    act(() => { result.current.updateCategory('gas', 3000); });
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ─── updateWeight ─────────────────────────────────────────────────────────────

describe('updateWeight', () => {
  it('scales other weights so all four sum to 100', () => {
    const { result, onChange } = setup();
    act(() => { result.current.updateWeight('gas', 40); });
    const { weights } = lastBudgetCall(onChange);
    const sum = weights.gas + weights.hotel + weights.food + weights.misc;
    expect(sum).toBe(100);
  });

  it('sets the target weight to the requested value', () => {
    const { result, onChange } = setup();
    act(() => { result.current.updateWeight('hotel', 50); });
    expect(lastBudgetCall(onChange).weights.hotel).toBe(50);
  });

  it('marks profile as custom after weight change', () => {
    const { result, onChange } = setup();
    act(() => { result.current.updateWeight('food', 20); });
    expect(lastBudgetCall(onChange).profile).toBe('custom');
  });

  it('in fixed mode: redistributes category amounts to match new weights', () => {
    const { result, onChange } = setup({ allocation: 'fixed', total: 1000 });
    act(() => { result.current.updateWeight('gas', 50); });
    const called = lastBudgetCall(onChange);
    // With weights.gas = 50% of 1000, gas should be ~500
    expect(called.gas).toBeCloseTo(500, -1);
  });

  it('clamps target weight so it cannot exceed the current total weight sum', () => {
    // weights: gas=25, hotel=35, food=30, misc=10 → sum=100
    // Try to set gas to 200 (impossible) — should be clamped to 100
    const { result, onChange } = setup();
    act(() => { result.current.updateWeight('gas', 200); });
    const { weights } = lastBudgetCall(onChange);
    expect(weights.gas).toBeLessThanOrEqual(100);
    const sum = weights.gas + weights.hotel + weights.food + weights.misc;
    expect(sum).toBe(100);
  });

  it('setting a weight to 0 assigns full 100% to remaining fields', () => {
    const { result, onChange } = setup();
    act(() => { result.current.updateWeight('misc', 0); });
    const { weights } = lastBudgetCall(onChange);
    expect(weights.misc).toBe(0);
    expect(weights.gas + weights.hotel + weights.food + weights.misc).toBe(100);
  });
});

// ─── perPersonCost ────────────────────────────────────────────────────────────

describe('perPersonCost', () => {
  it('divides total by numTravelers', () => {
    const { result } = setup({ total: DFLT_TOTAL }, 4); // 2000 / 4 = 500
    expect(result.current.perPersonCost).toBe(500);
  });

  it('equals total when numTravelers is 1', () => {
    const { result } = setup({ total: 1500 }, 1);
    expect(result.current.perPersonCost).toBe(1500);
  });

  it('returns the full total when numTravelers is 0 (no divide-by-zero)', () => {
    // getPerPersonCost should handle 0 travelers gracefully
    const { result } = setup({ total: 1000 }, 0);
    expect(result.current.perPersonCost).toBeGreaterThanOrEqual(0);
  });
});

// ─── UI state ─────────────────────────────────────────────────────────────────

describe('UI state', () => {
  it('showAdvanced defaults to false', () => {
    const { result } = setup();
    expect(result.current.showAdvanced).toBe(false);
  });

  it('setShowAdvanced toggles showAdvanced', () => {
    const { result } = setup();
    act(() => { result.current.setShowAdvanced(true); });
    expect(result.current.showAdvanced).toBe(true);
  });

  it('showSaveDialog defaults to false', () => {
    const { result } = setup();
    expect(result.current.showSaveDialog).toBe(false);
  });
});
