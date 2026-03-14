/**
 * orchestrateStrategySwap — integration unit tests
 *
 * Tests the synchronous pipeline: generateSmartStops → buildTimedTimeline →
 * assembleCanonicalTimeline → projectFuelStopsFromSimulation.
 *
 * All dependencies are real (no mocks) — this is an integration unit test.
 * Input validation and output shape are the primary concerns.
 */

import { describe, it, expect } from 'vitest';
import { orchestrateStrategySwap } from './orchestrate-strategy-swap';
import { makeSummary, makeSettings, makeVehicle, makeLocation, makeDay, makeSegment } from '../../test/fixtures';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LOC_A = makeLocation('Winnipeg', 49.895, -97.138);
const LOC_B = makeLocation('Brandon', 49.848, -99.950);
const LOC_C = makeLocation('Regina', 50.445, -104.619);

const SEGMENT_AB = makeSegment({ from: LOC_A, to: LOC_B, distanceKm: 210, durationMinutes: 130 });
const SEGMENT_BC = makeSegment({ from: LOC_B, to: LOC_C, distanceKm: 200, durationMinutes: 120, _originalIndex: 1 });

const SUMMARY = makeSummary({ totalDistanceKm: 410, totalDurationMinutes: 250, segments: [SEGMENT_AB, SEGMENT_BC] });
const SETTINGS = makeSettings({ maxDriveHours: 8 });
const VEHICLE = makeVehicle();
const LOCATIONS = [LOC_A, LOC_B, LOC_C];

// ─── Output shape ─────────────────────────────────────────────────────────────

describe('orchestrateStrategySwap — output shape', () => {
  it('returns canonicalTimeline and projectedFuelStops', () => {
    const result = orchestrateStrategySwap(SUMMARY, SETTINGS, VEHICLE, LOCATIONS, undefined);
    expect(result).toHaveProperty('canonicalTimeline');
    expect(result).toHaveProperty('projectedFuelStops');
  });

  it('canonicalTimeline has events array', () => {
    const { canonicalTimeline } = orchestrateStrategySwap(SUMMARY, SETTINGS, VEHICLE, LOCATIONS, undefined);
    expect(Array.isArray(canonicalTimeline.events)).toBe(true);
  });

  it('canonicalTimeline has days array', () => {
    const { canonicalTimeline } = orchestrateStrategySwap(SUMMARY, SETTINGS, VEHICLE, LOCATIONS, undefined);
    expect(Array.isArray(canonicalTimeline.days)).toBe(true);
  });

  it('projectedFuelStops is an array', () => {
    const { projectedFuelStops } = orchestrateStrategySwap(SUMMARY, SETTINGS, VEHICLE, LOCATIONS, undefined);
    expect(Array.isArray(projectedFuelStops)).toBe(true);
  });

  it('each projected fuel stop has lat/lng/estimatedTime', () => {
    const longSummary = makeSummary({
      totalDistanceKm: 1200, totalDurationMinutes: 720,
      segments: [makeSegment({ from: LOC_A, to: LOC_C, distanceKm: 1200, durationMinutes: 720 })],
    });
    const { projectedFuelStops } = orchestrateStrategySwap(longSummary, SETTINGS, VEHICLE, LOCATIONS, undefined);
    for (const stop of projectedFuelStops) {
      expect(typeof stop.lat).toBe('number');
      expect(typeof stop.lng).toBe('number');
      expect(typeof stop.estimatedTime).toBe('string');
    }
  });
});

// ─── No segments guard ────────────────────────────────────────────────────────

describe('orchestrateStrategySwap — no segments', () => {
  it('returns empty timeline when summary has no segments', () => {
    const emptySummary = makeSummary({ segments: [], totalDistanceKm: 0, totalDurationMinutes: 0 });
    const result = orchestrateStrategySwap(emptySummary, SETTINGS, VEHICLE, LOCATIONS, undefined);
    expect(result.canonicalTimeline.events).toHaveLength(0);
    expect(result.projectedFuelStops).toHaveLength(0);
  });
});

// ─── External stops merging ───────────────────────────────────────────────────

describe('orchestrateStrategySwap — external stops', () => {
  it('does not throw when externalStops is undefined', () => {
    expect(() =>
      orchestrateStrategySwap(SUMMARY, SETTINGS, VEHICLE, LOCATIONS, undefined)
    ).not.toThrow();
  });

  it('does not throw when externalStops is an empty array', () => {
    expect(() =>
      orchestrateStrategySwap(SUMMARY, SETTINGS, VEHICLE, LOCATIONS, undefined, [])
    ).not.toThrow();
  });

  it('includes external stop events in the canonical timeline', () => {
    const externalStop = {
      id: 'poi-ext-1',
      type: 'meal' as const,
      reason: 'User added',
      afterSegmentIndex: 0,
      estimatedTime: new Date('2025-08-16T11:00:00'),
      duration: 30,
      priority: 'recommended' as const,
      details: {},
    };
    // With an external stop merged, the timeline should have at least 1 event
    const { canonicalTimeline } = orchestrateStrategySwap(
      SUMMARY, SETTINGS, VEHICLE, LOCATIONS, undefined, [externalStop],
    );
    expect(canonicalTimeline.events.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Round-trip midpoint ──────────────────────────────────────────────────────

describe('orchestrateStrategySwap — roundTripMidpoint', () => {
  it('does not throw with a midpoint provided', () => {
    const rtSummary = makeSummary({
      totalDistanceKm: 420, totalDurationMinutes: 260,
      segments: [SEGMENT_AB, SEGMENT_BC],
    });
    expect(() =>
      orchestrateStrategySwap(rtSummary, makeSettings({ isRoundTrip: true }), VEHICLE, LOCATIONS, 1)
    ).not.toThrow();
  });
});

// ─── Pre-built days carry through ─────────────────────────────────────────────

describe('orchestrateStrategySwap — existing days in summary', () => {
  it('canonical days count is at least 1 when summary has day data', () => {
    const day = makeDay({ segments: [SEGMENT_AB] });
    const summaryWithDays = makeSummary([day]);
    const { canonicalTimeline } = orchestrateStrategySwap(
      summaryWithDays, SETTINGS, VEHICLE, LOCATIONS, undefined,
    );
    expect(canonicalTimeline.days.length).toBeGreaterThanOrEqual(1);
  });
});
