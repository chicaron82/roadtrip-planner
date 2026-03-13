import { describe, it, expect } from 'vitest';
import type { Vehicle, TripSettings, TripBudget } from '../types';
import {
  calculateHumanFuelCosts,
  calculateStrategicFuelStops,
  STOP_DURATIONS,
  STOP_LABELS,
} from './fuel-stops';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    year: '2023',
    make: 'Toyota',
    model: 'RAV4',
    fuelEconomyCity: 10,  // 10 L/100km
    fuelEconomyHwy: 8,    // 8 L/100km
    tankSize: 60,         // 60 litres
    ...overrides,
  };
}

function makeSettings(overrides: Partial<TripSettings> = {}): TripSettings {
  const budget: TripBudget = {
    mode: 'open',
    allocation: 'fixed',
    profile: 'balanced',
    weights: { gas: 25, hotel: 25, food: 25, misc: 25 },
    gas: 250, hotel: 250, food: 250, misc: 250, total: 1000,
  };
  return {
    units: 'metric',
    currency: 'CAD',
    maxDriveHours: 8,
    numTravelers: 2,
    numDrivers: 1,
    budgetMode: 'open',
    budget,
    departureDate: '2025-08-16',
    departureTime: '08:00',
    returnDate: '2025-08-20',
    arrivalDate: '2025-08-20',
    arrivalTime: '18:00',
    useArrivalTime: false,
    gasPrice: 1.60,
    hotelPricePerNight: 120,
    mealPricePerDay: 60,
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

// ─── calculateHumanFuelCosts ──────────────────────────────────────────────────

describe('calculateHumanFuelCosts', () => {
  const TANK = 60;       // litres
  const PRICE = 1.60;    // $/L
  const ECONOMY = 10;    // L/100km
  const FULL_TANK = TANK * PRICE; // 96

  it('0 stops: returns distance-based cost, no per-stop cost', () => {
    // 300 km @ 10 L/100km @ $1.60 = 300/100 * 10 * 1.60 = $48
    const result = calculateHumanFuelCosts(0, TANK, PRICE, 300, ECONOMY);
    expect(result.totalFuelCost).toBeCloseTo(48);
    expect(result.perStopCost).toBe(0);
    expect(result.lastStopCost).toBeCloseTo(48);
  });

  it('0 stops with 0 km: all costs are 0', () => {
    const result = calculateHumanFuelCosts(0, TANK, PRICE, 0, ECONOMY);
    expect(result.totalFuelCost).toBe(0);
    expect(result.perStopCost).toBe(0);
    expect(result.lastStopCost).toBe(0);
  });

  it('1 stop: totalFuelCost equals a full tank fill', () => {
    const result = calculateHumanFuelCosts(1, TANK, PRICE, 200, ECONOMY);
    expect(result.totalFuelCost).toBeCloseTo(FULL_TANK);
    expect(result.perStopCost).toBeCloseTo(FULL_TANK);
    expect(result.lastStopCost).toBeCloseTo(FULL_TANK);
  });

  it('1 stop: totalFuelCost, perStopCost, and lastStopCost are all equal', () => {
    const { totalFuelCost, perStopCost, lastStopCost } = calculateHumanFuelCosts(1, TANK, PRICE, 100, ECONOMY);
    expect(totalFuelCost).toBe(perStopCost);
    expect(perStopCost).toBe(lastStopCost);
  });

  it('2 stops: total = 1 full tank + partial last leg', () => {
    // last leg: 200 km @ 10 L/100km @ $1.60 = $32, which is < full tank ($96)
    const result = calculateHumanFuelCosts(2, TANK, PRICE, 200, ECONOMY);
    const lastCost = (200 / 100) * ECONOMY * PRICE; // $32
    expect(result.perStopCost).toBeCloseTo(FULL_TANK);
    expect(result.lastStopCost).toBeCloseTo(lastCost);
    expect(result.totalFuelCost).toBeCloseTo(FULL_TANK + lastCost);
  });

  it('3 stops: total = 2 full tanks + partial last leg', () => {
    // last leg: 100 km @ 10 L/100km @ $1.60 = $16
    const result = calculateHumanFuelCosts(3, TANK, PRICE, 100, ECONOMY);
    const lastCost = (100 / 100) * ECONOMY * PRICE; // $16
    expect(result.totalFuelCost).toBeCloseTo(2 * FULL_TANK + lastCost);
    expect(result.lastStopCost).toBeCloseTo(lastCost);
  });

  it('last stop cost is clamped to a full tank when the last leg needs more fuel than the tank holds', () => {
    // last leg: 2000 km (would need more than tank capacity) — should cap at full tank
    const result = calculateHumanFuelCosts(2, TANK, PRICE, 2000, ECONOMY);
    expect(result.lastStopCost).toBeCloseTo(FULL_TANK);
  });

  it('perStopCost is always a full tank cost when there are multiple stops', () => {
    for (const count of [2, 3, 4, 5]) {
      const { perStopCost } = calculateHumanFuelCosts(count, TANK, PRICE, 100, ECONOMY);
      expect(perStopCost).toBeCloseTo(FULL_TANK);
    }
  });

  it('scales linearly with gas price', () => {
    const r1 = calculateHumanFuelCosts(2, TANK, 1.00, 200, ECONOMY);
    const r2 = calculateHumanFuelCosts(2, TANK, 2.00, 200, ECONOMY);
    expect(r2.totalFuelCost).toBeCloseTo(r1.totalFuelCost * 2);
  });

  it('scales linearly with tank size', () => {
    const r1 = calculateHumanFuelCosts(1, 40, PRICE, 200, ECONOMY);
    const r2 = calculateHumanFuelCosts(1, 80, PRICE, 200, ECONOMY);
    expect(r2.totalFuelCost).toBeCloseTo(r1.totalFuelCost * 2);
  });

  it('total >= lastStopCost for any positive stop count', () => {
    for (const count of [1, 2, 5, 10]) {
      const { totalFuelCost, lastStopCost } = calculateHumanFuelCosts(count, TANK, PRICE, 300, ECONOMY);
      expect(totalFuelCost).toBeGreaterThanOrEqual(lastStopCost);
    }
  });
});

// ─── STOP_DURATIONS ───────────────────────────────────────────────────────────

describe('STOP_DURATIONS', () => {
  it('has all expected stop type keys', () => {
    const keys: (keyof typeof STOP_DURATIONS)[] = ['drive', 'fuel', 'break', 'quickMeal', 'meal', 'overnight'];
    for (const key of keys) {
      expect(STOP_DURATIONS).toHaveProperty(key);
    }
  });

  it('drive stop has 0-minute duration (no stop)', () => {
    expect(STOP_DURATIONS.drive).toBe(0);
  });

  it('fuel stop is a quick 10 minutes', () => {
    expect(STOP_DURATIONS.fuel).toBe(10);
  });

  it('break is 15 minutes', () => {
    expect(STOP_DURATIONS.break).toBe(15);
  });

  it('quickMeal is 30 minutes', () => {
    expect(STOP_DURATIONS.quickMeal).toBe(30);
  });

  it('full meal is 60 minutes', () => {
    expect(STOP_DURATIONS.meal).toBe(60);
  });

  it('overnight is 720 minutes (12 hours)', () => {
    expect(STOP_DURATIONS.overnight).toBe(720);
  });

  it('durations are in ascending order (shorter stops first)', () => {
    const { drive, fuel, break: b, quickMeal, meal, overnight } = STOP_DURATIONS;
    expect(drive).toBeLessThan(fuel);
    expect(fuel).toBeLessThan(b);
    expect(b).toBeLessThan(quickMeal);
    expect(quickMeal).toBeLessThan(meal);
    expect(meal).toBeLessThan(overnight);
  });
});

// ─── STOP_LABELS ──────────────────────────────────────────────────────────────

describe('STOP_LABELS', () => {
  it('has a label for every key in STOP_DURATIONS', () => {
    for (const key of Object.keys(STOP_DURATIONS) as (keyof typeof STOP_DURATIONS)[]) {
      expect(STOP_LABELS).toHaveProperty(key);
    }
  });

  it('drive label is human-readable', () => {
    expect(STOP_LABELS.drive).toBeTruthy();
    expect(typeof STOP_LABELS.drive).toBe('string');
  });

  it('fuel label contains a fuel emoji', () => {
    expect(STOP_LABELS.fuel).toContain('⛽');
  });

  it('break label contains a coffee emoji', () => {
    expect(STOP_LABELS.break).toContain('☕');
  });

  it('overnight label contains a hotel emoji', () => {
    expect(STOP_LABELS.overnight).toContain('🏨');
  });
});

// ─── calculateStrategicFuelStops — guard clauses ──────────────────────────────

describe('calculateStrategicFuelStops', () => {
  it('returns empty array when routeGeometry is empty', () => {
    const result = calculateStrategicFuelStops([], [{ distanceKm: 100, durationMinutes: 60 } as never], makeVehicle(), makeSettings());
    expect(result).toEqual([]);
  });

  it('returns empty array when segments array is empty', () => {
    const geometry: [number, number][] = [[49.895, -97.138], [50.0, -97.0]];
    const result = calculateStrategicFuelStops(geometry, [], makeVehicle(), makeSettings());
    expect(result).toEqual([]);
  });

  it('returns empty array when both geometry and segments are empty', () => {
    const result = calculateStrategicFuelStops([], [], makeVehicle(), makeSettings());
    expect(result).toEqual([]);
  });

  it('returns no stops for a very short route (under the comfort-refuel interval)', () => {
    // 100 km straight line, ~1h drive — well under 3.5h balanced interval
    const loc = { id: 'a', name: 'A', lat: 49.90, lng: -97.14, type: 'waypoint' as const };
    const geometry: [number, number][] = [[49.90, -97.14], [50.90, -97.14]];
    const segments = [{
      from: loc, to: { ...loc, id: 'b', name: 'B', lat: 50.90 },
      distanceKm: 100,
      durationMinutes: 60,
      fuelNeededLitres: 8,
      fuelCost: 12.8,
    }];
    const result = calculateStrategicFuelStops(geometry, segments as never, makeVehicle({ tankSize: 80 }), makeSettings());
    expect(result).toHaveLength(0);
  });

  it('returns stops for a long route (over 3.5h with balanced frequency)', () => {
    // ~800 km route across 8 segments of 100 km / 60 min each = 8h total
    const baseLoc = { id: 'a', name: 'A', lat: 50.0, lng: -97.0, type: 'waypoint' as const };
    const geometry: [number, number][] = Array.from({ length: 9 }, (_, i) => [50.0 + i, -97.0] as [number, number]);
    const segments = Array.from({ length: 8 }, (_, i) => ({
      from: { ...baseLoc, id: `s${i}`, lat: 50.0 + i },
      to: { ...baseLoc, id: `s${i + 1}`, lat: 50.0 + i + 1 },
      distanceKm: 100,
      durationMinutes: 60,
      fuelNeededLitres: 8,
      fuelCost: 12.8,
    }));
    const result = calculateStrategicFuelStops(geometry, segments as never, makeVehicle(), makeSettings());
    // 8h trip with 3.5h interval → expect ~2 stops
    expect(result.length).toBeGreaterThan(0);
  });

  it('each stop has required fields: lat, lng, distanceFromStart, estimatedTime, fuelRemaining', () => {
    const baseLoc = { id: 'a', name: 'A', lat: 50.0, lng: -97.0, type: 'waypoint' as const };
    const geometry: [number, number][] = Array.from({ length: 9 }, (_, i) => [50.0 + i, -97.0] as [number, number]);
    const segments = Array.from({ length: 8 }, (_, i) => ({
      from: { ...baseLoc, id: `s${i}`, lat: 50.0 + i },
      to: { ...baseLoc, id: `s${i + 1}`, lat: 50.0 + i + 1 },
      distanceKm: 100, durationMinutes: 60,
      fuelNeededLitres: 8, fuelCost: 12.8,
    }));
    const result = calculateStrategicFuelStops(geometry, segments as never, makeVehicle(), makeSettings());
    for (const stop of result) {
      expect(stop).toHaveProperty('lat');
      expect(stop).toHaveProperty('lng');
      expect(stop).toHaveProperty('distanceFromStart');
      expect(stop).toHaveProperty('estimatedTime');
      expect(stop).toHaveProperty('fuelRemaining');
    }
  });
});
