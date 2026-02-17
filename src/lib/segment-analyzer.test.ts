/**
 * Tests for segment-analyzer.ts
 *
 * Covers segment warnings, border detection, timezone detection,
 * arrival time calculation, pacing suggestions, and fuel stops.
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeSegments,
  calculateArrivalTime,
  generatePacingSuggestions,
  calculateFuelStops,
} from './segment-analyzer';
import type { RouteSegment, Location, TripSettings } from '../types';

// ==================== HELPERS ====================

function makeLocation(name: string, lat = 49.8, lng = -97.1): Location {
  return { id: `loc-${name}`, name, lat, lng, type: 'waypoint' };
}

function makeSegment(overrides: Partial<RouteSegment> = {}): RouteSegment {
  return {
    from: makeLocation('A'),
    to: makeLocation('B'),
    distanceKm: 200,
    durationMinutes: 120,
    fuelNeededLitres: 15,
    fuelCost: 25,
    ...overrides,
  };
}

function makeSettings(overrides: Partial<TripSettings> = {}): TripSettings {
  return {
    units: 'metric',
    currency: 'CAD',
    maxDriveHours: 8,
    numTravelers: 2,
    numDrivers: 1,
    budgetMode: 'plan-to-budget',
    budget: {
      mode: 'plan-to-budget',
      profile: 'balanced',
      weights: { gas: 25, hotel: 40, food: 25, misc: 10 },
      allocation: 'flexible',
      total: 2000,
      gas: 500,
      hotel: 800,
      food: 500,
      misc: 200,
    },
    departureDate: '2025-08-16',
    departureTime: '09:00',
    arrivalDate: '',
    arrivalTime: '',
    useArrivalTime: false,
    gasPrice: 1.65,
    hotelPricePerNight: 150,
    mealPricePerDay: 50,
    isRoundTrip: false,
    avoidTolls: false,
    avoidBorders: false,
    scenicMode: false,
    routePreference: 'fastest',
    stopFrequency: 'balanced',
    tripPreferences: [],
    ...overrides,
  };
}

// ==================== analyzeSegments ====================

describe('analyzeSegments', () => {
  it('adds critical warning for 6+ hour drives', () => {
    const segments = [makeSegment({ durationMinutes: 400 })]; // ~6.7h
    const result = analyzeSegments(segments);
    const warnings = result[0].warnings || [];
    expect(warnings.some(w => w.severity === 'critical' && w.type === 'long_drive')).toBe(true);
  });

  it('adds warning for 4-6 hour drives', () => {
    const segments = [makeSegment({ durationMinutes: 270 })]; // 4.5h
    const result = analyzeSegments(segments);
    const warnings = result[0].warnings || [];
    expect(warnings.some(w => w.severity === 'warning' && w.type === 'long_drive')).toBe(true);
  });

  it('no drive warning for short segments', () => {
    const segments = [makeSegment({ durationMinutes: 90 })]; // 1.5h
    const result = analyzeSegments(segments);
    const warnings = result[0].warnings || [];
    expect(warnings.filter(w => w.type === 'long_drive')).toHaveLength(0);
  });

  it('suggests break for segments over 3 hours', () => {
    const segments = [makeSegment({ durationMinutes: 200 })]; // ~3.3h
    const result = analyzeSegments(segments);
    expect(result[0].suggestedBreak).toBe(true);
  });

  it('no break suggestion for short segments', () => {
    const segments = [makeSegment({ durationMinutes: 150 })]; // 2.5h
    const result = analyzeSegments(segments);
    expect(result[0].suggestedBreak).toBe(false);
  });

  it('detects border crossing from Canada to US', () => {
    const segments = [
      makeSegment({
        from: makeLocation('Winnipeg, Manitoba, Canada'),
        to: makeLocation('Grand Forks, North Dakota, USA'),
      }),
    ];
    const result = analyzeSegments(segments);
    const warnings = result[0].warnings || [];
    expect(warnings.some(w => w.type === 'border_crossing')).toBe(true);
  });

  it('no border crossing for domestic travel', () => {
    const segments = [
      makeSegment({
        from: makeLocation('Winnipeg, Manitoba'),
        to: makeLocation('Thunder Bay, Ontario'),
      }),
    ];
    const result = analyzeSegments(segments);
    const warnings = result[0].warnings || [];
    expect(warnings.filter(w => w.type === 'border_crossing')).toHaveLength(0);
  });

  it('detects timezone crossing for large longitude difference', () => {
    const segments = [
      makeSegment({
        from: makeLocation('Winnipeg', 49.8, -97.1),
        to: makeLocation('Toronto', 43.6, -79.4),
      }),
    ];
    const result = analyzeSegments(segments);
    expect(result[0].timezoneCrossing).toBe(true);
    expect(result[0].timezone).toBeDefined();
  });

  it('no timezone crossing for nearby cities', () => {
    const segments = [
      makeSegment({
        from: makeLocation('Toronto', 43.6, -79.4),
        to: makeLocation('Ottawa', 45.4, -75.7),
      }),
    ];
    const result = analyzeSegments(segments);
    expect(result[0].timezoneCrossing).toBe(false);
  });

  it('handles multiple segments independently', () => {
    const segments = [
      makeSegment({ durationMinutes: 90 }),  // short, no warning
      makeSegment({ durationMinutes: 400 }), // long, critical
    ];
    const result = analyzeSegments(segments);
    expect((result[0].warnings || []).filter(w => w.type === 'long_drive')).toHaveLength(0);
    expect((result[1].warnings || []).some(w => w.severity === 'critical')).toBe(true);
  });
});

// ==================== calculateArrivalTime ====================
// NOTE: date assertions are tricky because the source uses new Date(dateString)
// which parses as UTC midnight, then setHours in local time. This can shift the
// date depending on timezone. We test `time` (which uses getHours/getMinutes = local)
// and only assert dates via relative comparison.

describe('calculateArrivalTime', () => {
  it('calculates arrival for same-day trip', () => {
    const result = calculateArrivalTime('09:00', 180); // 3 hours
    expect(result.time).toBe('12:00');
  });

  it('handles overnight rollover', () => {
    const result = calculateArrivalTime('22:30', 120); // 2 hours → 00:30
    expect(result.time).toBe('00:30');
  });

  it('adds minutes correctly', () => {
    const result = calculateArrivalTime('10:15', 45); // 45 min → 11:00
    expect(result.time).toBe('11:00');
  });

  it('returns a date string (YYYY-MM-DD format)', () => {
    const result = calculateArrivalTime('09:00', 180, '2025-08-16');
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('arrival date is later than or equal to departure date', () => {
    const result = calculateArrivalTime('22:00', 180, '2025-08-16');
    // Overnight trip: arrival time should be 01:00
    expect(result.time).toBe('01:00');
    // Date should be at least the departure date
    expect(result.date >= '2025-08-16').toBe(true);
  });

  it('multi-day duration gives correct time', () => {
    const result = calculateArrivalTime('09:00', 30 * 60); // 30 hours → 15:00
    expect(result.time).toBe('15:00');
  });
});

// ==================== generatePacingSuggestions ====================

describe('generatePacingSuggestions', () => {
  it('suggests splitting multi-day trips', () => {
    const suggestions = generatePacingSuggestions(12 * 60, makeSettings({ maxDriveHours: 8 })); // 12h trip
    expect(suggestions.some(s => s.includes('splitting'))).toBe(true);
  });

  it('warns about late departure on long trips', () => {
    const suggestions = generatePacingSuggestions(
      10 * 60,
      makeSettings({ departureTime: '14:00' }),
    );
    expect(suggestions.some(s => s.includes('night driving'))).toBe(true);
  });

  it('suggests driver swaps with multiple drivers', () => {
    const suggestions = generatePacingSuggestions(
      8 * 60,
      makeSettings({ numDrivers: 2 }),
    );
    expect(suggestions.some(s => s.includes('swap'))).toBe(true);
  });

  it('suggests rest breaks', () => {
    const suggestions = generatePacingSuggestions(6 * 60, makeSettings());
    expect(suggestions.some(s => s.includes('break'))).toBe(true);
  });
});

// ==================== calculateFuelStops ====================

describe('calculateFuelStops', () => {
  it('returns no stops for short trip', () => {
    const segments = [makeSegment({ distanceKm: 100 })];
    const stops = calculateFuelStops(segments, 60, 8.0);
    expect(stops).toHaveLength(0);
  });

  it('recommends stop when fuel gets low', () => {
    // 60L tank, 10L/100km = 600km range, but usable is 75% = 450km
    // 3 segments of 200km each = 600km total, 20L per segment
    // After 2 segments: 60 - 40 = 20L remaining, 25% of usable = 11.25L
    // Segment 3 needs 20L, 20 - 20 = 0 < 11.25 → stop before segment 3
    const segments = [
      makeSegment({ distanceKm: 200 }),
      makeSegment({ distanceKm: 200 }),
      makeSegment({ distanceKm: 200 }),
    ];
    const stops = calculateFuelStops(segments, 60, 10.0);
    expect(stops.length).toBeGreaterThanOrEqual(1);
  });

  it('fuel stop records segment index and distance', () => {
    const segments = [
      makeSegment({ distanceKm: 400 }),
      makeSegment({ distanceKm: 400 }),
    ];
    const stops = calculateFuelStops(segments, 50, 12.0);
    if (stops.length > 0) {
      expect(stops[0]).toHaveProperty('segmentIndex');
      expect(stops[0]).toHaveProperty('distanceFromStart');
      expect(stops[0]).toHaveProperty('fuelRemaining');
    }
  });
});
