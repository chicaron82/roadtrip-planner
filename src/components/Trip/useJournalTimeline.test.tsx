import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TripJournal, TripSettings, TripSummary } from '../../types';
import { useJournalTimeline } from './useJournalTimeline';

const SUMMARY: TripSummary = {
  totalDistanceKm: 700,
  totalDurationMinutes: 480,
  totalFuelLitres: 63,
  totalFuelCost: 97,
  gasStops: 0,
  costPerPerson: 49,
  drivingDays: 1,
  segments: [
    {
      from: { id: 'from', name: 'Winnipeg', lat: 49.895, lng: -97.138, type: 'origin' },
      to: { id: 'to', name: 'Thunder Bay', lat: 48.382, lng: -89.246, type: 'destination' },
      distanceKm: 700,
      durationMinutes: 480,
      fuelNeededLitres: 63,
      fuelCost: 97,
    },
  ],
  fullGeometry: [],
};

const SETTINGS: TripSettings = {
  units: 'metric',
  currency: 'CAD',
  maxDriveHours: 8,
  numTravelers: 2,
  numDrivers: 1,
  budgetMode: 'open',
  budget: { mode: 'open', allocation: 'flexible', profile: 'balanced', weights: { gas: 25, hotel: 35, food: 25, misc: 15 }, gas: 0, hotel: 0, food: 0, misc: 0, total: 0 },
  departureDate: '2026-08-01',
  departureTime: '08:00',
  returnDate: '2026-08-02',
  arrivalDate: '2026-08-02',
  arrivalTime: '18:00',
  useArrivalTime: false,
  gasPrice: 1.6,
  hotelPricePerNight: 120,
  mealPricePerDay: 50,
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

const JOURNAL: TripJournal = {
  id: 'journal-1',
  version: '1.0',
  tripSummary: SUMMARY,
  settings: SETTINGS,
  vehicle: {
    year: '2022', make: 'Toyota', model: 'Corolla', fuelEconomyCity: 8, fuelEconomyHwy: 6.5, tankSize: 50,
  },
  entries: [],
  quickCaptures: [],
  dayMeta: [],
  budgetActuals: [],
  metadata: {
    title: 'Test Trip',
    tags: [],
    dates: { plannedStart: '2026-08-01', plannedEnd: '2026-08-02' },
  },
  sharing: { privacy: 'private', isPublic: false, includePhotos: true, includeBudget: true, includeNotes: true },
  sync: { status: 'synced', lastSynced: null, pendingChanges: 0 },
  stats: { photosCount: 0, highlightsCount: 0, stopsVisited: 0, stopsSkipped: 0, totalActualSpent: 0, budgetVariance: 0 },
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
};

describe('useJournalTimeline', () => {
  it('formats the start node in the origin timezone', () => {
    const { result } = renderHook(() => useJournalTimeline({
      summary: SUMMARY,
      settings: SETTINGS,
      journal: JOURNAL,
      onUpdateJournal: vi.fn(),
    }));

    expect(result.current.originTimezone).toBe('America/Winnipeg');
    expect(result.current.formatTime(result.current.startTime, result.current.originTimezone)).toBe('8:00 AM');
    expect(result.current.formatDate(result.current.startTime, result.current.originTimezone)).toBe('Sat, Aug 1');
  });
});