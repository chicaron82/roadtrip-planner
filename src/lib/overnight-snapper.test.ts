import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TripDay } from '../types';
import { snapOvernightsToTowns } from './overnight-snapper';

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
      gasRemaining: 0,
      hotelRemaining: 0,
      foodRemaining: 0,
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
});