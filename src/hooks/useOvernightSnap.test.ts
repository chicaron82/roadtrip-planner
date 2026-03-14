/**
 * useOvernightSnap.ts — unit tests
 *
 * checkAndSetOvernightPrompt: pure-ish (takes callbacks) — no mocks needed.
 * fireAndForgetOvernightPostProcessing: mocks snapOvernightsToTowns,
 *   validateIntentOvernights, and applySnappedOvernightsToCanonicalTimeline
 *   to stay focused on the orchestration logic inside this module.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TripDay, TripSummary, TripSettings } from '../types';
import type { CanonicalTripTimeline } from '../lib/canonical-trip';
import { makeSettings as _makeSettings, makeBudget } from '../test/fixtures';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../lib/overnight-snapper', () => ({
  snapOvernightsToTowns: vi.fn(),
  validateIntentOvernights: vi.fn(),
}));

vi.mock('../lib/trip-calculation-helpers', () => ({
  applySnappedOvernightsToCanonicalTimeline: vi.fn((ct) => ct),
  shouldPropagateSnappedOvernightToNextDay: vi.fn(() => false),
}));

import {
  checkAndSetOvernightPrompt,
  fireAndForgetOvernightPostProcessing,
} from './useOvernightSnap';
import { snapOvernightsToTowns, validateIntentOvernights } from '../lib/overnight-snapper';
import {
  applySnappedOvernightsToCanonicalTimeline,
  shouldPropagateSnappedOvernightToNextDay,
} from '../lib/trip-calculation-helpers';

const mockSnap     = vi.mocked(snapOvernightsToTowns);
const mockValidate = vi.mocked(validateIntentOvernights);
const mockApply    = vi.mocked(applySnappedOvernightsToCanonicalTimeline);
const mockShouldPropagate = vi.mocked(shouldPropagateSnappedOvernightToNextDay);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeSettings = (overrides: Partial<TripSettings> = {}) => _makeSettings({
  numTravelers: 2, numDrivers: 1,
  budget: makeBudget({ gas: 0, hotel: 0, food: 0, misc: 0, total: 0 }),
  departureDate: '2026-08-16', returnDate: '', arrivalDate: '', arrivalTime: '',
  ...overrides,
});

const LOC_WPG = { id: 'wpg', name: 'Winnipeg',    lat: 49.895, lng: -97.138, type: 'origin'      as const };
const LOC_KNR = { id: 'knr', name: 'Kenora',      lat: 49.766, lng: -94.487, type: 'waypoint'    as const };
const LOC_TB  = { id: 'tb',  name: 'Thunder Bay', lat: 48.381, lng: -89.247, type: 'destination' as const };

/** Minimal AcceptedItineraryRouteSummary + Pick<TripSummary, …> */
function makeTripSummary(overrides: {
  totalDurationMinutes?: number;
  totalDistanceKm?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  segments?: Array<{ distanceKm: number; to: any }>;
} = {}) {
  return {
    totalDurationMinutes: overrides.totalDurationMinutes ?? 600,  // 10h
    totalDistanceKm:      overrides.totalDistanceKm      ?? 700,
    segments: overrides.segments ?? [
      { distanceKm: 350, to: LOC_KNR },
      { distanceKm: 350, to: LOC_TB  },
    ],
  };
}

function makeOvernight(location: typeof LOC_WPG | typeof LOC_KNR | typeof LOC_TB) {
  // OvernightStop has no 'source' field; cost and roomsNeeded are required.
  return { location: { ...location, type: 'waypoint' as const }, cost: 0, roomsNeeded: 1 };
}

function makeDay(dayNumber: number, overrides: Partial<TripDay> = {}): TripDay {
  return {
    dayNumber,
    date: '2026-08-16',
    dateFormatted: 'Sat, Aug 16',
    route: `${LOC_WPG.name} → ${LOC_TB.name}`,
    segments: [
      { from: LOC_WPG, to: LOC_TB, distanceKm: 700, durationMinutes: 360,
        fuelCost: 120, fuelLitres: 60, region: 'MB', _originalIndex: 0, _transitPart: false } as unknown as TripDay['segments'][number],
    ],
    segmentIndices: [0],
    timezoneChanges: [],
    budget: { fuel: 120, accommodation: 0, meals: 0, misc: 0, total: 120, perPerson: 60 },
    totals: { distanceKm: 700, driveTimeMinutes: 360, stopTimeMinutes: 0,
      departureTime: '2026-08-16T09:00:00', arrivalTime: '2026-08-16T15:00:00' },
    ...overrides,
  } as TripDay;
}

function makeFullSummary(days: TripDay[]): TripSummary {
  return {
    totalDistanceKm: 700, totalDurationMinutes: 600,
    totalFuelLitres: 60, totalFuelCost: 120,
    gasStops: 1, costPerPerson: 100, drivingDays: 1,
    segments: [], fullGeometry: [],
    days,
  };
}

// ─── checkAndSetOvernightPrompt ───────────────────────────────────────────────

describe('checkAndSetOvernightPrompt', () => {
  it('does not prompt when trip is within maxDriveHours', () => {
    const setSuggested = vi.fn();
    const setShow      = vi.fn();
    const summary      = makeTripSummary({ totalDurationMinutes: 480 }); // 8h < 10h max

    checkAndSetOvernightPrompt(summary as never, [makeDay(1)], makeSettings(), setSuggested, setShow);

    expect(setShow).toHaveBeenCalledWith(false);
    expect(setSuggested).not.toHaveBeenCalled();
  });

  it('does not prompt when already split into multiple days', () => {
    const setSuggested = vi.fn();
    const setShow      = vi.fn();
    const summary      = makeTripSummary({ totalDurationMinutes: 720 }); // 12h > 10h

    checkAndSetOvernightPrompt(summary as never, [makeDay(1), makeDay(2)], makeSettings(), setSuggested, setShow);

    expect(setShow).toHaveBeenCalledWith(false);
    expect(setSuggested).not.toHaveBeenCalled();
  });

  it('prompts when drive exceeds maxDriveHours and still single-day', () => {
    const setSuggested = vi.fn();
    const setShow      = vi.fn();
    const summary      = makeTripSummary({ totalDurationMinutes: 720, totalDistanceKm: 700 }); // 12h

    checkAndSetOvernightPrompt(summary as never, [makeDay(1)], makeSettings(), setSuggested, setShow);

    expect(setShow).toHaveBeenCalledWith(true);
    expect(setSuggested).toHaveBeenCalledOnce();
  });

  it('picks the segment that first crosses the 50% distance mark', () => {
    const setSuggested = vi.fn();
    const summary = makeTripSummary({
      totalDurationMinutes: 720,
      totalDistanceKm: 700,
      segments: [
        { distanceKm: 100, to: LOC_WPG },  // cumulative 100 — below 350
        { distanceKm: 300, to: LOC_KNR },  // cumulative 400 — crosses 350
        { distanceKm: 300, to: LOC_TB  },
      ],
    });

    checkAndSetOvernightPrompt(summary as never, [makeDay(1)], makeSettings(), setSuggested, vi.fn());

    // Should be the Kenora segment (crosses 350km mark)
    expect(setSuggested).toHaveBeenCalledWith(expect.objectContaining({ name: 'Kenora' }));
  });

  it('does not prompt if no segment crosses the 50% distance threshold', () => {
    // Edge: all segments together are shorter than 50% (shouldn't happen in practice, but guard it)
    const setSuggested = vi.fn();
    const setShow      = vi.fn();
    const summary = makeTripSummary({
      totalDurationMinutes: 720,
      totalDistanceKm: 1000,  // 50% = 500km
      segments: [{ distanceKm: 100, to: LOC_KNR }], // only 100km total
    });

    checkAndSetOvernightPrompt(summary as never, [makeDay(1)], makeSettings(), setSuggested, setShow);

    // No segment crosses 500km threshold — neither callback fires (no overnight found, stays silent)
    expect(setSuggested).not.toHaveBeenCalled();
    expect(setShow).not.toHaveBeenCalled();
  });
});

// ─── fireAndForgetOvernightPostProcessing ────────────────────────────────────

describe('fireAndForgetOvernightPostProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSnap.mockResolvedValue([]);
    mockValidate.mockResolvedValue([]);
    mockShouldPropagate.mockReturnValue(false);
    mockApply.mockImplementation((ct) => ct as CanonicalTripTimeline);
  });

  it('does not call setSummary when both snap and validate return empty', async () => {
    const setSummary         = vi.fn();
    const setCanonicalTimeline = vi.fn();
    const day = makeDay(1);
    const summary = makeFullSummary([day]);

    fireAndForgetOvernightPostProcessing([day], summary, null, new AbortController(), setSummary, setCanonicalTimeline);

    await vi.waitFor(() => expect(mockSnap).toHaveBeenCalledOnce());
    expect(setSummary).not.toHaveBeenCalled();
    expect(setCanonicalTimeline).not.toHaveBeenCalled();
  });

  it('calls setSummary when a snap result is returned', async () => {
    const snapResult = { dayNumber: 1, lat: 49.766, lng: -94.487, name: 'Kenora' };
    mockSnap.mockResolvedValue([snapResult]);

    const setSummary           = vi.fn();
    const setCanonicalTimeline = vi.fn();

    const day = makeDay(1, { overnight: makeOvernight(LOC_KNR) });
    const summary = makeFullSummary([day]);

    fireAndForgetOvernightPostProcessing([day], summary, null, new AbortController(), setSummary, setCanonicalTimeline);

    await vi.waitFor(() => expect(setSummary).toHaveBeenCalledOnce());

    const updatedSummary = setSummary.mock.calls[0][0] as TripSummary;
    expect(updatedSummary.days![0].overnight?.location.name).toBe('Kenora');
  });

  it('calls setSummary when a validation warning is returned', async () => {
    const warn = { dayNumber: 1, message: 'No hotels near this stop' };
    mockValidate.mockResolvedValue([warn]);

    const setSummary = vi.fn();
    const day = makeDay(1, { overnight: makeOvernight(LOC_KNR) });
    const summary = makeFullSummary([day]);

    fireAndForgetOvernightPostProcessing([day], summary, null, new AbortController(), setSummary, vi.fn());

    await vi.waitFor(() => expect(setSummary).toHaveBeenCalledOnce());

    const updatedSummary = setSummary.mock.calls[0][0] as TripSummary;
    expect(updatedSummary.days![0].overnight?.accommodationWarning?.message).toBe('No hotels near this stop');
  });

  it('does not call setCanonicalTimeline when canonicalTimeline is null', async () => {
    const snapResult = { dayNumber: 1, lat: 49.766, lng: -94.487, name: 'Kenora' };
    mockSnap.mockResolvedValue([snapResult]);

    const setCanonicalTimeline = vi.fn();
    const day = makeDay(1, { overnight: makeOvernight(LOC_KNR) });
    const summary = makeFullSummary([day]);

    fireAndForgetOvernightPostProcessing([day], summary, null, new AbortController(), vi.fn(), setCanonicalTimeline);

    await vi.waitFor(() => expect(mockSnap).toHaveBeenCalledOnce());
    // Even with snap results, no canonical timeline to update
    expect(setCanonicalTimeline).not.toHaveBeenCalled();
  });

  it('calls setCanonicalTimeline when canonicalTimeline is provided and snap has results', async () => {
    const snapResult = { dayNumber: 1, lat: 49.766, lng: -94.487, name: 'Kenora' };
    mockSnap.mockResolvedValue([snapResult]);
    const fakeTimeline = { days: [] } as unknown as CanonicalTripTimeline;
    mockApply.mockReturnValue(fakeTimeline);

    const setCanonicalTimeline = vi.fn();
    const day = makeDay(1, { overnight: makeOvernight(LOC_KNR) });
    const summary = makeFullSummary([day]);

    fireAndForgetOvernightPostProcessing([day], summary, fakeTimeline, new AbortController(), vi.fn(), setCanonicalTimeline);

    await vi.waitFor(() => expect(setCanonicalTimeline).toHaveBeenCalledOnce());
    expect(mockApply).toHaveBeenCalledWith(fakeTimeline, expect.anything(), [snapResult]);
  });

  it('skips processing when the signal is already aborted before Promise.all resolves', async () => {
    const controller = new AbortController();
    mockSnap.mockImplementation(() => {
      controller.abort();
      return Promise.resolve([{ dayNumber: 1, lat: 49.766, lng: -94.487, name: 'Kenora' }]);
    });

    const setSummary = vi.fn();
    const day = makeDay(1, { overnight: makeOvernight(LOC_KNR) });
    const summary = makeFullSummary([day]);

    fireAndForgetOvernightPostProcessing([day], summary, null, controller, setSummary, vi.fn());

    await vi.waitFor(() => expect(mockSnap).toHaveBeenCalledOnce());
    expect(setSummary).not.toHaveBeenCalled();
  });

  it('silently swallows errors from snap/validate (does not reject)', async () => {
    mockSnap.mockRejectedValue(new Error('Overpass down'));
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const setSummary = vi.fn();
    const day = makeDay(1);

    // Should not throw
    fireAndForgetOvernightPostProcessing([day], makeFullSummary([day]), null, new AbortController(), setSummary, vi.fn());

    await vi.waitFor(() => expect(consoleSpy).toHaveBeenCalledOnce());
    expect(setSummary).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('snaps update both the overnight location and the route label', async () => {
    const snapResult = { dayNumber: 1, lat: 49.766, lng: -94.487, name: 'Kenora' };
    mockSnap.mockResolvedValue([snapResult]);

    const setSummary = vi.fn();
    const day = makeDay(1, {
      route: 'Winnipeg → Thunder Bay',
      overnight: makeOvernight(LOC_TB),
    });
    const summary = makeFullSummary([day]);

    fireAndForgetOvernightPostProcessing([day], summary, null, new AbortController(), setSummary, vi.fn());

    await vi.waitFor(() => expect(setSummary).toHaveBeenCalledOnce());

    const updatedDay = (setSummary.mock.calls[0][0] as TripSummary).days![0];
    expect(updatedDay.route).toMatch(/Kenora/);
    expect(updatedDay.overnight?.location.name).toBe('Kenora');
  });

  it('propagates snapped coords to next day when shouldPropagate returns true', async () => {
    mockShouldPropagate.mockReturnValue(true);
    const snapResult = { dayNumber: 1, lat: 49.766, lng: -94.487, name: 'Kenora' };
    mockSnap.mockResolvedValue([snapResult]);

    const setSummary = vi.fn();
    const day1 = makeDay(1, { overnight: makeOvernight(LOC_KNR) });
    const day2 = makeDay(2, { route: 'Thunder Bay → Sault Ste. Marie' });
    const summary = makeFullSummary([day1, day2]);

    fireAndForgetOvernightPostProcessing([day1, day2], summary, null, new AbortController(), setSummary, vi.fn());

    await vi.waitFor(() => expect(setSummary).toHaveBeenCalledOnce());

    const updatedDays = (setSummary.mock.calls[0][0] as TripSummary).days!;
    // Day 2's first segment FROM should now be Kenora
    expect(updatedDays[1].segments[0].from.name).toBe('Kenora');
    expect(updatedDays[1].route).toMatch(/Kenora/);
  });
});
