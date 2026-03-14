/**
 * unit-conversions.ts — unit tests
 *
 * Pure functions — no mocks needed.
 * Covers: convertMpgToL100km, convertL100kmToMpg, convertLitresToGallons,
 *         convertGallonsToLitres, getTankSizeLitres, getWeightedFuelEconomyL100km,
 *         estimateGasStops.
 */

import { describe, it, expect } from 'vitest';
import type { Vehicle } from '../types';
import {
  convertMpgToL100km,
  convertL100kmToMpg,
  convertLitresToGallons,
  convertGallonsToLitres,
  getTankSizeLitres,
  getWeightedFuelEconomyL100km,
  estimateGasStops,
} from './unit-conversions';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v1',
    name: 'Test Car',
    tankSize: 60,         // litres (metric)
    fuelEconomyHwy: 8.0,  // L/100km (metric)
    fuelEconomyCity: 12.0,
    type: 'car',
    ...overrides,
  } as Vehicle;
}

// ─── convertMpgToL100km ───────────────────────────────────────────────────────

describe('convertMpgToL100km', () => {
  it('converts 30 MPG to ~7.84 L/100km', () => {
    expect(convertMpgToL100km(30)).toBeCloseTo(7.84, 1);
  });

  it('converts 25 MPG correctly', () => {
    expect(convertMpgToL100km(25)).toBeCloseTo(9.41, 1);
  });

  it('returns 0 when mpg is 0 (avoid divide-by-zero)', () => {
    expect(convertMpgToL100km(0)).toBe(0);
  });

  it('is inverse of convertL100kmToMpg', () => {
    const l100km = convertMpgToL100km(30);
    expect(convertL100kmToMpg(l100km)).toBeCloseTo(30, 5);
  });
});

// ─── convertL100kmToMpg ───────────────────────────────────────────────────────

describe('convertL100kmToMpg', () => {
  it('converts 8 L/100km to ~29.4 MPG', () => {
    expect(convertL100kmToMpg(8)).toBeCloseTo(29.4, 0);
  });

  it('returns 0 when l100km is 0', () => {
    expect(convertL100kmToMpg(0)).toBe(0);
  });

  it('is inverse of convertMpgToL100km', () => {
    const mpg = convertL100kmToMpg(8);
    expect(convertMpgToL100km(mpg)).toBeCloseTo(8, 5);
  });
});

// ─── convertLitresToGallons / convertGallonsToLitres ─────────────────────────

describe('convertLitresToGallons', () => {
  it('converts 3.78541 litres to ~1 gallon', () => {
    expect(convertLitresToGallons(3.78541)).toBeCloseTo(1, 4);
  });

  it('converts 0 litres to 0 gallons', () => {
    expect(convertLitresToGallons(0)).toBe(0);
  });
});

describe('convertGallonsToLitres', () => {
  it('converts 1 gallon to ~3.785 litres', () => {
    expect(convertGallonsToLitres(1)).toBeCloseTo(3.785, 2);
  });

  it('is inverse of convertLitresToGallons', () => {
    const litres = convertGallonsToLitres(10);
    expect(convertLitresToGallons(litres)).toBeCloseTo(10, 5);
  });
});

// ─── getTankSizeLitres ────────────────────────────────────────────────────────

describe('getTankSizeLitres', () => {
  it('returns tankSize as-is for metric', () => {
    const v = makeVehicle({ tankSize: 60 });
    expect(getTankSizeLitres(v, 'metric')).toBe(60);
  });

  it('converts gallons to litres for imperial', () => {
    const v = makeVehicle({ tankSize: 15 }); // 15 gallons
    expect(getTankSizeLitres(v, 'imperial')).toBeCloseTo(15 * 3.78541, 2);
  });
});

// ─── getWeightedFuelEconomyL100km ─────────────────────────────────────────────

describe('getWeightedFuelEconomyL100km', () => {
  it('blends metric hwy/city at 80/20', () => {
    // 8.0 * 0.8 + 12.0 * 0.2 = 6.4 + 2.4 = 8.8
    const v = makeVehicle({ fuelEconomyHwy: 8.0, fuelEconomyCity: 12.0 });
    expect(getWeightedFuelEconomyL100km(v, 'metric')).toBeCloseTo(8.8, 4);
  });

  it('converts imperial MPG values before blending', () => {
    // hwy=30mpg → 7.84 L/100km, city=20mpg → 11.76 L/100km
    // blended = 7.84*0.8 + 11.76*0.2 = 6.272 + 2.352 = 8.624
    const v = makeVehicle({ fuelEconomyHwy: 30, fuelEconomyCity: 20 });
    expect(getWeightedFuelEconomyL100km(v, 'imperial')).toBeCloseTo(8.624, 1);
  });

  it('hwy economy dominates (80% weight)', () => {
    const v = makeVehicle({ fuelEconomyHwy: 5.0, fuelEconomyCity: 20.0 });
    const result = getWeightedFuelEconomyL100km(v, 'metric');
    // Should be closer to hwy (5.0) than city (20.0)
    expect(result).toBeLessThan(10);
  });
});

// ─── estimateGasStops ─────────────────────────────────────────────────────────

describe('estimateGasStops', () => {
  it('returns 0 for a trip that fits in one tank (0.75 usable fraction)', () => {
    // tank=60L, usable=45L. totalFuel=40L → 1 fill → 1-1=0 stops
    expect(estimateGasStops(40, 60)).toBe(0);
  });

  it('returns 1 stop when trip requires two tank fills', () => {
    // tank=60L, usable=45L. totalFuel=90L → 2 fills → 2-1=1 stop
    expect(estimateGasStops(90, 60)).toBe(1);
  });

  it('returns 0 for zero fuel needed', () => {
    expect(estimateGasStops(0, 60)).toBe(0);
  });

  it('never returns negative', () => {
    expect(estimateGasStops(1, 60)).toBeGreaterThanOrEqual(0);
  });

  it('increases with longer trips', () => {
    const stops1 = estimateGasStops(90, 60);
    const stops2 = estimateGasStops(180, 60);
    expect(stops2).toBeGreaterThan(stops1);
  });
});
