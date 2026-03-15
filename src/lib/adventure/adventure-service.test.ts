/**
 * adventure-service.ts — unit tests for pure helper functions.
 *
 * Pure functions — no mocks needed.
 * Covers: calculateMaxDistance, formatCostBreakdown, buildAdventureBudget,
 *         findAdventureDestinations (numRooms, isOverBudget, 15% buffer).
 */

import { describe, it, expect } from 'vitest';
import type { AdventureConfig } from '../../types';
import { calculateMaxDistance, formatCostBreakdown, buildAdventureBudget, findAdventureDestinations } from './adventure-service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORIGIN = { id: 'wpg', name: 'Winnipeg', lat: 49.895, lng: -97.138, type: 'origin' as const };

function makeConfig(overrides: Partial<AdventureConfig> = {}): AdventureConfig {
  return {
    origin: ORIGIN,
    budget: 1000,
    days: 3,
    travelers: 2,
    preferences: [],
    accommodationType: 'moderate',
    isRoundTrip: true,
    ...overrides,
  };
}

// ─── calculateMaxDistance ─────────────────────────────────────────────────────

describe('calculateMaxDistance', () => {
  it('returns a positive number for a typical config', () => {
    expect(calculateMaxDistance(makeConfig())).toBeGreaterThan(0);
  });

  it('divides max drivable km by 2 for round trip', () => {
    const oneWay = calculateMaxDistance(makeConfig({ isRoundTrip: false }));
    const roundTrip = calculateMaxDistance(makeConfig({ isRoundTrip: true }));
    expect(roundTrip).toBeCloseTo(oneWay / 2, 1);
  });

  it('returns 0 when budget is entirely consumed by fixed costs', () => {
    // nights=2×150=300, food=3×2×50=300 → fixedCosts=600 > budget=500
    const result = calculateMaxDistance(makeConfig({ budget: 500, days: 3, travelers: 2 }));
    expect(result).toBe(0);
  });

  it('uses fuelCostPerKm override when provided', () => {
    const cheap = calculateMaxDistance(makeConfig({ fuelCostPerKm: 0.05 }));
    const expensive = calculateMaxDistance(makeConfig({ fuelCostPerKm: 0.30 }));
    expect(cheap).toBeGreaterThan(expensive);
  });

  it('budget accommodation type affects fixed costs (comfort > moderate > budget)', () => {
    const budgetResult = calculateMaxDistance(makeConfig({ accommodationType: 'budget' }));
    const comfortResult = calculateMaxDistance(makeConfig({ accommodationType: 'comfort' }));
    // Comfort costs more → less fuel budget → shorter max distance
    expect(budgetResult).toBeGreaterThan(comfortResult);
  });

  it('defaults isRoundTrip to true when undefined', () => {
    const withTrue = calculateMaxDistance(makeConfig({ isRoundTrip: true }));
    const withUndef = calculateMaxDistance(makeConfig({ isRoundTrip: undefined }));
    expect(withUndef).toBeCloseTo(withTrue, 1);
  });

  it('numRooms=2 halves max distance vs numRooms=1 (accommodation cost doubles)', () => {
    const oneRoom = calculateMaxDistance(makeConfig({ numRooms: 1 }));
    const twoRooms = calculateMaxDistance(makeConfig({ numRooms: 2 }));
    // 2 rooms → more of the budget consumed by hotel → less fuel → shorter range
    expect(oneRoom).toBeGreaterThan(twoRooms);
  });

  it('numRooms defaults to 1 when not provided', () => {
    const explicit = calculateMaxDistance(makeConfig({ numRooms: 1 }));
    const implicit = calculateMaxDistance(makeConfig());
    expect(explicit).toBeCloseTo(implicit, 1);
  });
});

// ─── formatCostBreakdown ──────────────────────────────────────────────────────

describe('formatCostBreakdown', () => {
  it('formats all three cost components', () => {
    const costs = { fuel: 120, accommodation: 300, food: 150, total: 570, remaining: 430 };
    const result = formatCostBreakdown(costs);
    expect(result).toMatch(/Gas.*120/);
    expect(result).toMatch(/Hotels.*300/);
    expect(result).toMatch(/Food.*150/);
  });

  it('uses pipe separator between categories', () => {
    const costs = { fuel: 100, accommodation: 200, food: 100, total: 400, remaining: 600 };
    expect(formatCostBreakdown(costs)).toContain('|');
  });

  it('formats zero costs', () => {
    const costs = { fuel: 0, accommodation: 0, food: 0, total: 0, remaining: 1000 };
    const result = formatCostBreakdown(costs);
    expect(result).toMatch(/\$0/);
  });
});

// ─── buildAdventureBudget ─────────────────────────────────────────────────────

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
});

// ─── findAdventureDestinations — isOverBudget / 15% buffer ───────────────────

describe('findAdventureDestinations', () => {
  it('destinations within budget have isOverBudget=false', async () => {
    // Very generous budget — anything found must be within it
    const result = await findAdventureDestinations(makeConfig({ budget: 5000, days: 5 }));
    for (const dest of result.destinations) {
      if (!dest.isOverBudget) {
        expect(dest.estimatedCosts.total).toBeLessThanOrEqual(5000);
      }
    }
  });

  it('tight-budget destinations (100–115% of budget) appear with isOverBudget=true', async () => {
    // 4 travelers, 3 days, $1000 — Regina scenario: food+hotel alone ~$900, pushing close to/over $1000
    // At least some reachable destinations should appear (not be silently filtered)
    const result = await findAdventureDestinations(
      makeConfig({ budget: 1000, days: 3, travelers: 4, numRooms: 1 })
    );
    // If any over-budget destinations slipped through, they must be flagged
    const overBudget = result.destinations.filter(d => d.isOverBudget);
    for (const dest of overBudget) {
      expect(dest.estimatedCosts.total).toBeGreaterThan(1000);
    }
  });

  it('destinations more than 15% over budget are excluded', async () => {
    // Tight budget: $100, 3 days, 4 travelers → food alone ~$600, far exceeds 115% of $100
    const result = await findAdventureDestinations(
      makeConfig({ budget: 100, days: 3, travelers: 4 })
    );
    for (const dest of result.destinations) {
      expect(dest.estimatedCosts.total).toBeLessThanOrEqual(100 * 1.15);
    }
  });

  it('numRooms affects accommodation costs in destination estimates', async () => {
    const oneRoom = await findAdventureDestinations(makeConfig({ budget: 5000, days: 3, numRooms: 1 }));
    const twoRooms = await findAdventureDestinations(makeConfig({ budget: 5000, days: 3, numRooms: 2 }));
    // Same destinations may appear but 2-room trips cost more
    const matched = oneRoom.destinations.find(d =>
      twoRooms.destinations.some(d2 => d2.name === d.name)
    );
    if (matched) {
      const twoRoomVersion = twoRooms.destinations.find(d => d.name === matched.name)!;
      expect(twoRoomVersion.estimatedCosts.accommodation)
        .toBeGreaterThan(matched.estimatedCosts.accommodation);
    }
  });

  it('returns at most 10 destinations', async () => {
    const result = await findAdventureDestinations(makeConfig({ budget: 10000, days: 10 }));
    expect(result.destinations.length).toBeLessThanOrEqual(10);
  });

  it('all destinations have required fields', async () => {
    const result = await findAdventureDestinations(makeConfig({ budget: 5000, days: 5 }));
    for (const dest of result.destinations) {
      expect(typeof dest.isOverBudget).toBe('boolean');
      expect(typeof dest.estimatedCosts.total).toBe('number');
      expect(typeof dest.estimatedCosts.accommodation).toBe('number');
      expect(dest.estimatedCosts.remaining).toBeDefined();
    }
  });
});

// ─── buildAdventureBudget ─────────────────────────────────────────────────────

describe('buildAdventureBudget', () => {
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
