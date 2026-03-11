import { describe, it, expect } from 'vitest';
import {
  calculateMaxDistance,
  findAdventureDestinations,
  formatCostBreakdown,
  buildAdventureBudget,
} from './adventure-service';
import type { AdventureConfig } from '../../types';

// Baseline config — Regina origin, moderate budget, round trip
function makeConfig(overrides: Partial<AdventureConfig> = {}): AdventureConfig {
  return {
    origin: { id: 'loc-regina', name: 'Regina, SK', lat: 50.445, lng: -104.619, type: 'origin' },
    budget: 2000,
    days: 5,
    travelers: 2,
    preferences: ['scenic'],
    accommodationType: 'moderate',
    isRoundTrip: true,
    maxDriveHoursPerDay: 8,
    ...overrides,
  };
}

// ==================== calculateMaxDistance ====================

describe('calculateMaxDistance', () => {
  it('returns a positive km value for a reasonable budget', () => {
    const km = calculateMaxDistance(makeConfig());
    expect(km).toBeGreaterThan(0);
  });

  it('accounts for round trip by halving the range', () => {
    const oneWay = calculateMaxDistance(makeConfig({ isRoundTrip: false }));
    const roundTrip = calculateMaxDistance(makeConfig({ isRoundTrip: true }));
    expect(roundTrip).toBeCloseTo(oneWay / 2, 0);
  });

  it('returns a larger range for a bigger budget', () => {
    const small = calculateMaxDistance(makeConfig({ budget: 500 }));
    const large = calculateMaxDistance(makeConfig({ budget: 5000 }));
    expect(large).toBeGreaterThan(small);
  });

  it('returns a larger range for a budget accommodation type', () => {
    const budget = calculateMaxDistance(makeConfig({ accommodationType: 'budget' }));
    const comfort = calculateMaxDistance(makeConfig({ accommodationType: 'comfort' }));
    expect(budget).toBeGreaterThan(comfort);
  });

  it('uses fuelCostPerKm when provided', () => {
    const cheap = calculateMaxDistance(makeConfig({ fuelCostPerKm: 0.05 }));
    const expensive = calculateMaxDistance(makeConfig({ fuelCostPerKm: 0.20 }));
    expect(cheap).toBeGreaterThan(expensive);
  });

  it('returns 0 when budget is completely consumed by accommodation + food', () => {
    // 9 nights × $250 comfort + 10 days × 2 pax × $50 food = $2250 + $1000 = $3250 (over $2000)
    const km = calculateMaxDistance(makeConfig({ budget: 100, days: 10, accommodationType: 'comfort' }));
    expect(km).toBe(0);
  });
});

// ==================== findAdventureDestinations ====================

describe('findAdventureDestinations', () => {
  it('resolves to an AdventureResult with a destinations array', async () => {
    const result = await findAdventureDestinations(makeConfig());
    expect(result).toHaveProperty('destinations');
    expect(Array.isArray(result.destinations)).toBe(true);
  });

  it('returns at most 10 destinations', async () => {
    const result = await findAdventureDestinations(makeConfig({ budget: 10000 }));
    expect(result.destinations.length).toBeLessThanOrEqual(10);
  });

  it('returns destinations sorted by score descending', async () => {
    const result = await findAdventureDestinations(makeConfig());
    for (let i = 1; i < result.destinations.length; i++) {
      expect(result.destinations[i].score).toBeLessThanOrEqual(result.destinations[i - 1].score);
    }
  });

  it('all returned destinations are within the reported maxReachableKm', async () => {
    const result = await findAdventureDestinations(makeConfig());
    for (const dest of result.destinations) {
      expect(dest.distanceKm).toBeLessThanOrEqual(result.maxReachableKm * 1.4); // road factor applied
    }
  });

  it('budget constraint: no destination costs more than the configured budget', async () => {
    const result = await findAdventureDestinations(makeConfig({ budget: 2000 }));
    for (const dest of result.destinations) {
      expect(dest.estimatedCosts.total).toBeLessThanOrEqual(2000);
    }
  });

  it('each destination has required fields', async () => {
    const result = await findAdventureDestinations(makeConfig());
    for (const dest of result.destinations) {
      expect(dest).toHaveProperty('id');
      expect(dest).toHaveProperty('name');
      expect(dest).toHaveProperty('distanceKm');
      expect(dest).toHaveProperty('estimatedDriveHours');
      expect(dest).toHaveProperty('estimatedCosts');
      expect(dest).toHaveProperty('score');
    }
  });

  it('returns empty destinations for a budget of zero', async () => {
    const result = await findAdventureDestinations(makeConfig({ budget: 0 }));
    expect(result.destinations).toHaveLength(0);
  });

  it('reports maxReachableKm in the result', async () => {
    const result = await findAdventureDestinations(makeConfig());
    expect(result.maxReachableKm).toBeGreaterThan(0);
  });

  it('foodie preference boosts restaurant/city destinations', async () => {
    const foodie = await findAdventureDestinations(makeConfig({ preferences: ['foodie'], budget: 5000 }));
    const top = foodie.destinations[0];
    // Top result should have foodie-relevant tags or be a city
    const hasFoodieTags = top?.tags?.some(t => ['foodie', 'dining', 'wine', 'city'].includes(t));
    expect(hasFoodieTags).toBe(true);
  });

  it('one-way trips can reach further destinations than round trips', async () => {
    const oneWay = await findAdventureDestinations(makeConfig({ isRoundTrip: false, budget: 3000 }));
    const roundTrip = await findAdventureDestinations(makeConfig({ isRoundTrip: true, budget: 3000 }));
    const maxOneWay = Math.max(0, ...oneWay.destinations.map(d => d.distanceKm));
    const maxRoundTrip = Math.max(0, ...roundTrip.destinations.map(d => d.distanceKm));
    expect(maxOneWay).toBeGreaterThanOrEqual(maxRoundTrip);
  });
});

// ==================== formatCostBreakdown ====================

describe('formatCostBreakdown', () => {
  it('returns a string with all three cost categories', () => {
    const costs = { fuel: 150, accommodation: 400, food: 200, total: 750, remaining: 250 };
    const text = formatCostBreakdown(costs);
    expect(text).toContain('150');
    expect(text).toContain('400');
    expect(text).toContain('200');
  });

  it('contains Gas, Hotels, and Food labels', () => {
    const costs = { fuel: 100, accommodation: 300, food: 150, total: 550, remaining: 450 };
    const text = formatCostBreakdown(costs);
    expect(text).toMatch(/gas/i);
    expect(text).toMatch(/hotel/i);
    expect(text).toMatch(/food/i);
  });
});

// ==================== buildAdventureBudget ====================

describe('buildAdventureBudget', () => {
  it('total remains equal to the input budget', () => {
    const result = buildAdventureBudget(2000, 800, ['scenic'], 'moderate');
    expect(result.total).toBe(2000);
  });

  it('gas + hotel + food + misc approximately equals total (within rounding)', () => {
    const result = buildAdventureBudget(2000, 800, ['scenic'], 'moderate');
    const sum = result.gas + result.hotel + result.food + result.misc;
    expect(Math.abs(sum - result.total)).toBeLessThanOrEqual(5); // rounding epsilon
  });

  it('foodie preference allocates more to food than hotel', () => {
    const result = buildAdventureBudget(2000, 500, ['foodie'], 'moderate');
    expect(result.food).toBeGreaterThan(result.hotel);
  });

  it('returns profile = foodie for foodie preference', () => {
    const result = buildAdventureBudget(2000, 500, ['foodie'], 'moderate');
    expect(result.profile).toBe('foodie');
  });

  it('returns profile = scenic for scenic preference', () => {
    const result = buildAdventureBudget(2000, 500, ['scenic'], 'moderate');
    expect(result.profile).toBe('scenic');
  });

  it('returns profile = balanced for budget or family preference', () => {
    const budget = buildAdventureBudget(2000, 500, ['budget'], 'moderate');
    const family = buildAdventureBudget(2000, 500, ['family'], 'moderate');
    expect(budget.profile).toBe('balanced');
    expect(family.profile).toBe('balanced');
  });

  it('returns profile = balanced when no preferences given', () => {
    const result = buildAdventureBudget(2000, 500, [], 'moderate');
    expect(result.profile).toBe('balanced');
  });

  it('weights sum to approximately 100', () => {
    const result = buildAdventureBudget(2000, 500, ['scenic'], 'moderate');
    const weightSum = result.weights.gas + result.weights.hotel + result.weights.food + result.weights.misc;
    // Allow ±2 for integer rounding across 4 categories
    expect(Math.abs(weightSum - 100)).toBeLessThanOrEqual(2);
  });

  it('longer distance means more gas spend', () => {
    const short = buildAdventureBudget(2000, 200, [], 'moderate');
    const long = buildAdventureBudget(2000, 1500, [], 'moderate');
    expect(long.gas).toBeGreaterThan(short.gas);
  });
});
