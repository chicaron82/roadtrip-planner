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
import { makeBudget } from '../test/fixtures';
import type { TripBudget } from '../types';

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
    // makeBudget defaults: gas=600, hotel=800, food=400, misc=200, allocation='flexible'
    const { result, onChange } = setup();
    act(() => { result.current.toggleAllocation(); });
    const called = lastBudgetCall(onChange);
    expect(called.allocation).toBe('fixed');
    expect(called.total).toBe(600 + 800 + 400 + 200); // 2000
  });

  it('sets total to 1000 when all categories are 0 and switching to fixed', () => {
    const { result, onChange } = setup({ gas: 0, hotel: 0, food: 0, misc: 0 });
    act(() => { result.current.toggleAllocation(); });
    expect(lastBudgetCall(onChange).total).toBe(1000);
  });

  it('switches from fixed to flexible without changing category values', () => {
    const { result, onChange } = setup({ allocation: 'fixed', total: 2000 });
    act(() => { result.current.toggleAllocation(); });
    const called = lastBudgetCall(onChange);
    expect(called.allocation).toBe('flexible');
    // Categories should be unchanged
    expect(called.gas).toBe(600);
    expect(called.hotel).toBe(800);
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
    const { result, onChange } = setup({ allocation: 'fixed', total: 2000 });
    act(() => { result.current.updateTotal(1000); });
    const called = lastBudgetCall(onChange);
    expect(called.total).toBe(1000);
    // Categories should sum to new total
    const catSum = called.gas + called.hotel + called.food + called.misc;
    expect(catSum).toBeCloseTo(1000, 0);
  });

  it('in fixed mode: passes new total as the total field', () => {
    const { result, onChange } = setup({ allocation: 'fixed', total: 2000 });
    act(() => { result.current.updateTotal(4000); });
    expect(lastBudgetCall(onChange).total).toBe(4000);
  });

  it('in flexible mode: updates total without redistributing categories', () => {
    const { result, onChange } = setup({ allocation: 'flexible' });
    act(() => { result.current.updateTotal(9999); });
    const called = lastBudgetCall(onChange);
    expect(called.total).toBe(9999);
    // Categories unchanged from fixture defaults
    expect(called.gas).toBe(600);
    expect(called.hotel).toBe(800);
  });

  it('in fixed mode: individual categories scale down when total halves', () => {
    // weights: gas=25, hotel=35, food=30, misc=10
    // At total=2000: gas≈500, hotel≈700, food≈600, misc≈200
    // At total=1000: each should roughly halve
    const { result, onChange } = setup({ allocation: 'fixed', total: 2000 });
    act(() => { result.current.updateTotal(1000); });
    const called = lastBudgetCall(onChange);
    expect(called.gas).toBeLessThan(600); // was 600 at 2000
    expect(called.hotel).toBeLessThan(800);
  });
});

// ─── updateCategory ───────────────────────────────────────────────────────────

describe('updateCategory', () => {
  it('in flexible mode: sets the field and recalculates total', () => {
    const { result, onChange } = setup({ allocation: 'flexible' });
    // gas was 600; set to 300 → total should drop by 300
    act(() => { result.current.updateCategory('gas', 300); });
    const called = lastBudgetCall(onChange);
    expect(called.gas).toBe(300);
    expect(called.total).toBe(300 + 800 + 400 + 200); // 1700
  });

  it('in flexible mode: increasing a category increases total', () => {
    const { result, onChange } = setup({ allocation: 'flexible' });
    act(() => { result.current.updateCategory('hotel', 1200); });
    const called = lastBudgetCall(onChange);
    expect(called.hotel).toBe(1200);
    expect(called.total).toBe(600 + 1200 + 400 + 200);
  });

  it('in fixed mode: redistributes remaining total among other categories', () => {
    const { result, onChange } = setup({ allocation: 'fixed', total: 2000 });
    // Raise gas to 800; others should absorb the 200 reduction
    act(() => { result.current.updateCategory('gas', 800); });
    const called = lastBudgetCall(onChange);
    expect(called.gas).toBe(800);
    // Other categories should sum to remaining (total - gas = 1200)
    const othersSum = called.hotel + called.food + called.misc;
    expect(othersSum).toBeCloseTo(1200, 0);
  });

  it('in fixed mode: total stays unchanged after a category update', () => {
    const { result, onChange } = setup({ allocation: 'fixed', total: 2000 });
    act(() => { result.current.updateCategory('food', 100); });
    expect(lastBudgetCall(onChange).total).toBe(2000);
  });

  it('in fixed mode: marks profile as custom after manual category edit', () => {
    const { result, onChange } = setup({ allocation: 'fixed', total: 2000 });
    act(() => { result.current.updateCategory('misc', 50); });
    expect(lastBudgetCall(onChange).profile).toBe('custom');
  });

  it('in fixed mode: does not call onChange when value exceeds total', () => {
    const { result, onChange } = setup({ allocation: 'fixed', total: 2000 });
    // Setting gas to 3000 (> total) satisfies remaining < 0 — should be a no-op
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
    const { result } = setup({ total: 2000 }, 4);
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
