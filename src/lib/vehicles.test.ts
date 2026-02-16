/**
 * Tests for vehicles.ts
 *
 * Validates structure integrity of the vehicle database and COMMON_MAKES list.
 */

import { describe, it, expect } from 'vitest';
import { VEHICLE_DB, COMMON_MAKES } from './vehicles';
import type { VehicleStats } from './vehicles';

// ==================== VEHICLE_DB structure ====================

describe('VEHICLE_DB', () => {
  it('has at least 10 makes', () => {
    expect(Object.keys(VEHICLE_DB).length).toBeGreaterThanOrEqual(10);
  });

  it('every make has at least one model', () => {
    for (const [make, models] of Object.entries(VEHICLE_DB)) {
      expect(Object.keys(models).length, `${make} should have models`).toBeGreaterThan(0);
    }
  });

  it.each(Object.entries(VEHICLE_DB).flatMap(([make, models]) =>
    Object.entries(models).map(([model, stats]) => [make, model, stats] as [string, string, VehicleStats])
  ))('%s %s has valid city/hwy/tank numbers', (_make, _model, stats) => {
    expect(stats.city).toBeGreaterThan(0);
    expect(stats.hwy).toBeGreaterThan(0);
    expect(stats.tank).toBeGreaterThan(0);
  });

  it('highway fuel is less than or equal to city fuel for ICE vehicles', () => {
    for (const [make, models] of Object.entries(VEHICLE_DB)) {
      for (const [model, stats] of Object.entries(models)) {
        // Highway consumption should be <= city consumption
        expect(stats.hwy, `${make} ${model}: hwy should be <= city`).toBeLessThanOrEqual(stats.city);
      }
    }
  });

  it('includes known popular models', () => {
    expect(VEHICLE_DB['Toyota']['Camry']).toBeDefined();
    expect(VEHICLE_DB['Honda']['Civic']).toBeDefined();
    expect(VEHICLE_DB['Ford']['F-150']).toBeDefined();
    expect(VEHICLE_DB['Tesla']['Model 3']).toBeDefined();
  });

  it('Tesla models have isEV flag', () => {
    for (const [model, stats] of Object.entries(VEHICLE_DB['Tesla'])) {
      expect(stats.isEV, `Tesla ${model} should be EV`).toBe(true);
    }
  });

  it('non-Tesla models do not have isEV flag set', () => {
    for (const [make, models] of Object.entries(VEHICLE_DB)) {
      if (make === 'Tesla') continue;
      for (const [model, stats] of Object.entries(models)) {
        expect(stats.isEV, `${make} ${model} should not be EV`).toBeFalsy();
      }
    }
  });

  it('tank sizes are realistic (20-200 litres)', () => {
    for (const [make, models] of Object.entries(VEHICLE_DB)) {
      for (const [model, stats] of Object.entries(models)) {
        expect(stats.tank, `${make} ${model} tank`).toBeGreaterThanOrEqual(20);
        expect(stats.tank, `${make} ${model} tank`).toBeLessThanOrEqual(200);
      }
    }
  });
});

// ==================== COMMON_MAKES ====================

describe('COMMON_MAKES', () => {
  it('is sorted alphabetically', () => {
    const sorted = [...COMMON_MAKES].sort();
    expect(COMMON_MAKES).toEqual(sorted);
  });

  it('has the same length as VEHICLE_DB keys', () => {
    expect(COMMON_MAKES.length).toBe(Object.keys(VEHICLE_DB).length);
  });

  it('every make in COMMON_MAKES exists in VEHICLE_DB', () => {
    for (const make of COMMON_MAKES) {
      expect(VEHICLE_DB[make], `${make} should exist in DB`).toBeDefined();
    }
  });

  it('every make in VEHICLE_DB is in COMMON_MAKES', () => {
    for (const make of Object.keys(VEHICLE_DB)) {
      expect(COMMON_MAKES, `${make} should be in COMMON_MAKES`).toContain(make);
    }
  });
});
