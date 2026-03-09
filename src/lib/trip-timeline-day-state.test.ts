import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProcessedSegment, RouteSegment, TripDay, TripSettings } from '../types';
import type { TimedEvent } from './trip-timeline-types';
import {
  applyDayBoundary,
  buildDrivingDayMetadata,
  buildTimelineIterationPlan,
  advanceOvernightClock,
} from './trip-timeline-day-state';

const mocks = vi.hoisted(() => ({
  findPreferredHubInWindow: vi.fn(),
}));

vi.mock('./hub-cache', () => ({
  findPreferredHubInWindow: mocks.findPreferredHubInWindow,
}));

function makeDay(overrides: Partial<TripDay> = {}): TripDay {
  return {
    dayNumber: 2,
    date: '2026-08-04',
    dateFormatted: 'Tue, Aug 4',
    route: 'Toronto → Ottawa',
    segments: [],
    segmentIndices: [1],
    timezoneChanges: [],
    budget: {
      gasUsed: 0,
      hotelCost: 0,
      foodEstimate: 0,
      miscCost: 0,
      dayTotal: 0,
      bankRemaining: 1000,
    },
    totals: {
      distanceKm: 0,
      driveTimeMinutes: 0,
      stopTimeMinutes: 0,
      departureTime: '2026-08-04T12:00:00.000Z',
      arrivalTime: '2026-08-04T18:00:00.000Z',
    },
    ...overrides,
  };
}

function makeSettings(): TripSettings {
  return {
    units: 'metric',
    currency: 'CAD',
    maxDriveHours: 8,
    numTravelers: 2,
    numDrivers: 1,
    budgetMode: 'open',
    budget: {
      mode: 'open',
      allocation: 'fixed',
      profile: 'balanced',
      weights: { gas: 25, hotel: 25, food: 25, misc: 25 },
      gas: 0,
      hotel: 0,
      food: 0,
      misc: 0,
      total: 0,
    },
    departureDate: '2026-08-03',
    departureTime: '08:00',
    returnDate: '2026-08-05',
    arrivalDate: '2026-08-04',
    arrivalTime: '18:00',
    useArrivalTime: false,
    gasPrice: 1.6,
    hotelPricePerNight: 150,
    mealPricePerDay: 40,
    isRoundTrip: false,
    avoidTolls: false,
    avoidBorders: false,
    scenicMode: false,
    routePreference: 'fastest',
    stopFrequency: 'balanced',
    tripPreferences: [],
    targetArrivalHour: 21,
    dayTripDurationHours: 0,
  };
}

describe('applyDayBoundary', () => {
  beforeEach(() => {
    mocks.findPreferredHubInWindow.mockReset();
  });

  it('prefers the exact segment start city over a nearby better-scoring hub', () => {
    mocks.findPreferredHubInWindow.mockReturnValue({ name: 'Hamilton, ON' });

    const iterSegments: ProcessedSegment[] = [
      {
        from: { id: 'tor', name: 'Toronto, ON', lat: 43.6532, lng: -79.3832, type: 'waypoint' },
        to: { id: 'ott', name: 'Ottawa, ON', lat: 45.4215, lng: -75.6972, type: 'waypoint' },
        distanceKm: 450,
        durationMinutes: 270,
        fuelNeededLitres: 30,
        fuelCost: 40,
        _originalIndex: 1,
      },
    ];

    const result = applyDayBoundary({
      newDay: makeDay(),
      currentTime: new Date('2026-08-04T12:00:00.000Z'),
      cumulativeKm: 600,
      activeTimezone: 'America/Toronto',
      tripDays: [makeDay({ dayNumber: 1, date: '2026-08-03' }), makeDay()],
      suggestions: [],
      events: [] as TimedEvent[],
      iterSegments,
      segmentIndex: 0,
      settings: makeSettings(),
      drivingDayDepartures: new Map<string, string>(),
    });

    expect(result.departureEvent.locationHint).toBe('Toronto, ON');
  });
});

// ─── Segment fixture ──────────────────────────────────────────────────────────

function makeSegment(overrides: Partial<RouteSegment> = {}): RouteSegment {
  return {
    from: { id: 'a', name: 'Toronto, ON', lat: 43.65, lng: -79.38, type: 'waypoint' },
    to: { id: 'b', name: 'Ottawa, ON', lat: 45.42, lng: -75.70, type: 'waypoint' },
    distanceKm: 450,
    durationMinutes: 270,
    fuelNeededLitres: 30,
    fuelCost: 40,
    ...overrides,
  };
}

// ─── buildDrivingDayMetadata ──────────────────────────────────────────────────

describe('buildDrivingDayMetadata', () => {
  it('returns empty arrays/maps when given no tripDays', () => {
    const result = buildDrivingDayMetadata(undefined);
    expect(result.drivingDayDates).toHaveLength(0);
    expect(result.drivingDayDepartures.size).toBe(0);
  });

  it('collects dates only for days that have segments', () => {
    const days: TripDay[] = [
      makeDay({ dayNumber: 1, date: '2026-08-16', segmentIndices: [0] }),
      makeDay({ dayNumber: 2, date: '2026-08-17', segmentIndices: [] }),   // free day
      makeDay({ dayNumber: 3, date: '2026-08-18', segmentIndices: [1] }),
    ];
    const result = buildDrivingDayMetadata(days);
    expect(result.drivingDayDates).toEqual(['2026-08-16', '2026-08-18']);
  });

  it('maps departure times only for driving days that have a departureTime', () => {
    const days: TripDay[] = [
      makeDay({
        dayNumber: 1, date: '2026-08-16', segmentIndices: [0],
        totals: { ...makeDay().totals, departureTime: '2026-08-16T09:00:00.000Z' },
      }),
      makeDay({
        dayNumber: 2, date: '2026-08-17', segmentIndices: [1],
        totals: { ...makeDay().totals, departureTime: '' },
      }),
    ];
    const result = buildDrivingDayMetadata(days);
    expect(result.drivingDayDepartures.get('2026-08-16')).toBe('2026-08-16T09:00:00.000Z');
    expect(result.drivingDayDepartures.has('2026-08-17')).toBe(false);
  });
});

// ─── buildTimelineIterationPlan ───────────────────────────────────────────────

describe('buildTimelineIterationPlan', () => {
  it('returns raw segments with _originalIndex when no tripDays provided', () => {
    const segs = [makeSegment(), makeSegment({ from: { id: 'b', name: 'Ottawa', lat: 45.42, lng: -75.70, type: 'waypoint' } })];
    const result = buildTimelineIterationPlan(segs, undefined);

    expect(result.useDayFiltering).toBe(false);
    expect(result.iterSegments).toHaveLength(2);
    expect(result.iterSegments[0]._originalIndex).toBe(0);
    expect(result.iterSegments[1]._originalIndex).toBe(1);
    expect(result.currentDayNumber).toBe(1);
  });

  it('uses day segments and enables day filtering when tripDays are populated', () => {
    const seg1 = { ...makeSegment(), _originalIndex: 0 } as ProcessedSegment;
    const seg2 = { ...makeSegment(), _originalIndex: 1 } as ProcessedSegment;
    const days: TripDay[] = [
      makeDay({ dayNumber: 1, date: '2026-08-16', segmentIndices: [0], segments: [seg1] }),
      makeDay({ dayNumber: 2, date: '2026-08-17', segmentIndices: [1], segments: [seg2] }),
    ];

    const result = buildTimelineIterationPlan([makeSegment()], days);

    expect(result.useDayFiltering).toBe(true);
    expect(result.iterSegments).toHaveLength(2);
    expect(result.currentDayNumber).toBe(1);
  });

  it('builds dayStartMap with day 2 starting at flat index = length of day 1 segments', () => {
    const seg1a = { ...makeSegment(), _originalIndex: 0 } as ProcessedSegment;
    const seg1b = { ...makeSegment(), _originalIndex: 1 } as ProcessedSegment;
    const seg2 = { ...makeSegment(), _originalIndex: 2 } as ProcessedSegment;
    const day2 = makeDay({ dayNumber: 2, date: '2026-08-17', segmentIndices: [2], segments: [seg2] });
    const days: TripDay[] = [
      makeDay({ dayNumber: 1, date: '2026-08-16', segmentIndices: [0, 1], segments: [seg1a, seg1b] }),
      day2,
    ];

    const result = buildTimelineIterationPlan([makeSegment()], days);

    // Day 2 starts at flat index 2 (after the 2 segments of day 1)
    expect(result.dayStartMap.get(2)).toBe(day2);
    expect(result.dayStartMap.has(0)).toBe(false); // Day 1 never appears in dayStartMap
  });

  it('falls back to raw segments when all driving days have empty segments arrays', () => {
    const days: TripDay[] = [
      makeDay({ segmentIndices: [0], segments: [] }),
    ];
    const rawSegs = [makeSegment()];
    const result = buildTimelineIterationPlan(rawSegs, days);

    expect(result.useDayFiltering).toBe(false);
    expect(result.iterSegments).toHaveLength(1);
  });
});

// ─── advanceOvernightClock ────────────────────────────────────────────────────

describe('advanceOvernightClock', () => {
  it('advances exactly one day when no drivingDayDates are provided', () => {
    const arrival = new Date('2026-08-16T22:00:00Z');
    const result = advanceOvernightClock(
      arrival, 'UTC', makeSettings(), [], new Map(),
    );

    // Should land on 2026-08-17 at settings.departureTime (08:00)
    const resultDateStr = result.toISOString().slice(0, 10);
    expect(resultDateStr).toBe('2026-08-17');
  });

  it('advances to the next driving date when drivingDayDates has a future date', () => {
    const arrival = new Date('2026-08-16T22:00:00Z');
    const result = advanceOvernightClock(
      arrival, 'UTC', makeSettings(), ['2026-08-17', '2026-08-18'], new Map(),
    );

    expect(result.toISOString().slice(0, 10)).toBe('2026-08-17');
  });

  it('skips free days — jumps to the correct next driving date when there is a gap', () => {
    // Arrival on Aug 16, free days Aug 17+18, next drive day Aug 19
    const arrival = new Date('2026-08-16T22:00:00Z');
    const result = advanceOvernightClock(
      arrival, 'UTC', makeSettings(), ['2026-08-19'], new Map(),
    );

    expect(result.toISOString().slice(0, 10)).toBe('2026-08-19');
  });

  it('returns the exact planned departure time when drivingDayDepartures has an entry', () => {
    const arrival = new Date('2026-08-16T22:00:00Z');
    const departures = new Map([['2026-08-17', '2026-08-17T10:30:00.000Z']]);
    const result = advanceOvernightClock(
      arrival, 'UTC', makeSettings(), ['2026-08-17'], departures,
    );

    expect(result.toISOString()).toBe('2026-08-17T10:30:00.000Z');
  });
});