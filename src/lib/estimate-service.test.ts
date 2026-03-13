import { describe, it, expect } from 'vitest';
import type { Vehicle, TripSettings } from '../types';
import type { TripSummary } from '../types/route';
import { generateEstimate } from './estimate-service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_VEHICLE: Vehicle = {
  year: '2022',
  make: 'Toyota',
  model: 'Camry',
  fuelEconomyCity: 9,
  fuelEconomyHwy: 7,   // L/100km
  tankSize: 60,
};

const IMPERIAL_VEHICLE: Vehicle = {
  year: '2022',
  make: 'Ford',
  model: 'F-150',
  fuelEconomyCity: 16,
  fuelEconomyHwy: 22,  // MPG
  tankSize: 25,
};

function makeSettings(overrides: Partial<TripSettings> = {}): TripSettings {
  return {
    units: 'metric',
    currency: 'CAD',
    maxDriveHours: 8,
    numTravelers: 2,
    numDrivers: 1,
    budgetMode: 'open',
    budget: {} as TripSettings['budget'],
    departureDate: '2026-07-01',
    departureTime: '09:00',
    returnDate: '2026-07-05',
    arrivalDate: '',
    arrivalTime: '',
    useArrivalTime: false,
    gasPrice: 1.55,
    hotelPricePerNight: 150,
    hotelTier: 'regular',
    numRooms: 1,
    mealPricePerDay: 50,
    isRoundTrip: false,
    avoidTolls: false,
    avoidBorders: false,
    scenicMode: false,
    routePreference: 'fastest',
    stopFrequency: 'balanced',
    tripPreferences: [],
    targetArrivalHour: 21,
    dayTripDurationHours: 0,
    ...overrides,
  };
}

function makeSummary(overrides: Partial<TripSummary> = {}): TripSummary {
  return {
    totalDistanceKm: 800,
    totalDurationMinutes: 480,
    totalFuelLitres: 56,
    totalFuelCost: 87,
    gasStops: 1,
    costPerPerson: 200,
    drivingDays: 2,
    segments: [],
    fullGeometry: [],
    ...overrides,
  };
}

// ── generateEstimate — basic shape ────────────────────────────────────────────

describe('generateEstimate', () => {
  it('returns a TripEstimate with all required fields', () => {
    const result = generateEstimate(makeSummary(), BASE_VEHICLE, makeSettings());
    expect(result.totalLow).toBeGreaterThan(0);
    expect(result.totalMid).toBeGreaterThan(0);
    expect(result.totalHigh).toBeGreaterThan(0);
    expect(result.breakdown).toHaveLength(4);
    expect(result.numTravelers).toBe(2);
  });

  it('totalMid ≥ totalLow and totalHigh ≥ totalMid', () => {
    const result = generateEstimate(makeSummary(), BASE_VEHICLE, makeSettings());
    expect(result.totalMid).toBeGreaterThanOrEqual(result.totalLow);
    expect(result.totalHigh).toBeGreaterThanOrEqual(result.totalMid);
  });

  it('perPerson values are totalXxx / numTravelers (approx)', () => {
    const result = generateEstimate(makeSummary(), BASE_VEHICLE, makeSettings());
    expect(result.perPersonLow).toBe(Math.round(result.totalLow / 2));
  });

  it('breakdown categories are Fuel, Hotels, Food, Activities & Misc', () => {
    const result = generateEstimate(makeSummary(), BASE_VEHICLE, makeSettings());
    const cats = result.breakdown.map(b => b.category);
    expect(cats).toContain('Fuel');
    expect(cats).toContain('Hotels');
    expect(cats).toContain('Food');
    expect(cats).toContain('Activities & Misc');
  });

  it('distanceKm is rounded integer', () => {
    const result = generateEstimate(makeSummary({ totalDistanceKm: 823.7 }), BASE_VEHICLE, makeSettings());
    expect(result.distanceKm).toBe(824);
  });

  it('currency symbol is C$ for CAD', () => {
    const result = generateEstimate(makeSummary(), BASE_VEHICLE, makeSettings({ currency: 'CAD' }));
    expect(result.currency).toBe('C$');
  });

  it('currency symbol is $ for USD', () => {
    const result = generateEstimate(makeSummary(), BASE_VEHICLE, makeSettings({ currency: 'USD' }));
    expect(result.currency).toBe('$');
  });
});

// ── Round trip doubles the distance ──────────────────────────────────────────

describe('generateEstimate — round trip vs one-way', () => {
  it('round trip fuel cost is higher than one-way for same distance', () => {
    const oneWay = generateEstimate(makeSummary(), BASE_VEHICLE, makeSettings({ isRoundTrip: false }));
    const roundTrip = generateEstimate(makeSummary(), BASE_VEHICLE, makeSettings({ isRoundTrip: true }));
    expect(roundTrip.totalLow).toBeGreaterThan(oneWay.totalLow);
  });

  it('round trip fuel note contains "(round trip)"', () => {
    const result = generateEstimate(makeSummary(), BASE_VEHICLE, makeSettings({ isRoundTrip: true }));
    const fuelRow = result.breakdown.find(b => b.category === 'Fuel');
    expect(fuelRow?.note).toContain('round trip');
  });

  it('one-way fuel note contains "(one way)"', () => {
    const result = generateEstimate(makeSummary(), BASE_VEHICLE, makeSettings({ isRoundTrip: false }));
    const fuelRow = result.breakdown.find(b => b.category === 'Fuel');
    expect(fuelRow?.note).toContain('one way');
  });
});

// ── Imperial units ────────────────────────────────────────────────────────────

describe('generateEstimate — imperial units', () => {
  it('produces positive fuel cost in imperial mode', () => {
    const result = generateEstimate(
      makeSummary(),
      IMPERIAL_VEHICLE,
      makeSettings({ units: 'imperial' })
    );
    const fuelRow = result.breakdown.find(b => b.category === 'Fuel');
    expect(fuelRow?.low).toBeGreaterThan(0);
    expect(fuelRow?.mid).toBeGreaterThan(0);
  });

  it('mid ≥ low for fuel in imperial mode', () => {
    const result = generateEstimate(
      makeSummary(),
      IMPERIAL_VEHICLE,
      makeSettings({ units: 'imperial' })
    );
    const fuelRow = result.breakdown.find(b => b.category === 'Fuel');
    expect(fuelRow!.mid).toBeGreaterThanOrEqual(fuelRow!.low);
  });
});

// ── Trip duration derivation ──────────────────────────────────────────────────

describe('generateEstimate — days / nights', () => {
  it('uses returnDate minus departureDate for days when both set', () => {
    // July 1 → July 5 = 4 days, 3 nights
    const result = generateEstimate(
      makeSummary(),
      BASE_VEHICLE,
      makeSettings({ departureDate: '2026-07-01', returnDate: '2026-07-05' })
    );
    expect(result.days).toBe(4);
    expect(result.nights).toBe(3);
  });

  it('nights = days - 1 for multi-day trips', () => {
    const result = generateEstimate(makeSummary(), BASE_VEHICLE, makeSettings());
    expect(result.nights).toBe(result.days - 1);
  });

  it('nights is at least 0 for single-day trip', () => {
    const result = generateEstimate(
      makeSummary(),
      BASE_VEHICLE,
      makeSettings({ departureDate: '2026-07-01', returnDate: '2026-07-01' })
    );
    expect(result.nights).toBeGreaterThanOrEqual(0);
  });

  it('hotel note reflects nights count', () => {
    const result = generateEstimate(
      makeSummary(),
      BASE_VEHICLE,
      makeSettings({ departureDate: '2026-07-01', returnDate: '2026-07-05' })
    );
    const hotelRow = result.breakdown.find(b => b.category === 'Hotels');
    expect(hotelRow?.note).toContain('3 nights');
  });
});

// ── Traveler scaling ──────────────────────────────────────────────────────────

describe('generateEstimate — traveler scaling', () => {
  it('food cost scales with number of travelers', () => {
    const solo = generateEstimate(makeSummary(), BASE_VEHICLE, makeSettings({ numTravelers: 1 }));
    const group = generateEstimate(makeSummary(), BASE_VEHICLE, makeSettings({ numTravelers: 4 }));
    const foodSolo = solo.breakdown.find(b => b.category === 'Food')!;
    const foodGroup = group.breakdown.find(b => b.category === 'Food')!;
    expect(foodGroup.low).toBeGreaterThan(foodSolo.low);
  });

  it('food note mentions traveler count', () => {
    const result = generateEstimate(makeSummary(), BASE_VEHICLE, makeSettings({ numTravelers: 3 }));
    const foodRow = result.breakdown.find(b => b.category === 'Food');
    expect(foodRow?.note).toContain('3 traveler');
  });

  it('perPersonMid ≥ 1 for any trip', () => {
    const result = generateEstimate(makeSummary(), BASE_VEHICLE, makeSettings({ numTravelers: 1 }));
    expect(result.perPersonMid).toBeGreaterThanOrEqual(1);
  });
});
