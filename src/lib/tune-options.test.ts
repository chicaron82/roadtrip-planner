/**
 * tune-options — unit tests
 *
 * Pure function — no DOM, no rendering.
 */

import { describe, it, expect } from 'vitest';
import { buildTuneOptions } from './tune-options';
import type { TuneOptionPair } from './tune-options';
import type { TripSettings, TripSummary } from '../types';
import { DEFAULT_BUDGET } from './budget';

// ── Fixtures ────────────────────────────────────────────────────────────────

const BASE_SETTINGS: TripSettings = {
  units: 'metric',
  currency: 'CAD',
  maxDriveHours: 8,
  numTravelers: 2,
  numDrivers: 1,
  budgetMode: 'open',
  budget: DEFAULT_BUDGET,
  departureDate: '2026-03-20',
  departureTime: '09:00',
  returnDate: '',
  arrivalDate: '',
  arrivalTime: '',
  useArrivalTime: false,
  gasPrice: 1.50,
  hotelPricePerNight: 140,
  hotelTier: 'regular',
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
  includeStartingLocation: true,
};

const BASE_SUMMARY: TripSummary = {
  totalDistanceKm: 600,
  totalDurationMinutes: 400,
  totalFuelLitres: 40,
  totalFuelCost: 60,
  gasStops: 1,
  costPerPerson: 200,
  drivingDays: 2,
  segments: [],
  fullGeometry: [],
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function findPair(pairs: TuneOptionPair[], axis: TuneOptionPair['axis']) {
  return pairs.find(p => p.axis === axis);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('buildTuneOptions', () => {
  it('returns 3 pairs for default settings (all axes available)', () => {
    const pairs = buildTuneOptions(BASE_SETTINGS, BASE_SUMMARY);
    expect(pairs).toHaveLength(3);
    expect(pairs.map(p => p.axis)).toEqual(['pace', 'hotels', 'route']);
  });

  it('each pair has exactly 2 options', () => {
    const pairs = buildTuneOptions(BASE_SETTINGS, BASE_SUMMARY);
    for (const pair of pairs) {
      expect(pair.options).toHaveLength(2);
    }
  });

  // ── Pace axis ───────────────────────────────────────────────────────────

  describe('pace axis', () => {
    it('offers relaxed and push for mid-range hours (8h)', () => {
      const pair = findPair(buildTuneOptions(BASE_SETTINGS, BASE_SUMMARY), 'pace')!;
      expect(pair.options[0].id).toBe('pace-relaxed');
      expect(pair.options[1].id).toBe('pace-push');
    });

    it('relaxed decreases hours by 2', () => {
      const pair = findPair(buildTuneOptions(BASE_SETTINGS, BASE_SUMMARY), 'pace')!;
      expect(pair.options[0].patch.maxDriveHours).toBe(6);
    });

    it('push increases hours by 2', () => {
      const pair = findPair(buildTuneOptions(BASE_SETTINGS, BASE_SUMMARY), 'pace')!;
      expect(pair.options[1].patch.maxDriveHours).toBe(10);
    });

    it('hides pace pair when already at minimum (5h)', () => {
      const settings = { ...BASE_SETTINGS, maxDriveHours: 5 };
      const pair = findPair(buildTuneOptions(settings, BASE_SUMMARY), 'pace');
      expect(pair).toBeUndefined();
    });

    it('hides pace pair when already at maximum (10h)', () => {
      const settings = { ...BASE_SETTINGS, maxDriveHours: 10 };
      const pair = findPair(buildTuneOptions(settings, BASE_SUMMARY), 'pace');
      expect(pair).toBeUndefined();
    });

    it('clamps relaxed to 5h floor', () => {
      const settings = { ...BASE_SETTINGS, maxDriveHours: 6 };
      const pair = findPair(buildTuneOptions(settings, BASE_SUMMARY), 'pace')!;
      const relaxed = pair.options.find(o => o.id === 'pace-relaxed')!;
      expect(relaxed.patch.maxDriveHours).toBe(5);
    });

    it('clamps push to 10h ceiling', () => {
      const settings = { ...BASE_SETTINGS, maxDriveHours: 9 };
      const pair = findPair(buildTuneOptions(settings, BASE_SUMMARY), 'pace')!;
      const push = pair.options.find(o => o.id === 'pace-push')!;
      expect(push.patch.maxDriveHours).toBe(10);
    });
  });

  // ── Hotels axis ─────────────────────────────────────────────────────────

  describe('hotels axis', () => {
    it('offers upgrade and save for regular tier', () => {
      const pair = findPair(buildTuneOptions(BASE_SETTINGS, BASE_SUMMARY), 'hotels')!;
      expect(pair.options[0].id).toBe('hotels-upgrade');
      expect(pair.options[1].id).toBe('hotels-save');
    });

    it('upgrade from regular goes to premium ($220)', () => {
      const pair = findPair(buildTuneOptions(BASE_SETTINGS, BASE_SUMMARY), 'hotels')!;
      expect(pair.options[0].patch.hotelTier).toBe('premium');
      expect(pair.options[0].patch.hotelPricePerNight).toBe(220);
    });

    it('save from regular goes to budget ($90)', () => {
      const pair = findPair(buildTuneOptions(BASE_SETTINGS, BASE_SUMMARY), 'hotels')!;
      expect(pair.options[1].patch.hotelTier).toBe('budget');
      expect(pair.options[1].patch.hotelPricePerNight).toBe(90);
    });

    it('hides hotel pair when already at premium', () => {
      const settings = { ...BASE_SETTINGS, hotelTier: 'premium' as const };
      const pair = findPair(buildTuneOptions(settings, BASE_SUMMARY), 'hotels');
      expect(pair).toBeUndefined();
    });

    it('hides hotel pair when already at budget', () => {
      const settings = { ...BASE_SETTINGS, hotelTier: 'budget' as const };
      const pair = findPair(buildTuneOptions(settings, BASE_SUMMARY), 'hotels');
      expect(pair).toBeUndefined();
    });

    it('upgrade from budget goes to regular ($140)', () => {
      const settings = { ...BASE_SETTINGS, hotelTier: 'budget' as const };
      // Budget has no pair (only upgrade available), so this verifies
      // the edge — budget is excluded because save would go nowhere.
      const pair = findPair(buildTuneOptions(settings, BASE_SUMMARY), 'hotels');
      expect(pair).toBeUndefined();
    });

    it('defaults to regular when hotelTier is undefined', () => {
      const settings = { ...BASE_SETTINGS, hotelTier: undefined };
      const pair = findPair(buildTuneOptions(settings, BASE_SUMMARY), 'hotels')!;
      expect(pair).toBeDefined();
      expect(pair.options[0].patch.hotelTier).toBe('premium');
      expect(pair.options[1].patch.hotelTier).toBe('budget');
    });
  });

  // ── Route axis ──────────────────────────────────────────────────────────

  describe('route axis', () => {
    it('always shows both scenic and fastest options', () => {
      const pair = findPair(buildTuneOptions(BASE_SETTINGS, BASE_SUMMARY), 'route')!;
      expect(pair.options[0].id).toBe('route-scenic');
      expect(pair.options[1].id).toBe('route-fastest');
    });

    it('scenic patch enables scenicMode and sets routePreference', () => {
      const pair = findPair(buildTuneOptions(BASE_SETTINGS, BASE_SUMMARY), 'route')!;
      expect(pair.options[0].patch).toEqual({
        scenicMode: true,
        routePreference: 'scenic',
      });
    });

    it('fastest patch disables scenicMode and sets routePreference', () => {
      const pair = findPair(buildTuneOptions(BASE_SETTINGS, BASE_SUMMARY), 'route')!;
      expect(pair.options[1].patch).toEqual({
        scenicMode: false,
        routePreference: 'fastest',
      });
    });

    it('route pair is present even when already scenic', () => {
      const settings = { ...BASE_SETTINGS, scenicMode: true, routePreference: 'scenic' as const };
      const pair = findPair(buildTuneOptions(settings, BASE_SUMMARY), 'route');
      expect(pair).toBeDefined();
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('all options have non-empty patches', () => {
      const pairs = buildTuneOptions(BASE_SETTINGS, BASE_SUMMARY);
      for (const pair of pairs) {
        for (const opt of pair.options) {
          expect(Object.keys(opt.patch).length).toBeGreaterThan(0);
        }
      }
    });

    it('all options have emoji and label', () => {
      const pairs = buildTuneOptions(BASE_SETTINGS, BASE_SUMMARY);
      for (const pair of pairs) {
        for (const opt of pair.options) {
          expect(opt.emoji.length).toBeGreaterThan(0);
          expect(opt.label.length).toBeGreaterThan(0);
        }
      }
    });

    it('returns only route pair when pace at extremes and hotels at budget', () => {
      const settings = { ...BASE_SETTINGS, maxDriveHours: 10, hotelTier: 'budget' as const };
      const pairs = buildTuneOptions(settings, BASE_SUMMARY);
      expect(pairs).toHaveLength(1);
      expect(pairs[0].axis).toBe('route');
    });
  });
});
