/**
 * trip-strategy-selector.ts — unit tests (the file's first; it sat at 0% because
 * useTripCalculation.test.ts mocks buildStrategyUpdate, so its body never ran under test).
 *
 * ⭐ THE CONTRACT: a strategy swap produces the same trip the FIRST calculation would have built for
 * that route. The first calculation is the reference, so every round-trip assertion here compares
 * against `buildRoundTripSegments` (what orchestrate-trip calls) rather than a hard-coded clock time.
 *
 * ⚠️ The bug these pin (ticket-strategy-swap-day-trip, proven by ZeeRah's 2026-09-21 line-check):
 * the swap carried its OWN copy of the round-trip mirroring, which had drifted — it dropped the
 * day-trip dwell, so a same-day Winnipeg → Gimli trip came home the NEXT MORNING after any swap,
 * and its geometry covered only the outbound leg.
 */

import { describe, it, expect } from 'vitest';
import { buildStrategyUpdate } from './trip-strategy-selector';
import { buildRoundTripSegments } from './trip-calculation-helpers';
import { calculateTripCosts } from './calculations';
import { orchestrateStrategySwap } from './trip-orchestrator/orchestrate-strategy-swap';
import type { RouteStrategy, RouteSegment, TripSettings } from '../types';
import { makeLocation, makeSegment, makeSettings, makeSummary, makeVehicle } from '../test/fixtures';

const WPG = { ...makeLocation('Winnipeg', 49.895, -97.138), type: 'origin' as const };
const GIMLI = { ...makeLocation('Gimli', 50.633, -96.99), type: 'destination' as const };

const OUTBOUND: RouteSegment[] = [
  makeSegment({ from: WPG, to: GIMLI, distanceKm: 95, durationMinutes: 75, fuelNeededLitres: 8, fuelCost: 12 }),
];
const GEOMETRY: [number, number][] = [[49.895, -97.138], [50.2, -97.05], [50.633, -96.99]];

const STRATEGY: RouteStrategy = {
  id: 'fastest', label: 'Fastest', emoji: '⚡',
  distanceKm: 95, durationMinutes: 75, geometry: GEOMETRY, segments: OUTBOUND,
};

const VEHICLE = makeVehicle();

/** A same-day round trip: depart 09:00, three hours at Gimli, home the same afternoon. */
const DAY_TRIP = makeSettings({
  isRoundTrip: true, departureDate: '2025-08-16', departureTime: '09:00',
  returnDate: '', dayTripDurationHours: 3, maxDriveHours: 8,
});

/** What the first calculation builds for the same route + settings — the reference. */
function firstCalc(settings: TripSettings) {
  const summary = calculateTripCosts(OUTBOUND, VEHICLE, settings);
  summary.fullGeometry = GEOMETRY;
  const rt = buildRoundTripSegments(summary.segments, summary, settings, VEHICLE);
  return { segments: rt.segments, summary };
}

const returnLeg = (segs: RouteSegment[]) => segs[segs.length - 1];
const localDate = (iso?: string) => (iso ? new Date(iso).toDateString() : '');

describe('buildStrategyUpdate — a same-day round trip (the Gimli day trip)', () => {
  const swapped = buildStrategyUpdate(STRATEGY, makeSummary(), VEHICLE, DAY_TRIP);
  const reference = firstCalc(DAY_TRIP);

  it('comes home the SAME day it left', () => {
    const outDep = swapped.segments[0].departureTime;
    const backDep = returnLeg(swapped.segments).departureTime;
    expect(backDep).toBeDefined();
    expect(localDate(backDep)).toBe(localDate(outDep));
  });

  it('leaves Gimli exactly when the first calculation says it would', () => {
    expect(returnLeg(swapped.segments).departureTime)
      .toBe(returnLeg(reference.segments).departureTime);
    expect(returnLeg(swapped.segments).arrivalTime)
      .toBe(returnLeg(reference.segments).arrivalTime);
  });

  it('draws BOTH legs on the map, not only the outbound one', () => {
    expect(swapped.fullGeometry).toEqual(reference.summary.fullGeometry);
    expect(swapped.fullGeometry).toHaveLength(GEOMETRY.length * 2 - 1);
  });

  it('counts its driving days fresh instead of inheriting the old summary\'s', () => {
    const stale = makeSummary({ drivingDays: 99 });
    const result = buildStrategyUpdate(STRATEGY, stale, VEHICLE, DAY_TRIP);
    const expected = (result.days ?? []).filter(d => d.dayType !== 'free').length;
    expect(result.drivingDays).toBe(expected);
    expect(result.drivingDays).not.toBe(99);
  });

  it('"Per Person" is the whole trip split by travellers, as the summary card says it is', () => {
    // TripSummary.tsx renders costPerPerson under "Per Person" with "N people · $total total"
    // beneath it. The swap used to divide FUEL only, so the card contradicted itself after a swap.
    const total = swapped.costBreakdown?.total ?? 0;
    expect(total).toBeGreaterThan(0);
    expect(swapped.costPerPerson).toBeCloseTo(total / DAY_TRIP.numTravelers, 6);
  });

  it('totals both legs', () => {
    expect(swapped.totalDistanceKm).toBe(190);
    expect(swapped.totalDurationMinutes).toBe(150);
  });
});

describe('downstream — the timeline the ghost car rides on', () => {
  // The hook hands the swapped summary straight to orchestrateStrategySwap, which rebuilds the
  // canonical timeline the itinerary and ghost car read. The ticket could only INFER the damage
  // there; this runs the real pipeline and checks it.
  //
  // ⚠️ HONEST LABEL: this passes on the OLD code too. The timeline builder derives its own day-trip
  // dwell (getRoundTripDayTripStayMinutes), so the ghost car never went home the next morning — the
  // ticket's inferred consequence did not happen. The real damage was in the SUMMARY (segment times,
  // the map's fullGeometry, drivingDays, per-person), which the tests above pin. This one stays as a
  // guard on the timeline path, not as proof of the fix.
  it('a swapped day trip is still ONE day, ending back home the same day', () => {
    const swapped = buildStrategyUpdate(STRATEGY, makeSummary(), VEHICLE, DAY_TRIP);
    const { canonicalTimeline } = orchestrateStrategySwap(
      swapped, DAY_TRIP, VEHICLE, [WPG, GIMLI], swapped.roundTripMidpoint,
    );
    expect(canonicalTimeline.days).toHaveLength(1);
    const events = canonicalTimeline.events;
    const first = events[0].departureTime;
    const last = events[events.length - 1].arrivalTime;
    expect(last.toDateString()).toBe(first.toDateString());
    expect(last.getTime() - first.getTime()).toBeLessThan(8 * 60 * 60 * 1000);   // 2.5h driving + 3h dwell
  });
});

describe('buildStrategyUpdate — an overnight round trip is unchanged', () => {
  // A return on a LATER date is not a day trip: no dwell, and the return resets to the next morning.
  const OVERNIGHT = makeSettings({
    isRoundTrip: true, departureDate: '2025-08-16', departureTime: '09:00',
    returnDate: '2025-08-17', dayTripDurationHours: 3, maxDriveHours: 8,
  });

  it('still returns the next morning, matching the first calculation', () => {
    const swapped = buildStrategyUpdate(STRATEGY, makeSummary(), VEHICLE, OVERNIGHT);
    const reference = firstCalc(OVERNIGHT);
    const backDep = returnLeg(swapped.segments).departureTime;
    expect(backDep).toBe(returnLeg(reference.segments).departureTime);
    expect(localDate(backDep)).not.toBe(localDate(swapped.segments[0].departureTime));
  });
});

describe('buildStrategyUpdate — one-way', () => {
  const ONE_WAY = makeSettings({ isRoundTrip: false, departureDate: '2025-08-16', departureTime: '09:00' });

  it('uses the strategy\'s own geometry and segments, with no mirrored return', () => {
    const result = buildStrategyUpdate(STRATEGY, makeSummary(), VEHICLE, ONE_WAY);
    expect(result.fullGeometry).toEqual(GEOMETRY);
    expect(result.segments).toHaveLength(1);
    expect(result.totalDistanceKm).toBe(95);
  });

  it('stamps departure and arrival times, as the first calculation always does', () => {
    const result = buildStrategyUpdate(STRATEGY, makeSummary(), VEHICLE, ONE_WAY);
    expect(result.segments[0].departureTime).toBeDefined();
    expect(result.segments[0].arrivalTime).toBeDefined();
  });

  it('keeps the parts of the old summary a route swap does not touch', () => {
    const base = makeSummary({ drivingDays: 1 });
    const result = buildStrategyUpdate(STRATEGY, base, VEHICLE, ONE_WAY);
    expect(result.segments[0].to.name).toBe('Gimli');
    expect(result).not.toBe(base);                 // a new object — never mutates the old summary
  });
});
