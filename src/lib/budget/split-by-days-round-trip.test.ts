/**
 * split-by-days-round-trip.test.ts
 *
 * Tests for maybeInsertRoundTripMidpointDays — the submodule that
 * places destination stay (free) days and kicks off the return leg.
 *
 * Key concern: the off-by-one on calendar days (Jul 1→Jul 5 = 5 days, not 4).
 * This is where the estimate bug from the shopping cart session lived.
 *
 * 💚 My Experience Engine
 */

import { describe, it, expect } from 'vitest';
import { maybeInsertRoundTripMidpointDays } from './split-by-days-round-trip';
import { createEmptyDay } from './day-builder';
import type { ProcessedSegment } from '../../types';
import type { TripSettings, Location, TripDay } from '../../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const WINNIPEG: Location = { id: 'wpg', name: 'Winnipeg', lat: 49.8951, lng: -97.1384, type: 'origin' };
const THUNDER_BAY: Location = { id: 'tb', name: 'Thunder Bay', lat: 48.38, lng: -89.25, type: 'destination' };

const makeSegment = (from: Location, to: Location, minutes: number, origIdx: number): ProcessedSegment => ({
  from, to,
  distanceKm: (minutes / 60) * 90,
  durationMinutes: minutes,
  fuelNeededLitres: 10,
  fuelCost: 15,
  _originalIndex: origIdx,
});

function makeSettings(departureDate: string, returnDate: string): TripSettings {
  return {
    units: 'metric',
    currency: 'CAD',
    maxDriveHours: 8,
    numTravelers: 2,
    numDrivers: 1,
    gasPrice: 1.65,
    hotelPricePerNight: 140,
    mealPricePerDay: 50,
    budgetMode: 'open',
    budget: { mode: 'open', allocation: 'flexible', profile: 'balanced', weights: { gas: 25, hotel: 35, food: 30, misc: 10 }, gas: 0, hotel: 0, food: 0, misc: 0, total: 0 },
    departureDate,
    departureTime: '09:00',
    returnDate,
    arrivalDate: '',
    arrivalTime: '',
    isRoundTrip: true,
  } as TripSettings;
}

/** Builds a minimal finished outbound day (the day to be finalized at the midpoint). */
function makeOutboundDay(departureDate: string): TripDay {
  const date = new Date(departureDate + 'T09:00:00');
  const day = createEmptyDay(1, date);
  // Add a stub segment so finalizeTripDay has something to work with
  day.segments = [makeSegment(WINNIPEG, THUNDER_BAY, 400, 0)] as TripDay['segments'];
  return day;
}

const OUTBOUND_SEG = makeSegment(WINNIPEG, THUNDER_BAY, 400, 0); // ~6.7h
const RETURN_SEG   = makeSegment(THUNDER_BAY, WINNIPEG, 400, 1);
const MAX_DRIVE_MINUTES = 8 * 60; // 480

function baseParams(settings: TripSettings, outboundDay: TripDay) {
  // days starts empty — outboundDay is currentDay (in-progress), not yet finalized.
  // maybeInsertRoundTripMidpointDays will finalize and push it internally.
  const days: TripDay[] = [];
  const arrivalDate = new Date(settings.departureDate + 'T16:40:00'); // after 400min drive
  return {
    processedSegments: [OUTBOUND_SEG, RETURN_SEG],
    segmentIndex: 1,
    roundTripMidpoint: 1,
    originalSegments: [OUTBOUND_SEG, RETURN_SEG] as never,
    settings,
    maxDriveMinutes: MAX_DRIVE_MINUTES,
    effectiveMaxDriveMinutes: MAX_DRIVE_MINUTES,
    fuelStops: [],
    days,
    currentDay: outboundDay,
    currentDayDriveMinutes: 400,
    currentDate: arrivalDate,
    dayNumber: 1,
    insertedFreeDays: false,
    budget: { bankRemaining: 1000 },
  };
}

// ── Off-by-one: calendar days vs nights ──────────────────────────────────────

describe('calendar day counting', () => {
  it('Jul 1 → Jul 5 produces 5 calendar days (not 4 nights)', () => {
    const settings = makeSettings('2026-07-01', '2026-07-05');
    // totalTripDays should be 5 (Jul 1, 2, 3, 4, 5)
    // outboundDays=1, returnDays=1, freeDays=3
    const outboundDay = makeOutboundDay('2026-07-01');
    const params = baseParams(settings, outboundDay);
    const result = maybeInsertRoundTripMidpointDays(params);

    // 3 free days should have been inserted (days array had 1 outbound, now has 1 + 3 = 4)
    expect(params.days.filter(d => d.dayType === 'free')).toHaveLength(3);
    expect(result.insertedFreeDays).toBe(true);
  });

  it('Jul 1 → Jul 3 produces 3 calendar days (1 outbound + 1 free + 1 return)', () => {
    const settings = makeSettings('2026-07-01', '2026-07-03');
    // totalTripDays = 3, outbound=1, return=1, free=1
    const outboundDay = makeOutboundDay('2026-07-01');
    const params = baseParams(settings, outboundDay);
    maybeInsertRoundTripMidpointDays(params);

    expect(params.days.filter(d => d.dayType === 'free')).toHaveLength(1);
  });
});

// ── 0 stay days ───────────────────────────────────────────────────────────────

describe('round trip with 0 stay days', () => {
  it('drives straight back — no free days inserted', () => {
    const settings = makeSettings('2026-07-01', '2026-07-02');
    // totalTripDays = 2, outbound=1, return=1, free=0
    const outboundDay = makeOutboundDay('2026-07-01');
    const params = baseParams(settings, outboundDay);
    maybeInsertRoundTripMidpointDays(params);

    expect(params.days.filter(d => d.dayType === 'free')).toHaveLength(0);
  });

  it('still returns insertedFreeDays=true (function ran)', () => {
    const settings = makeSettings('2026-07-01', '2026-07-02');
    const outboundDay = makeOutboundDay('2026-07-01');
    const params = baseParams(settings, outboundDay);
    const result = maybeInsertRoundTripMidpointDays(params);

    expect(result.insertedFreeDays).toBe(true);
  });

  it('creates return leg day', () => {
    const settings = makeSettings('2026-07-01', '2026-07-02');
    const outboundDay = makeOutboundDay('2026-07-01');
    const params = baseParams(settings, outboundDay);
    const result = maybeInsertRoundTripMidpointDays(params);

    expect(result.currentDay).not.toBeNull();
    expect(result.currentDayDriveMinutes).toBe(0);
  });
});

// ── 3 destination stay days ───────────────────────────────────────────────────

describe('round trip with 3 destination stay days', () => {
  it('inserts exactly 3 free days at destination', () => {
    const settings = makeSettings('2026-07-01', '2026-07-05');
    const outboundDay = makeOutboundDay('2026-07-01');
    const params = baseParams(settings, outboundDay);
    maybeInsertRoundTripMidpointDays(params);

    const freeDays = params.days.filter(d => d.dayType === 'free');
    expect(freeDays).toHaveLength(3);
  });

  it('free days are labelled with day number at destination', () => {
    const settings = makeSettings('2026-07-01', '2026-07-05');
    const outboundDay = makeOutboundDay('2026-07-01');
    const params = baseParams(settings, outboundDay);
    maybeInsertRoundTripMidpointDays(params);

    const freeDays = params.days.filter(d => d.dayType === 'free');
    expect(freeDays[0].title).toMatch(/Day 1 at/i);
    expect(freeDays[1].title).toMatch(/Day 2 at/i);
    expect(freeDays[2].title).toMatch(/Day 3 at/i);
  });

  it('return leg currentDay is created after free days', () => {
    const settings = makeSettings('2026-07-01', '2026-07-05');
    const outboundDay = makeOutboundDay('2026-07-01');
    const params = baseParams(settings, outboundDay);
    const result = maybeInsertRoundTripMidpointDays(params);

    expect(result.currentDay).not.toBeNull();
    expect(result.currentDayDriveMinutes).toBe(0);
  });
});

// ── Guard conditions ──────────────────────────────────────────────────────────

describe('guard conditions', () => {
  it('no-op when insertedFreeDays is already true', () => {
    const settings = makeSettings('2026-07-01', '2026-07-05');
    const outboundDay = makeOutboundDay('2026-07-01');
    const params = { ...baseParams(settings, outboundDay), insertedFreeDays: true };
    const result = maybeInsertRoundTripMidpointDays(params);

    expect(result.insertedFreeDays).toBe(true);
    expect(params.days.filter(d => d.dayType === 'free')).toHaveLength(0);
  });

  it('no-op when roundTripMidpoint is undefined', () => {
    const settings = makeSettings('2026-07-01', '2026-07-05');
    const outboundDay = makeOutboundDay('2026-07-01');
    const params = { ...baseParams(settings, outboundDay), roundTripMidpoint: undefined };
    const result = maybeInsertRoundTripMidpointDays(params);

    expect(result.insertedFreeDays).toBe(false);
  });

  it('no-op when segmentIndex does not match roundTripMidpoint', () => {
    const settings = makeSettings('2026-07-01', '2026-07-05');
    const outboundDay = makeOutboundDay('2026-07-01');
    const params = { ...baseParams(settings, outboundDay), segmentIndex: 0 };
    const result = maybeInsertRoundTripMidpointDays(params);

    expect(result.insertedFreeDays).toBe(false);
  });
});
