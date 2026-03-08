import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProcessedSegment, TripDay, TripSettings } from '../types';
import type { TimedEvent } from './trip-timeline-types';
import { applyDayBoundary } from './trip-timeline-day-state';

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
      gasRemaining: 0,
      hotelRemaining: 0,
      foodRemaining: 0,
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