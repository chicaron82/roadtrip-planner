/**
 * Tests for trip-analyzer.ts
 *
 * Covers difficulty scoring, route confidence, and overview generation.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTripDifficulty,
  calculateRouteConfidence,
  generateTripOverview,
} from './trip-analyzer';
import { makeSegment, makeSummary, makeSettings } from '../test/fixtures';

// ==================== TESTS ====================

describe('calculateTripDifficulty', () => {
  it('returns easy for a short, simple trip', () => {
    const result = calculateTripDifficulty(
      makeSummary({ totalDistanceKm: 200, totalDurationMinutes: 120 }),
      makeSettings(),
    );
    expect(result.level).toBe('easy');
    expect(result.score).toBeLessThan(20);
    expect(result.color).toBe('green');
    expect(result.emoji).toBe('🟢');
  });

  it('increases score for long distances', () => {
    const result = calculateTripDifficulty(
      makeSummary({ totalDistanceKm: 2500 }),
      makeSettings(),
    );
    expect(result.score).toBeGreaterThanOrEqual(25);
    expect(result.factors).toContainEqual(expect.stringContaining('2000km'));
  });

  it('increases score for long drive time', () => {
    const result = calculateTripDifficulty(
      makeSummary({ totalDurationMinutes: 25 * 60 }),
      makeSettings(),
    );
    expect(result.factors).toContainEqual(expect.stringContaining('>20h'));
  });

  it('adds multi-day factor', () => {
    // 16 hours / 8 max = 2 days needed
    const result = calculateTripDifficulty(
      makeSummary({ totalDurationMinutes: 16 * 60 }),
      makeSettings({ maxDriveHours: 8 }),
    );
    expect(result.factors).toContainEqual(expect.stringContaining('Multi-day'));
  });

  it('detects critical warnings', () => {
    const segment = makeSegment({
      warnings: [
        { type: 'long_drive', severity: 'critical', message: 'Very long segment' },
      ],
    });
    const result = calculateTripDifficulty(
      makeSummary({ segments: [segment] }),
      makeSettings(),
    );
    expect(result.factors).toContainEqual(expect.stringContaining('critical'));
  });

  it('detects border crossings', () => {
    const segment = makeSegment({
      warnings: [
        { type: 'border_crossing', severity: 'info', message: 'Border' },
      ],
    });
    const result = calculateTripDifficulty(
      makeSummary({ segments: [segment] }),
      makeSettings(),
    );
    expect(result.factors).toContainEqual(expect.stringContaining('border'));
  });

  it('detects timezone crossings', () => {
    const segment = makeSegment({ timezoneCrossing: true });
    const result = calculateTripDifficulty(
      makeSummary({ segments: [segment] }),
      makeSettings(),
    );
    expect(result.factors).toContainEqual(expect.stringContaining('timezone'));
  });

  it('classifies extreme difficulty above 70', () => {
    // Stack enough factors: >2000km + >20h + >3 days + critical warnings
    const segment = makeSegment({
      warnings: [{ type: 'long_drive', severity: 'critical', message: 'test' }],
      timezoneCrossing: true,
    });
    const result = calculateTripDifficulty(
      makeSummary({
        totalDistanceKm: 3000,
        totalDurationMinutes: 30 * 60,
        segments: [segment],
      }),
      makeSettings({ maxDriveHours: 8 }),
    );
    expect(result.level).toBe('extreme');
    expect(result.color).toBe('red');
  });
});

describe('calculateRouteConfidence', () => {
  it('starts at high confidence for simple route', () => {
    const result = calculateRouteConfidence(makeSummary(), makeSettings());
    expect(result.score).toBeGreaterThanOrEqual(85);
  });

  it('deducts for many waypoints', () => {
    const segments = Array.from({ length: 6 }, () => makeSegment());
    const result = calculateRouteConfidence(
      makeSummary({ segments }),
      makeSettings(),
    );
    expect(result.score).toBeLessThan(100);
    expect(result.factors).toContainEqual(expect.stringContaining('waypoints'));
  });

  it('deducts for missing weather data', () => {
    const segments = [
      makeSegment({ weather: undefined }),
      makeSegment({ weather: undefined }),
    ];
    const result = calculateRouteConfidence(
      makeSummary({ segments }),
      makeSettings(),
    );
    expect(result.factors).toContainEqual(expect.stringContaining('weather'));
  });

  it('deducts for very long routes', () => {
    const result = calculateRouteConfidence(
      makeSummary({ totalDistanceKm: 2500 }),
      makeSettings(),
    );
    expect(result.factors).toContainEqual(expect.stringContaining('long routes'));
  });

  it('adds bonus for round trips', () => {
    // Use a demanding route so baseline doesn't max out at 100 before the bonus
    const demandingSummary = makeSummary({ totalDistanceKm: 1800, totalDurationMinutes: 900 });
    const baseline = calculateRouteConfidence(demandingSummary, makeSettings({ isRoundTrip: false }));
    const roundTrip = calculateRouteConfidence(demandingSummary, makeSettings({ isRoundTrip: true }));
    expect(roundTrip.score).toBeGreaterThan(baseline.score);
  });

  it('never drops below 60', () => {
    const segments = Array.from({ length: 10 }, () =>
      makeSegment({ weather: undefined }),
    );
    const result = calculateRouteConfidence(
      makeSummary({ totalDistanceKm: 5000, segments }),
      makeSettings(),
    );
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it('labels scores correctly', () => {
    // High confidence → Excellent or Very Good
    const high = calculateRouteConfidence(makeSummary(), makeSettings({ isRoundTrip: true }));
    expect(['Excellent', 'Very Good']).toContain(high.label);
  });
});

describe('generateTripOverview', () => {
  it('returns difficulty, confidence, and highlights', () => {
    const result = generateTripOverview(makeSummary(), makeSettings());
    expect(result.difficulty).toBeDefined();
    expect(result.confidence).toBeDefined();
    expect(result.highlights).toBeInstanceOf(Array);
  });

  it('includes driving hours in highlights', () => {
    const result = generateTripOverview(
      makeSummary({ totalDurationMinutes: 360 }),
      makeSettings(),
    );
    expect(result.highlights).toContainEqual(expect.stringContaining('hours'));
  });

  it('includes gas stops in highlights', () => {
    const result = generateTripOverview(
      makeSummary({ gasStops: 3 }),
      makeSettings(),
    );
    expect(result.highlights).toContainEqual(expect.stringContaining('gas stop'));
  });

  it('includes multi-day note in highlights', () => {
    const result = generateTripOverview(
      makeSummary({ totalDurationMinutes: 20 * 60 }),
      makeSettings({ maxDriveHours: 8 }),
    );
    expect(result.highlights).toContainEqual(expect.stringContaining('days'));
  });

  it('includes border crossing in highlights', () => {
    const segment = makeSegment({
      warnings: [
        { type: 'border_crossing', severity: 'info', message: 'Border' },
      ],
    });
    const result = generateTripOverview(
      makeSummary({ segments: [segment] }),
      makeSettings(),
    );
    expect(result.highlights).toContainEqual(expect.stringContaining('border'));
  });
});
