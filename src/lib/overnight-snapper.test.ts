import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TripDay } from '../types';
import { snapOvernightsToTowns, validateIntentOvernights } from './overnight-snapper';

const mocks = vi.hoisted(() => ({
  executeOverpassQuery: vi.fn(),
  findPreferredHubInWindow: vi.fn(),
  cacheDiscoveredHub: vi.fn(),
  reverseGeocodeTown: vi.fn(),
}));

vi.mock('./poi-service/overpass', () => ({
  executeOverpassQuery: mocks.executeOverpassQuery,
}));

vi.mock('./hub-cache', () => ({
  findPreferredHubInWindow: mocks.findPreferredHubInWindow,
  cacheDiscoveredHub: mocks.cacheDiscoveredHub,
}));

vi.mock('./route-geocoder', () => ({
  reverseGeocodeTown: mocks.reverseGeocodeTown,
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

describe('snapOvernightsToTowns', () => {
  beforeEach(() => {
    mocks.executeOverpassQuery.mockReset();
    mocks.findPreferredHubInWindow.mockReset();
    mocks.cacheDiscoveredHub.mockReset();
    mocks.reverseGeocodeTown.mockReset();
  });

  it('returns empty array when no transit-split days exist', async () => {
    const normalDay: TripDay = {
      ...makeTransitDay(),
      overnight: {
        ...makeTransitDay().overnight!,
        location: { ...makeTransitDay().overnight!.location, id: 'user-stop-1' },
      },
    };
    const result = await snapOvernightsToTowns([normalDay], new AbortController().signal);
    expect(result).toEqual([]);
    expect(mocks.executeOverpassQuery).not.toHaveBeenCalled();
  });

  it('returns empty array for empty days input', async () => {
    const result = await snapOvernightsToTowns([], new AbortController().signal);
    expect(result).toEqual([]);
  });

  it('prefers a nearby known hub over an awkward border-adjacent settlement', async () => {
    mocks.findPreferredHubInWindow.mockReturnValue({
      name: 'El Paso, TX',
      lat: 31.7619,
      lng: -106.485,
      radius: 40,
      poiCount: 20,
      discoveredAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      source: 'seed',
    });
    mocks.executeOverpassQuery.mockResolvedValue([
      {
        lat: 31.7,
        lon: -106.3,
        tags: { place: 'town', name: 'Praxedis G. Guerrero' },
      },
    ]);

    const result = await snapOvernightsToTowns([makeTransitDay()], new AbortController().signal);

    expect(result).toEqual([
      {
        dayNumber: 5,
        lat: 31.7619,
        lng: -106.485,
        name: 'El Paso, TX',
      },
    ]);
  });

  it('scores cities higher than villages at similar distance', async () => {
    mocks.findPreferredHubInWindow.mockReturnValue(null);
    mocks.executeOverpassQuery.mockResolvedValue([
      { lat: 31.74, lon: -106.36, tags: { place: 'village', name: 'Tiny Village' } },
      { lat: 31.75, lon: -106.37, tags: { place: 'city', name: 'Big City' } },
    ]);

    const result = await snapOvernightsToTowns([makeTransitDay()], new AbortController().signal);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Big City');
  });

  it('skips elements with unknown place types (hamlet excluded)', async () => {
    mocks.findPreferredHubInWindow.mockReturnValue(null);
    mocks.executeOverpassQuery.mockResolvedValue([
      { lat: 31.74, lon: -106.36, tags: { place: 'hamlet', name: 'Tiny Hamlet' } },
    ]);
    mocks.reverseGeocodeTown.mockResolvedValue('Fallback City');

    const result = await snapOvernightsToTowns([makeTransitDay()], new AbortController().signal);

    // Hamlet skipped → fallback geocoder used
    expect(result[0].name).toBe('Fallback City');
  });

  it('appends province to name when addr:province tag exists', async () => {
    mocks.findPreferredHubInWindow.mockReturnValue(null);
    mocks.executeOverpassQuery.mockResolvedValue([
      { lat: 31.74, lon: -106.36, tags: { place: 'town', name: 'Kenora', 'addr:province': 'ON' } },
    ]);

    const result = await snapOvernightsToTowns([makeTransitDay()], new AbortController().signal);

    expect(result[0].name).toBe('Kenora, ON');
  });

  it('caches discovered settlements', async () => {
    mocks.findPreferredHubInWindow.mockReturnValue(null);
    mocks.executeOverpassQuery.mockResolvedValue([
      { lat: 31.74, lon: -106.36, tags: { place: 'town', name: 'New Town' } },
    ]);

    await snapOvernightsToTowns([makeTransitDay()], new AbortController().signal);

    expect(mocks.cacheDiscoveredHub).toHaveBeenCalledOnce();
    expect(mocks.cacheDiscoveredHub).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Town', source: 'discovered' }),
    );
  });

  it('falls back to reverse geocoding when no hub or Overpass settlement is found', async () => {
    mocks.findPreferredHubInWindow.mockReturnValue(null);
    mocks.executeOverpassQuery.mockResolvedValue([]);
    mocks.reverseGeocodeTown.mockResolvedValue('Lake Charles, LA');

    const result = await snapOvernightsToTowns([makeTransitDay()], new AbortController().signal);

    expect(result).toEqual([
      {
        dayNumber: 5,
        lat: 31.74,
        lng: -106.36,
        name: 'Lake Charles, LA',
      },
    ]);
    expect(mocks.cacheDiscoveredHub).toHaveBeenCalled();
  });

  it('returns empty when reverse geocoding also fails', async () => {
    mocks.findPreferredHubInWindow.mockReturnValue(null);
    mocks.executeOverpassQuery.mockResolvedValue([]);
    mocks.reverseGeocodeTown.mockResolvedValue(null);

    const result = await snapOvernightsToTowns([makeTransitDay()], new AbortController().signal);
    expect(result).toEqual([]);
  });
});

// ── validateIntentOvernights ──────────────────────────────────────────────────

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