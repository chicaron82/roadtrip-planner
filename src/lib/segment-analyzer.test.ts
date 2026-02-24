/**
 * Tests for segment-analyzer.ts
 *
 * Covers segment warnings, border detection, timezone detection,
 * pacing suggestions.
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeSegments,
  generatePacingSuggestions,
} from './segment-analyzer';
import type { RouteSegment, Location, TripSettings, SegmentWarning } from '../types';

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
    returnDate: '',
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
    targetArrivalHour: 21,
    dayTripDurationHours: 0,
    ...overrides,
  };
}

// ==================== analyzeSegments ====================

describe('analyzeSegments', () => {
  it('adds critical warning for 6+ hour drives', () => {
    const segments = [makeSegment({ durationMinutes: 400 })]; // ~6.7h
    const result = analyzeSegments(segments);
    const warnings: SegmentWarning[] = result[0].warnings ?? [];
    expect(warnings.some(w => w.severity === 'critical' && w.type === 'long_drive')).toBe(true);
  });

  it('adds warning for 4-6 hour drives', () => {
    const segments = [makeSegment({ durationMinutes: 270 })]; // 4.5h
    const result = analyzeSegments(segments);
    const warnings: SegmentWarning[] = result[0].warnings ?? [];
    expect(warnings.some(w => w.severity === 'warning' && w.type === 'long_drive')).toBe(true);
  });

  it('no drive warning for short segments', () => {
    const segments = [makeSegment({ durationMinutes: 90 })]; // 1.5h
    const result = analyzeSegments(segments);
    const warnings: SegmentWarning[] = result[0].warnings ?? [];
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
    const warnings: SegmentWarning[] = result[0].warnings ?? [];
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
    const warnings: SegmentWarning[] = result[0].warnings ?? [];
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
