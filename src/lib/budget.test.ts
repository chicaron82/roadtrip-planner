import { describe, it, expect } from 'vitest';
import {
  applyBudgetWeights,
  getPerPersonCost,
  calculateCostBreakdown,
  getBudgetStatus,
  formatBudgetRemaining,
  createSmartBudget,
  BUDGET_PROFILES,
  DEFAULT_BUDGET,
} from './budget';
import type { TripDay, TripBudget, TripSettings } from '../types';

// ==================== BUDGET WEIGHT TESTS ====================

describe('applyBudgetWeights', () => {
  it('distributes budget according to balanced profile', () => {
    const result = applyBudgetWeights(1000, BUDGET_PROFILES.balanced.weights);
    expect(result.gas).toBe(250);    // 25%
    expect(result.hotel).toBe(350);  // 35%
    expect(result.food).toBe(300);   // 30%
    expect(result.misc).toBe(100);   // 10%
  });

  it('distributes budget according to foodie profile', () => {
    const result = applyBudgetWeights(1000, BUDGET_PROFILES.foodie.weights);
    expect(result.gas).toBe(200);    // 20%
    expect(result.hotel).toBe(200);  // 20%
    expect(result.food).toBe(500);   // 50%
    expect(result.misc).toBe(100);   // 10%
  });

  it('distributes budget according to comfort profile', () => {
    const result = applyBudgetWeights(1000, BUDGET_PROFILES.comfort.weights);
    expect(result.gas).toBe(200);    // 20%
    expect(result.hotel).toBe(450);  // 45%
    expect(result.food).toBe(250);   // 25%
    expect(result.misc).toBe(100);   // 10%
  });

  it('handles zero budget', () => {
    const result = applyBudgetWeights(0, BUDGET_PROFILES.balanced.weights);
    expect(result.gas).toBe(0);
    expect(result.hotel).toBe(0);
    expect(result.food).toBe(0);
    expect(result.misc).toBe(0);
  });

  it('rounds values correctly', () => {
    const result = applyBudgetWeights(333, BUDGET_PROFILES.balanced.weights);
    // 333 * 0.25 = 83.25 -> rounds to 83
    expect(result.gas).toBe(83);
    // Sum should be close to total (may differ due to rounding)
    const sum = result.gas + result.hotel + result.food + result.misc;
    expect(Math.abs(sum - 333)).toBeLessThanOrEqual(4);
  });
});

// ==================== PER PERSON COST TESTS ====================

describe('getPerPersonCost', () => {
  it('calculates cost per person correctly', () => {
    expect(getPerPersonCost(1000, 4)).toBe(250);
    expect(getPerPersonCost(150, 2)).toBe(75);
    expect(getPerPersonCost(300, 3)).toBe(100);
  });

  it('rounds to nearest dollar', () => {
    expect(getPerPersonCost(100, 3)).toBe(33); // 33.33 -> 33
    expect(getPerPersonCost(200, 3)).toBe(67); // 66.66 -> 67
  });

  it('handles single traveler', () => {
    expect(getPerPersonCost(500, 1)).toBe(500);
  });

  it('returns 0 for zero travelers', () => {
    expect(getPerPersonCost(500, 0)).toBe(0);
  });
});

// ==================== COST BREAKDOWN TESTS ====================

describe('calculateCostBreakdown', () => {
  const mockDays: TripDay[] = [
    {
      dayNumber: 1,
      date: '2024-08-16',
      dateFormatted: 'Fri, Aug 16',
      route: 'Winnipeg → Portage',
      segments: [],
      segmentIndices: [],
      timezoneChanges: [],
      budget: {
        gasUsed: 50.25,
        hotelCost: 150,
        foodEstimate: 75.50,
        miscCost: 10,
        dayTotal: 285.75,
        gasRemaining: 100,
        hotelRemaining: 200,
        foodRemaining: 150,
      },
      totals: {
        distanceKm: 100,
        driveTimeMinutes: 60,
        stopTimeMinutes: 15,
        departureTime: '2024-08-16T09:00:00Z',
        arrivalTime: '2024-08-16T10:15:00Z',
      },
    },
    {
      dayNumber: 2,
      date: '2024-08-17',
      dateFormatted: 'Sat, Aug 17',
      route: 'Portage → Brandon',
      segments: [],
      segmentIndices: [],
      timezoneChanges: [],
      budget: {
        gasUsed: 45.00,
        hotelCost: 0, // Last day, no hotel
        foodEstimate: 50.00,
        miscCost: 20,
        dayTotal: 115,
        gasRemaining: 55,
        hotelRemaining: 200,
        foodRemaining: 100,
      },
      totals: {
        distanceKm: 130,
        driveTimeMinutes: 80,
        stopTimeMinutes: 0,
        departureTime: '2024-08-17T09:00:00Z',
        arrivalTime: '2024-08-17T10:20:00Z',
      },
    },
  ];

  it('sums fuel costs across days', () => {
    const result = calculateCostBreakdown(mockDays, 2);
    expect(result.fuel).toBe(95.25); // 50.25 + 45.00
  });

  it('sums accommodation costs across days', () => {
    const result = calculateCostBreakdown(mockDays, 2);
    expect(result.accommodation).toBe(150); // 150 + 0
  });

  it('sums meal costs across days', () => {
    const result = calculateCostBreakdown(mockDays, 2);
    expect(result.meals).toBe(125.50); // 75.50 + 50.00
  });

  it('sums misc costs across days', () => {
    const result = calculateCostBreakdown(mockDays, 2);
    expect(result.misc).toBe(30); // 10 + 20
  });

  it('calculates total correctly', () => {
    const result = calculateCostBreakdown(mockDays, 2);
    expect(result.total).toBe(400.75); // 95.25 + 150 + 125.50 + 30
  });

  it('calculates per person cost', () => {
    const result = calculateCostBreakdown(mockDays, 2);
    expect(result.perPerson).toBeCloseTo(200.38, 2); // 400.75 / 2
  });

  it('handles empty days array', () => {
    const result = calculateCostBreakdown([], 2);
    expect(result.total).toBe(0);
    expect(result.fuel).toBe(0);
    expect(result.accommodation).toBe(0);
    expect(result.meals).toBe(0);
  });
});

// ==================== BUDGET STATUS TESTS ====================

describe('getBudgetStatus', () => {
  const mockBudget: TripBudget = {
    mode: 'plan-to-budget',
    allocation: 'flexible',
    profile: 'balanced',
    weights: BUDGET_PROFILES.balanced.weights,
    gas: 100,
    hotel: 200,
    food: 150,
    misc: 50,
    total: 500,
  };

  it('returns "under" when well under budget', () => {
    const costBreakdown = { fuel: 80, accommodation: 150, meals: 100, misc: 30, total: 360, perPerson: 180 };
    expect(getBudgetStatus(mockBudget, costBreakdown)).toBe('under');
  });

  it('returns "at" when close to budget', () => {
    const costBreakdown = { fuel: 95, accommodation: 190, meals: 145, misc: 45, total: 475, perPerson: 237.5 };
    expect(getBudgetStatus(mockBudget, costBreakdown)).toBe('at');
  });

  it('returns "over" when over budget', () => {
    const costBreakdown = { fuel: 120, accommodation: 220, meals: 180, misc: 60, total: 580, perPerson: 290 };
    expect(getBudgetStatus(mockBudget, costBreakdown)).toBe('over');
  });

  it('returns "under" for open budget mode', () => {
    const openBudget = { ...mockBudget, mode: 'open' as const };
    const costBreakdown = { fuel: 500, accommodation: 500, meals: 500, misc: 500, total: 2000, perPerson: 1000 };
    expect(getBudgetStatus(openBudget, costBreakdown)).toBe('under');
  });

  it('returns "under" for zero total budget', () => {
    const zeroBudget = { ...mockBudget, total: 0 };
    const costBreakdown = { fuel: 100, accommodation: 100, meals: 100, misc: 100, total: 400, perPerson: 200 };
    expect(getBudgetStatus(zeroBudget, costBreakdown)).toBe('under');
  });
});

// ==================== FORMAT BUDGET REMAINING TESTS ====================

describe('formatBudgetRemaining', () => {
  it('shows positive remaining as good', () => {
    const result = formatBudgetRemaining(150);
    expect(result.text).toBe('$150 remaining');
    expect(result.status).toBe('good');
  });

  it('shows zero as warning', () => {
    const result = formatBudgetRemaining(0);
    expect(result.text).toBe('Budget reached');
    expect(result.status).toBe('warning');
  });

  it('shows negative as over', () => {
    const result = formatBudgetRemaining(-50);
    expect(result.text).toBe('$50 over');
    expect(result.status).toBe('over');
  });

  it('rounds to whole dollars', () => {
    const result = formatBudgetRemaining(123.75);
    expect(result.text).toBe('$124 remaining');
  });
});

// ==================== CREATE SMART BUDGET TESTS ====================

describe('createSmartBudget', () => {
  const mockSettings: TripSettings = {
    units: 'metric',
    currency: 'CAD',
    maxDriveHours: 8,
    numTravelers: 2,
    numDrivers: 1,
    budgetMode: 'open',
    budget: DEFAULT_BUDGET,
    departureDate: '2024-08-16',
    departureTime: '09:00',
    arrivalDate: '',
    arrivalTime: '',
    useArrivalTime: false,
    gasPrice: 1.50,
    hotelPricePerNight: 150,
    mealPricePerDay: 50,
    isRoundTrip: false,
    avoidTolls: false,
    avoidBorders: false,
    scenicMode: false,
    routePreference: 'fastest',
    stopFrequency: 'balanced',
    tripPreferences: [],
  };

  it('calculates gas estimate based on distance', () => {
    const result = createSmartBudget(2, 500, 2, mockSettings);
    // 500km * $0.12/km = $60
    expect(result.gas).toBe(60);
  });

  it('calculates hotel cost based on nights and rooms', () => {
    const result = createSmartBudget(3, 500, 4, mockSettings);
    // 2 nights * 2 rooms (4 travelers / 2) * $150/night = $600
    expect(result.hotel).toBe(600);
  });

  it('calculates food cost based on days and travelers', () => {
    const result = createSmartBudget(3, 500, 2, mockSettings);
    // 3 days * 2 travelers * $50/day = $300
    expect(result.food).toBe(300);
  });

  it('calculates total correctly', () => {
    const result = createSmartBudget(2, 500, 2, mockSettings);
    // Gas: 60, Hotel: 1 night * 1 room * 150 = 150, Food: 2 days * 2 * 50 = 200
    expect(result.total).toBe(60 + 150 + 200);
  });

  it('handles single day trip (no overnight)', () => {
    const result = createSmartBudget(1, 200, 2, mockSettings);
    // No nights, so no hotel cost
    expect(result.hotel).toBe(0);
  });

  it('sets mode to open', () => {
    const result = createSmartBudget(2, 500, 2, mockSettings);
    expect(result.mode).toBe('open');
  });
});

// ==================== BUDGET PROFILES CONFIG TESTS ====================

describe('BUDGET_PROFILES', () => {
  it('all profiles have weights summing to 100', () => {
    for (const [_name, profile] of Object.entries(BUDGET_PROFILES)) {
      const sum = profile.weights.gas + profile.weights.hotel + profile.weights.food + profile.weights.misc;
      expect(sum).toBe(100);
    }
  });

  it('all profiles have required fields', () => {
    for (const [_name, profile] of Object.entries(BUDGET_PROFILES)) {
      expect(profile.label).toBeDefined();
      expect(profile.emoji).toBeDefined();
      expect(profile.description).toBeDefined();
      expect(profile.weights).toBeDefined();
      expect(profile.weights.gas).toBeGreaterThanOrEqual(0);
      expect(profile.weights.hotel).toBeGreaterThanOrEqual(0);
      expect(profile.weights.food).toBeGreaterThanOrEqual(0);
      expect(profile.weights.misc).toBeGreaterThanOrEqual(0);
    }
  });
});
