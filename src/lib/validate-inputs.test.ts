import { describe, it, expect } from 'vitest';
import { validateTripInputs } from './validate-inputs';
import type { RouteSegment, TripSettings } from '../types';
import { makeSettings as _makeSettings, makeBudget } from '../test/fixtures';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LOC_A = { id: 'a', name: 'Winnipeg', lat: 49.895, lng: -97.138, type: 'origin' as const };
const LOC_B = { id: 'b', name: 'Brandon', lat: 49.845, lng: -99.950, type: 'destination' as const };

function makeSeg(overrides: Partial<RouteSegment> = {}): RouteSegment {
  return {
    from: LOC_A,
    to: LOC_B,
    distanceKm: 200,
    durationMinutes: 120,
    fuelNeededLitres: 20,
    fuelCost: 30,
    ...overrides,
  };
}

const makeSettings = (overrides: Partial<TripSettings> = {}) => _makeSettings({
  maxDriveHours: 8, numTravelers: 2, numDrivers: 1,
  budgetMode: 'open',
  budget: makeBudget({ mode: 'open', weights: { gas: 25, hotel: 35, food: 25, misc: 15 }, gas: 0, hotel: 0, food: 0, misc: 0, total: 0 }),
  departureDate: '2026-08-01', departureTime: '08:00',
  returnDate: '2026-08-05', arrivalDate: '2026-08-05', arrivalTime: '18:00',
  gasPrice: 1.60, hotelPricePerNight: 120, mealPricePerDay: 50,
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('validateTripInputs', () => {
  describe('valid inputs', () => {
    it('returns an empty array for valid inputs', () => {
      const errors = validateTripInputs([makeSeg()], makeSettings());
      expect(errors).toHaveLength(0);
    });

    it('accepts multiple valid segments', () => {
      const segs = [makeSeg(), makeSeg({ distanceKm: 300, durationMinutes: 180 })];
      const errors = validateTripInputs(segs, makeSettings());
      expect(errors).toHaveLength(0);
    });
  });

  describe('segment validation', () => {
    it('reports an error for empty segments array', () => {
      const errors = validateTripInputs([], makeSettings());
      expect(errors.some(e => e.includes('No route segments'))).toBe(true);
    });

    it('reports an error when a segment has NaN distanceKm', () => {
      const errors = validateTripInputs([makeSeg({ distanceKm: NaN })], makeSettings());
      expect(errors.some(e => e.includes('invalid distance'))).toBe(true);
    });

    it('reports an error when a segment has NaN durationMinutes', () => {
      const errors = validateTripInputs([makeSeg({ durationMinutes: NaN })], makeSettings());
      expect(errors.some(e => e.includes('invalid distance'))).toBe(true);
    });

    it('counts multiple bad segments in the error message', () => {
      const segs = [
        makeSeg({ distanceKm: NaN }),
        makeSeg({ durationMinutes: NaN }),
      ];
      const errors = validateTripInputs(segs, makeSettings());
      const badSegError = errors.find(e => e.includes('segment'));
      expect(badSegError).toMatch(/2.*segment/);
    });
  });

  describe('settings validation', () => {
    it('reports an error when maxDriveHours is 0', () => {
      const errors = validateTripInputs([makeSeg()], makeSettings({ maxDriveHours: 0 }));
      expect(errors.some(e => e.includes('Max drive hours'))).toBe(true);
    });

    it('reports an error when maxDriveHours is negative', () => {
      const errors = validateTripInputs([makeSeg()], makeSettings({ maxDriveHours: -1 }));
      expect(errors.some(e => e.includes('Max drive hours'))).toBe(true);
    });

    it('reports an error when maxDriveHours is NaN', () => {
      const errors = validateTripInputs([makeSeg()], makeSettings({ maxDriveHours: NaN }));
      expect(errors.some(e => e.includes('Max drive hours'))).toBe(true);
    });

    it('reports an error when numTravelers is 0', () => {
      const errors = validateTripInputs([makeSeg()], makeSettings({ numTravelers: 0 }));
      expect(errors.some(e => e.includes('traveler'))).toBe(true);
    });

    it('reports an error when numTravelers is a float', () => {
      const errors = validateTripInputs([makeSeg()], makeSettings({ numTravelers: 1.5 }));
      expect(errors.some(e => e.includes('traveler'))).toBe(true);
    });

    it('reports an error when numDrivers is 0', () => {
      const errors = validateTripInputs([makeSeg()], makeSettings({ numDrivers: 0 }));
      expect(errors.some(e => e.includes('driver'))).toBe(true);
    });

    it('reports an error when numDrivers exceeds numTravelers', () => {
      const errors = validateTripInputs([makeSeg()], makeSettings({ numTravelers: 2, numDrivers: 3 }));
      expect(errors.some(e => e.includes('cannot exceed'))).toBe(true);
    });

    it('does not report driver error when drivers = travelers (equal is valid)', () => {
      const errors = validateTripInputs([makeSeg()], makeSettings({ numTravelers: 2, numDrivers: 2 }));
      expect(errors).toHaveLength(0);
    });

    it('reports an error when budget.total is negative', () => {
      const settings = makeSettings();
      settings.budget.total = -100;
      const errors = validateTripInputs([makeSeg()], settings);
      expect(errors.some(e => e.includes('Budget total'))).toBe(true);
    });

    it('accepts budget.total of 0 (open mode)', () => {
      const settings = makeSettings();
      settings.budget.total = 0;
      const errors = validateTripInputs([makeSeg()], settings);
      expect(errors).toHaveLength(0);
    });
  });

  describe('multiple errors collected', () => {
    it('returns multiple errors if several conditions fail simultaneously', () => {
      const errors = validateTripInputs([], makeSettings({ maxDriveHours: 0, numTravelers: 0 }));
      expect(errors.length).toBeGreaterThanOrEqual(3); // no segments + maxDriveHours + numTravelers
    });
  });
});
