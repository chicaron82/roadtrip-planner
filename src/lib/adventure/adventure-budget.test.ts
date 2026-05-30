/**
 * adventure-budget.ts — unit tests for buildAdventureBudget.
 *
 * Pure function — no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import { buildAdventureBudget } from './adventure-budget';

describe('buildAdventureBudget', () => {
  it('returns total equal to the input totalBudget', () => {
    const result = buildAdventureBudget(1000, 500, [], 'moderate');
    expect(result.total).toBe(1000);
  });

  it('gas is based on estimated distance at $0.12/km', () => {
    const result = buildAdventureBudget(1000, 500, [], 'moderate');
    expect(result.gas).toBe(Math.round(500 * 0.12));
  });

  it('returns a profile string', () => {
    const result = buildAdventureBudget(1000, 500, [], 'moderate');
    expect(typeof result.profile).toBe('string');
  });

  it('all weight percentages are numbers', () => {
    const result = buildAdventureBudget(1000, 500, [], 'moderate');
    expect(typeof result.weights.gas).toBe('number');
    expect(typeof result.weights.hotel).toBe('number');
    expect(typeof result.weights.food).toBe('number');
    expect(typeof result.weights.misc).toBe('number');
  });

  it('hotel, food, misc are all non-negative', () => {
    const result = buildAdventureBudget(1000, 500, [], 'moderate');
    expect(result.hotel).toBeGreaterThanOrEqual(0);
    expect(result.food).toBeGreaterThanOrEqual(0);
    expect(result.misc).toBeGreaterThanOrEqual(0);
  });
});
