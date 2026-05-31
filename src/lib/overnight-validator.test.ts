import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TripDay } from '../types';
import { validateIntentOvernights } from './overnight-validator';

const mocks = vi.hoisted(() => ({
  executeOverpassQuery: vi.fn(),
}));

vi.mock('./poi-service/overpass', () => ({
  executeOverpassQuery: mocks.executeOverpassQuery,
}));

function makeTransitDay(): TripDay {
  return {
    dayNumber: 5,
    date: '2026-08-05',
    dateFormatted: 'Wed, Aug 5',
    route: 'Las Cruces → El Paso',
    segments: [],
    segmentIndices: [],
    overnight: {
      location: {
        id: 'transit-split-5',
        name: 'Transit Split',
        lat: 31.74,
        lng: -106.36,
        type: 'waypoint',
      },
      cost: 120,
      roomsNeeded: 1,
    },
    timezoneChanges: [],
    budget: {
      gasUsed: 0,
      hotelCost: 120,
      foodEstimate: 0,
      miscCost: 0,
      dayTotal: 120,
      bankRemaining: 1000,
    },
    totals: {
      distanceKm: 650,
      driveTimeMinutes: 480,
      stopTimeMinutes: 0,
      departureTime: '2026-08-05T08:00:00',
      arrivalTime: '2026-08-05T17:00:00',
    },
  };
}

function makeIntentDay(overrides: Partial<TripDay> = {}): TripDay {
  return {
    ...makeTransitDay(),
    overnight: {
      location: {
        id: 'user-pin-1',
        name: 'Remote Spot, MB',
        lat: 50.5,
        lng: -95.0,
        type: 'waypoint',
        intent: { overnight: true },
      },
      cost: 100,
      roomsNeeded: 1,
    },
    ...overrides,
  } as TripDay;
}

describe('validateIntentOvernights', () => {
  beforeEach(() => {
    mocks.executeOverpassQuery.mockReset();
  });

  it('returns empty array when no intent-overnight days exist', async () => {
    const result = await validateIntentOvernights([makeTransitDay()], new AbortController().signal);
    expect(result).toEqual([]);
    expect(mocks.executeOverpassQuery).not.toHaveBeenCalled();
  });

  it('returns empty array for empty input', async () => {
    const result = await validateIntentOvernights([], new AbortController().signal);
    expect(result).toEqual([]);
  });

  it('returns no warning when hotels are found near the pin', async () => {
    mocks.executeOverpassQuery.mockResolvedValue([
      { lat: 50.5, lon: -95.0, tags: { tourism: 'hotel', name: 'Friendly Inn' } },
    ]);

    const result = await validateIntentOvernights([makeIntentDay()], new AbortController().signal);
    expect(result).toEqual([]);
  });

  it('returns a warning when no hotels found within radius', async () => {
    mocks.executeOverpassQuery.mockResolvedValue([
      // Only a town, no accommodation
      { lat: 50.8, lon: -94.5, tags: { place: 'town', name: 'Nearest Town' } },
    ]);

    const result = await validateIntentOvernights([makeIntentDay()], new AbortController().signal);
    expect(result).toHaveLength(1);
    expect(result[0].dayNumber).toBe(5);
    expect(result[0].message).toContain('No accommodation');
    expect(result[0].suggested?.name).toBe('Nearest Town');
  });

  it('suggests nearest town with rounded distance when no hotels', async () => {
    mocks.executeOverpassQuery.mockResolvedValue([
      { lat: 50.9, lon: -94.0, tags: { place: 'city', name: 'Big City' } },
      { lat: 50.6, lon: -94.8, tags: { place: 'village', name: 'Near Village' } },
    ]);

    const result = await validateIntentOvernights([makeIntentDay()], new AbortController().signal);
    expect(result).toHaveLength(1);
    // Near Village is closer, so should be suggested
    expect(result[0].suggested?.name).toBe('Near Village');
    expect(Number.isInteger(result[0].suggested?.distanceKm)).toBe(true);
  });

  it('returns warning with no suggestion when no towns found either', async () => {
    mocks.executeOverpassQuery.mockResolvedValue([]);

    const result = await validateIntentOvernights([makeIntentDay()], new AbortController().signal);
    expect(result).toHaveLength(1);
    expect(result[0].suggested).toBeUndefined();
  });
});
