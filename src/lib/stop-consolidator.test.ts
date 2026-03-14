/**
 * stop-consolidator.ts — unit tests for applyComboOptimization.
 *
 * Two merge passes:
 *   Pass 1 — Meal absorbs a downstream fuel stop (wide 5h window).
 *   Pass 2 — Fuel pulls a nearby meal/rest forward (90min window).
 *
 * Tests verify combo creation, timeSavedMinutes, timestamp propagation,
 * window boundaries, overnight/departure anchors, and drive merging.
 *
 * Pure function — no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import { applyComboOptimization } from './stop-consolidator';
import type { TimedEvent } from './trip-timeline';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<TimedEvent> & { type: TimedEvent['type'] }): TimedEvent {
  const base: Date = overrides.arrivalTime ?? new Date('2026-08-16T10:00:00');
  const dur = overrides.durationMinutes ?? 15;
  return {
    id: `ev-${Math.random().toString(36).slice(2)}`,
    arrivalTime: base,
    departureTime: overrides.departureTime ?? new Date(base.getTime() + dur * 60_000),
    durationMinutes: dur,
    distanceFromOriginKm: 100,
    locationHint: 'Somewhere',
    stops: [],
    timezone: 'America/Winnipeg',
    ...overrides,
  };
}

function minutesAfter(date: Date, mins: number): Date {
  return new Date(date.getTime() + mins * 60_000);
}

// ─── Baseline ─────────────────────────────────────────────────────────────────

describe('applyComboOptimization — baseline', () => {
  it('returns the same events when no fuel/meal/rest events are present', () => {
    const drive = makeEvent({ type: 'drive', id: 'drive-1' });
    const result = applyComboOptimization([drive]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('drive');
  });

  it('returns empty array for empty input', () => {
    expect(applyComboOptimization([])).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const fuel  = makeEvent({ type: 'fuel', id: 'f1' });
    const meal  = makeEvent({ type: 'meal', id: 'm1', arrivalTime: minutesAfter(fuel.departureTime, 30) });
    meal.departureTime = minutesAfter(meal.arrivalTime, 30);
    const input = [fuel, meal];
    applyComboOptimization(input);
    expect(input[0].type).toBe('fuel'); // original untouched
  });
});

// ─── Pass 2: Fuel → nearby meal/rest (original pattern) ───────────────────────

describe('Pass 2 — fuel absorbs nearby meal/rest', () => {
  it('merges fuel + meal within window into a combo', () => {
    const fuelArr = new Date('2026-08-16T12:00:00');
    const fuel = makeEvent({ id: 'fuel-1', type: 'fuel', arrivalTime: fuelArr, durationMinutes: 15 });

    const mealArr = minutesAfter(fuel.departureTime, 20); // 20 min after fuel departs
    const meal = makeEvent({ id: 'meal-1', type: 'meal', arrivalTime: mealArr, durationMinutes: 45 });

    const result = applyComboOptimization([fuel, meal]);
    const combo = result.find(e => e.type === 'combo');
    expect(combo).toBeDefined();
    expect(combo!.id).toContain('fuel-1');
    expect(combo!.id).toContain('meal-1');
  });

  it('combo arrives at the fuel stop time', () => {
    const fuelArr = new Date('2026-08-16T12:00:00');
    const fuel = makeEvent({ id: 'fuel-1', type: 'fuel', arrivalTime: fuelArr, durationMinutes: 15 });
    const mealArr = minutesAfter(fuel.departureTime, 20);
    const meal = makeEvent({ id: 'meal-1', type: 'meal', arrivalTime: mealArr, durationMinutes: 45 });

    const result = applyComboOptimization([fuel, meal]);
    const combo = result.find(e => e.type === 'combo')!;
    expect(combo.arrivalTime.getTime()).toBe(fuelArr.getTime());
  });

  it('combo has 45min duration for fuel+meal', () => {
    const fuelArr = new Date('2026-08-16T12:00:00');
    const fuel = makeEvent({ id: 'fuel-1', type: 'fuel', arrivalTime: fuelArr, durationMinutes: 15 });
    const mealArr = minutesAfter(fuel.departureTime, 10);
    const meal = makeEvent({ id: 'meal-1', type: 'meal', arrivalTime: mealArr, durationMinutes: 45 });

    const result = applyComboOptimization([fuel, meal]);
    const combo = result.find(e => e.type === 'combo')!;
    expect(combo.durationMinutes).toBe(45);
  });

  it('combo has 20min duration for fuel+rest', () => {
    const fuelArr = new Date('2026-08-16T14:00:00');
    const fuel = makeEvent({ id: 'fuel-1', type: 'fuel', arrivalTime: fuelArr, durationMinutes: 15 });
    const restArr = minutesAfter(fuel.departureTime, 10);
    const rest = makeEvent({ id: 'rest-1', type: 'rest', arrivalTime: restArr, durationMinutes: 15 });

    const result = applyComboOptimization([fuel, rest]);
    const combo = result.find(e => e.type === 'combo')!;
    expect(combo.durationMinutes).toBe(20);
  });

  it('does not merge fuel + meal outside the 90min window', () => {
    const fuelArr = new Date('2026-08-16T10:00:00');
    const fuel = makeEvent({ id: 'fuel-1', type: 'fuel', arrivalTime: fuelArr, durationMinutes: 15 });
    const mealArr = minutesAfter(fuel.departureTime, 100); // > 90min gap
    const meal = makeEvent({ id: 'meal-1', type: 'meal', arrivalTime: mealArr, durationMinutes: 45 });

    const result = applyComboOptimization([fuel, meal]);
    expect(result.some(e => e.type === 'combo')).toBe(false);
  });

  it('calculates timeSavedMinutes > 0 when stops are merged', () => {
    const fuelArr = new Date('2026-08-16T12:00:00');
    const fuel = makeEvent({ id: 'fuel-1', type: 'fuel', arrivalTime: fuelArr, durationMinutes: 15 });
    const mealArr = minutesAfter(fuel.departureTime, 30);
    const meal = makeEvent({ id: 'meal-1', type: 'meal', arrivalTime: mealArr, durationMinutes: 45 });

    const result = applyComboOptimization([fuel, meal]);
    const combo = result.find(e => e.type === 'combo')!;
    expect(combo.timeSavedMinutes).toBeGreaterThan(0);
  });

  it('shifts downstream event timestamps back by time saved', () => {
    const fuelArr = new Date('2026-08-16T12:00:00');
    const fuel = makeEvent({ id: 'fuel-1', type: 'fuel', arrivalTime: fuelArr, durationMinutes: 15 });
    const mealArr = minutesAfter(fuel.departureTime, 30);
    const meal = makeEvent({ id: 'meal-1', type: 'meal', arrivalTime: mealArr, durationMinutes: 45 });
    const after = makeEvent({ id: 'drive-after', type: 'drive', arrivalTime: minutesAfter(meal.departureTime, 10), durationMinutes: 60 });

    const originalArrival = after.arrivalTime.getTime();
    const result = applyComboOptimization([fuel, meal, after]);
    const afterResult = result.find(e => e.id === 'drive-after')!;
    expect(afterResult.arrivalTime.getTime()).toBeLessThan(originalArrival);
  });
});

// ─── Pass 1: Meal absorbs downstream fuel ─────────────────────────────────────

describe('Pass 1 — meal absorbs downstream fuel', () => {
  it('merges meal + fuel within 5h window into a combo at the meal location', () => {
    const mealArr = new Date('2026-08-16T12:00:00');
    const meal = makeEvent({ id: 'meal-1', type: 'meal', arrivalTime: mealArr, durationMinutes: 45 });
    const fuelArr = minutesAfter(meal.departureTime, 120); // 2h after meal — within 5h window
    const fuel = makeEvent({ id: 'fuel-1', type: 'fuel', arrivalTime: fuelArr, durationMinutes: 15 });

    const result = applyComboOptimization([meal, fuel]);
    const combo = result.find(e => e.type === 'combo')!;
    expect(combo).toBeDefined();
    // Combo is at the MEAL location, not the fuel location
    expect(combo.arrivalTime.getTime()).toBe(mealArr.getTime());
  });

  it('does not merge meal + fuel outside the 5h window', () => {
    const mealArr = new Date('2026-08-16T09:00:00');
    const meal = makeEvent({ id: 'meal-1', type: 'meal', arrivalTime: mealArr, durationMinutes: 45 });
    const fuelArr = minutesAfter(meal.departureTime, 310); // > 300min gap
    const fuel = makeEvent({ id: 'fuel-1', type: 'fuel', arrivalTime: fuelArr, durationMinutes: 15 });

    const result = applyComboOptimization([meal, fuel]);
    expect(result.some(e => e.type === 'combo')).toBe(false);
  });

  it('combo duration matches the meal duration (fuel is parallel)', () => {
    const mealArr = new Date('2026-08-16T12:00:00');
    const meal = makeEvent({ id: 'meal-1', type: 'meal', arrivalTime: mealArr, durationMinutes: 45 });
    const fuelArr = minutesAfter(meal.departureTime, 60);
    const fuel = makeEvent({ id: 'fuel-1', type: 'fuel', arrivalTime: fuelArr, durationMinutes: 15 });

    const result = applyComboOptimization([meal, fuel]);
    const combo = result.find(e => e.type === 'combo')!;
    expect(combo.durationMinutes).toBe(meal.durationMinutes);
  });
});

// ─── Drive merging ────────────────────────────────────────────────────────────

describe('adjacent drive merging', () => {
  it('merges two consecutive drive events into one', () => {
    const d1 = makeEvent({ id: 'drive-1', type: 'drive', durationMinutes: 60, distanceFromOriginKm: 50, segmentDistanceKm: 50, segmentDurationMinutes: 60 });
    const d2 = makeEvent({ id: 'drive-2', type: 'drive', arrivalTime: d1.departureTime, durationMinutes: 60, distanceFromOriginKm: 100, segmentDistanceKm: 50, segmentDurationMinutes: 60 });

    const result = applyComboOptimization([d1, d2]);
    const drives = result.filter(e => e.type === 'drive');
    expect(drives).toHaveLength(1);
    expect(drives[0].durationMinutes).toBe(120);
  });

  it('does not merge drives separated by another event type', () => {
    const d1    = makeEvent({ id: 'drive-1', type: 'drive', durationMinutes: 60 });
    const fuel  = makeEvent({ id: 'fuel-1',  type: 'fuel',  arrivalTime: d1.departureTime, durationMinutes: 15 });
    const d2    = makeEvent({ id: 'drive-2', type: 'drive', arrivalTime: fuel.departureTime, durationMinutes: 60 });

    const result = applyComboOptimization([d1, fuel, d2]);
    expect(result.filter(e => e.type === 'drive')).toHaveLength(2);
  });
});

// ─── Boundary guards ─────────────────────────────────────────────────────────

describe('overnight and departure boundary guards', () => {
  it('does not shift timestamps past an overnight event', () => {
    const fuelArr = new Date('2026-08-16T16:00:00');
    const fuel = makeEvent({ id: 'fuel-1', type: 'fuel', arrivalTime: fuelArr, durationMinutes: 15 });
    const mealArr = minutesAfter(fuel.departureTime, 20);
    const meal = makeEvent({ id: 'meal-1', type: 'meal', arrivalTime: mealArr, durationMinutes: 45 });
    const overnightArr = minutesAfter(meal.departureTime, 30);
    const overnight = makeEvent({ id: 'overnight-1', type: 'overnight', arrivalTime: overnightArr, durationMinutes: 480 });
    const nextDay = makeEvent({ id: 'drive-next', type: 'drive', arrivalTime: minutesAfter(overnight.departureTime, 10), durationMinutes: 60 });

    const originalNextDayTime = nextDay.arrivalTime.getTime();
    const result = applyComboOptimization([fuel, meal, overnight, nextDay]);

    const nextDayResult = result.find(e => e.id === 'drive-next')!;
    // Should NOT be shifted — overnight is an anchor
    expect(nextDayResult.arrivalTime.getTime()).toBe(originalNextDayTime);
  });
});

// ─── comboLabel ───────────────────────────────────────────────────────────────

describe('comboLabel content', () => {
  it('labels a morning fuel+meal as "Fuel + Breakfast"', () => {
    const fuelArr = new Date('2026-08-16T08:00:00'); // 8am
    const fuel = makeEvent({ id: 'fuel-1', type: 'fuel', arrivalTime: fuelArr, durationMinutes: 15 });
    const mealArr = minutesAfter(fuel.departureTime, 10);
    const meal = makeEvent({ id: 'meal-1', type: 'meal', arrivalTime: mealArr, durationMinutes: 30 });

    const result = applyComboOptimization([fuel, meal]);
    const combo = result.find(e => e.type === 'combo')!;
    expect(combo.comboLabel).toContain('Breakfast');
  });

  it('labels an afternoon fuel+meal as "Fuel + Lunch"', () => {
    const fuelArr = new Date('2026-08-16T12:30:00'); // 12:30pm
    const fuel = makeEvent({ id: 'fuel-1', type: 'fuel', arrivalTime: fuelArr, durationMinutes: 15 });
    const mealArr = minutesAfter(fuel.departureTime, 10);
    const meal = makeEvent({ id: 'meal-1', type: 'meal', arrivalTime: mealArr, durationMinutes: 45 });

    const result = applyComboOptimization([fuel, meal]);
    const combo = result.find(e => e.type === 'combo')!;
    expect(combo.comboLabel).toContain('Lunch');
  });

  it('labels an evening fuel+meal as "Fuel + Dinner"', () => {
    const fuelArr = new Date('2026-08-16T18:00:00'); // 6pm
    const fuel = makeEvent({ id: 'fuel-1', type: 'fuel', arrivalTime: fuelArr, durationMinutes: 15 });
    const mealArr = minutesAfter(fuel.departureTime, 10);
    const meal = makeEvent({ id: 'meal-1', type: 'meal', arrivalTime: mealArr, durationMinutes: 45 });

    const result = applyComboOptimization([fuel, meal]);
    const combo = result.find(e => e.type === 'combo')!;
    expect(combo.comboLabel).toContain('Dinner');
  });

  it('labels a fuel+rest combo as "Fuel + Break"', () => {
    const fuelArr = new Date('2026-08-16T14:00:00');
    const fuel = makeEvent({ id: 'fuel-1', type: 'fuel', arrivalTime: fuelArr, durationMinutes: 15 });
    const restArr = minutesAfter(fuel.departureTime, 20);
    const rest = makeEvent({ id: 'rest-1', type: 'rest', arrivalTime: restArr, durationMinutes: 15 });

    const result = applyComboOptimization([fuel, rest]);
    const combo = result.find(e => e.type === 'combo')!;
    expect(combo.comboLabel).toBe('Fuel + Break');
  });
});

// ─── No double-consume ────────────────────────────────────────────────────────

describe('consumed events are not re-used', () => {
  it('a fuel stop absorbed by Pass 1 is not also merged by Pass 2', () => {
    // meal at 12pm, fuel at 1pm (within 5h → Pass 1 absorbs it)
    // The fuel is consumed — Pass 2 should not also grab it.
    const mealArr = new Date('2026-08-16T12:00:00');
    const meal = makeEvent({ id: 'meal-1', type: 'meal', arrivalTime: mealArr, durationMinutes: 45 });
    const fuelArr = minutesAfter(meal.departureTime, 30);
    const fuel = makeEvent({ id: 'fuel-1', type: 'fuel', arrivalTime: fuelArr, durationMinutes: 15 });
    const restArr = minutesAfter(fuel.departureTime, 10);
    const rest = makeEvent({ id: 'rest-1', type: 'rest', arrivalTime: restArr, durationMinutes: 15 });

    const result = applyComboOptimization([meal, fuel, rest]);
    // Only one combo (meal absorbs fuel), rest stays separate
    expect(result.filter(e => e.type === 'combo')).toHaveLength(1);
    expect(result.find(e => e.id === 'rest-1')).toBeDefined();
  });
});
