import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getUserProfile,
  recordTrip,
  getAdaptiveDefaults,
  isAdaptiveMeaningful,
  _clearProfileCache,
  ADAPTIVE_CONFIDENCE_THRESHOLD,
  CHICHARON_BASELINE,
  type TripRecord,
  type UserProfile,
} from './user-profile';
import type { TripSettings, TripBudget } from '../types';

// Override the global localStorage mock with a real in-memory implementation
// (the global setup uses vi.fn() no-ops which don't actually store data)
const localStorageStore: Record<string, string> = {};
const realLocalStorage = {
  getItem: (key: string) => localStorageStore[key] ?? null,
  setItem: (key: string, value: string) => { localStorageStore[key] = value; },
  removeItem: (key: string) => { delete localStorageStore[key]; },
  clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); },
  get length() { return Object.keys(localStorageStore).length; },
  key: (i: number) => Object.keys(localStorageStore)[i] ?? null,
};
Object.defineProperty(window, 'localStorage', { value: realLocalStorage, writable: true });

// --- Test Helpers ---

const makeSettings = (overrides: Partial<TripSettings> = {}): TripSettings => ({
  units: 'metric',
  currency: 'CAD',
  maxDriveHours: 8,
  numTravelers: 2,
  numDrivers: 1,
  budgetMode: 'open',
  budget: {
    mode: 'open',
    allocation: 'flexible',
    profile: 'balanced',
    weights: { gas: 30, hotel: 35, food: 25, misc: 10 },
    gas: 200,
    hotel: 300,
    food: 150,
    misc: 50,
    total: 700,
  } as TripBudget,
  departureDate: '2025-07-01',
  departureTime: '08:00',
  returnDate: '2025-07-05',
  arrivalDate: '2025-07-05',
  arrivalTime: '18:00',
  useArrivalTime: false,
  gasPrice: 1.65,
  hotelPricePerNight: 150,
  mealPricePerDay: 50,
  isRoundTrip: false,
  avoidTolls: false,
  avoidBorders: false,
  scenicMode: false,
  routePreference: 'fastest',
  stopFrequency: 'balanced',
  tripPreferences: [],
  targetArrivalHour: 21,
  ...overrides,
});

const makeRecord = (overrides: Partial<TripRecord> = {}): TripRecord => ({
  date: Date.now(),
  tripLengthDays: 4,
  budgetProfile: 'balanced',
  hotelPricePerNight: 150,
  mealPricePerDay: 50,
  numTravelers: 2,
  hadGasBuffer: true,
  ...overrides,
});

// Seed profile with N trips via localStorage directly (bypasses recordTrip for test isolation)
const seedProfile = (trips: TripRecord[]): void => {
  const profile: UserProfile = { version: 1, trips };
  localStorage.setItem('roadtrip_user_profile', JSON.stringify(profile));
  _clearProfileCache();
};

// --- Tests ---

describe('getUserProfile', () => {
  beforeEach(() => {
    localStorage.clear();
    _clearProfileCache();
  });

  it('returns empty profile when nothing in storage', () => {
    const profile = getUserProfile();
    expect(profile.trips).toEqual([]);
    expect(profile.version).toBe(1);
  });

  it('returns parsed profile from localStorage', () => {
    const trips = [makeRecord(), makeRecord()];
    seedProfile(trips);
    const result = getUserProfile();
    expect(result.trips).toHaveLength(2);
  });

  it('returns empty profile on corrupted localStorage data', () => {
    localStorage.setItem('roadtrip_user_profile', 'not-json{{{');
    _clearProfileCache();
    const profile = getUserProfile();
    expect(profile.trips).toEqual([]);
  });

  it('returns empty profile when version mismatches', () => {
    const bad = { version: 99, trips: [makeRecord()] };
    localStorage.setItem('roadtrip_user_profile', JSON.stringify(bad));
    _clearProfileCache();
    const profile = getUserProfile();
    expect(profile.trips).toEqual([]);
  });

  it('uses in-memory cache on second call (no re-parse)', () => {
    seedProfile([makeRecord()]);
    getUserProfile(); // warm the cache
    const spy = vi.spyOn(JSON, 'parse');
    getUserProfile(); // second call — must use in-memory cache, no JSON.parse
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('recordTrip', () => {
  beforeEach(() => {
    localStorage.clear();
    _clearProfileCache();
  });

  it('adds a TripRecord after calling recordTrip', () => {
    recordTrip(makeSettings());
    _clearProfileCache();
    const profile = getUserProfile();
    expect(profile.trips).toHaveLength(1);
  });

  it('captures hotelPricePerNight from settings', () => {
    recordTrip(makeSettings({ hotelPricePerNight: 200 }));
    _clearProfileCache();
    expect(getUserProfile().trips[0].hotelPricePerNight).toBe(200);
  });

  it('captures mealPricePerDay from settings', () => {
    recordTrip(makeSettings({ mealPricePerDay: 80 }));
    _clearProfileCache();
    expect(getUserProfile().trips[0].mealPricePerDay).toBe(80);
  });

  it('captures budgetProfile from settings.budget.profile', () => {
    const settings = makeSettings();
    settings.budget.profile = 'scenic';
    recordTrip(settings);
    _clearProfileCache();
    expect(getUserProfile().trips[0].budgetProfile).toBe('scenic');
  });

  it('captures numTravelers', () => {
    recordTrip(makeSettings({ numTravelers: 4 }));
    _clearProfileCache();
    expect(getUserProfile().trips[0].numTravelers).toBe(4);
  });

  it('sets hadGasBuffer true when gas weight > 0', () => {
    const settings = makeSettings();
    settings.budget.weights.gas = 30;
    recordTrip(settings);
    _clearProfileCache();
    expect(getUserProfile().trips[0].hadGasBuffer).toBe(true);
  });

  it('sets hadGasBuffer false when gas weight is 0', () => {
    const settings = makeSettings();
    settings.budget.weights.gas = 0;
    recordTrip(settings);
    _clearProfileCache();
    expect(getUserProfile().trips[0].hadGasBuffer).toBe(false);
  });

  it('calculates tripLengthDays from departure and return dates', () => {
    recordTrip(makeSettings({ departureDate: '2025-07-01', returnDate: '2025-07-06' }));
    _clearProfileCache();
    expect(getUserProfile().trips[0].tripLengthDays).toBe(5);
  });

  it('sets tripLengthDays to 0 when dates are missing', () => {
    recordTrip(makeSettings({ departureDate: '', returnDate: '' }));
    _clearProfileCache();
    expect(getUserProfile().trips[0].tripLengthDays).toBe(0);
  });

  it('rolls history to max 10 trips', () => {
    const tenTrips = Array.from({ length: 10 }, () => makeRecord());
    seedProfile(tenTrips);
    recordTrip(makeSettings({ hotelPricePerNight: 999 }));
    _clearProfileCache();
    const profile = getUserProfile();
    expect(profile.trips).toHaveLength(10);
    // Newest trip (the one we just recorded) should be last
    expect(profile.trips[9].hotelPricePerNight).toBe(999);
  });

  it('appends to existing trips', () => {
    seedProfile([makeRecord(), makeRecord()]);
    recordTrip(makeSettings());
    _clearProfileCache();
    expect(getUserProfile().trips).toHaveLength(3);
  });
});

describe('getAdaptiveDefaults', () => {
  beforeEach(() => {
    localStorage.clear();
    _clearProfileCache();
  });

  it('returns null on empty profile', () => {
    expect(getAdaptiveDefaults()).toBeNull();
  });

  it('returns null when fewer than 3 trips', () => {
    seedProfile([makeRecord(), makeRecord()]);
    expect(getAdaptiveDefaults()).toBeNull();
  });

  it('returns non-null when at least 3 trips', () => {
    seedProfile([makeRecord(), makeRecord(), makeRecord()]);
    expect(getAdaptiveDefaults()).not.toBeNull();
  });

  it('ADAPTIVE_CONFIDENCE_THRESHOLD is 3', () => {
    expect(ADAPTIVE_CONFIDENCE_THRESHOLD).toBe(3);
  });

  it('computes correct (unweighted) average hotel price when all trips are recent', () => {
    const trips = [
      makeRecord({ hotelPricePerNight: 100, date: Date.now() - 1000 }),
      makeRecord({ hotelPricePerNight: 200, date: Date.now() - 2000 }),
      makeRecord({ hotelPricePerNight: 300, date: Date.now() - 3000 }),
    ];
    seedProfile(trips);
    const defaults = getAdaptiveDefaults()!;
    // All trips are seconds old — weights are ~equal → average should be ~200
    expect(defaults.hotelPricePerNight).toBeGreaterThanOrEqual(195);
    expect(defaults.hotelPricePerNight).toBeLessThanOrEqual(205);
  });

  it('computes correct (unweighted) average meal price when all trips are recent', () => {
    const trips = [
      makeRecord({ mealPricePerDay: 40, date: Date.now() - 1000 }),
      makeRecord({ mealPricePerDay: 60, date: Date.now() - 2000 }),
      makeRecord({ mealPricePerDay: 80, date: Date.now() - 3000 }),
    ];
    seedProfile(trips);
    const defaults = getAdaptiveDefaults()!;
    expect(defaults.mealPricePerDay).toBeGreaterThanOrEqual(58);
    expect(defaults.mealPricePerDay).toBeLessThanOrEqual(62);
  });

  it('older trips carry less weight than recent ones', () => {
    const oldDate = Date.now() - 1000 * 60 * 60 * 24 * 365; // 1 year ago
    const recentDate = Date.now() - 1000 * 60 * 60 * 24; // 1 day ago
    const trips = [
      makeRecord({ hotelPricePerNight: 50, date: oldDate }),
      makeRecord({ hotelPricePerNight: 50, date: oldDate }),
      makeRecord({ hotelPricePerNight: 300, date: recentDate }),
    ];
    seedProfile(trips);
    const defaults = getAdaptiveDefaults()!;
    // Recent $300 should dominate — result should be well above the flat average of $133
    expect(defaults.hotelPricePerNight).toBeGreaterThan(200);
  });

  it('returns correct tripCount', () => {
    seedProfile([makeRecord(), makeRecord(), makeRecord(), makeRecord()]);
    const defaults = getAdaptiveDefaults()!;
    expect(defaults.tripCount).toBe(4);
  });

  it('accepts an explicit profile argument', () => {
    const profile: UserProfile = {
      version: 1,
      trips: [
        makeRecord({ hotelPricePerNight: 100 }),
        makeRecord({ hotelPricePerNight: 100 }),
        makeRecord({ hotelPricePerNight: 100 }),
      ],
    };
    const defaults = getAdaptiveDefaults(profile)!;
    expect(defaults.hotelPricePerNight).toBe(100);
  });
});

describe('isAdaptiveMeaningful', () => {
  it('returns false when values are identical to baseline', () => {
    expect(
      isAdaptiveMeaningful({
        hotelPricePerNight: CHICHARON_BASELINE.hotelPricePerNight,
        mealPricePerDay: CHICHARON_BASELINE.mealPricePerDay,
        tripCount: 3,
      })
    ).toBe(false);
  });

  it('returns false when within 10% of baseline', () => {
    expect(
      isAdaptiveMeaningful({
        hotelPricePerNight: 155, // ~3% above 150
        mealPricePerDay: 52,     // 4% above 50
        tripCount: 3,
      })
    ).toBe(false);
  });

  it('returns true when hotel differs by more than 10%', () => {
    expect(
      isAdaptiveMeaningful({
        hotelPricePerNight: 200, // 33% above 150
        mealPricePerDay: CHICHARON_BASELINE.mealPricePerDay,
        tripCount: 3,
      })
    ).toBe(true);
  });

  it('returns true when meals differ by more than 10%', () => {
    expect(
      isAdaptiveMeaningful({
        hotelPricePerNight: CHICHARON_BASELINE.hotelPricePerNight,
        mealPricePerDay: 70, // 40% above 50
        tripCount: 3,
      })
    ).toBe(true);
  });

  it('returns true when both fields differ significantly', () => {
    expect(
      isAdaptiveMeaningful({ hotelPricePerNight: 90, mealPricePerDay: 30, tripCount: 5 })
    ).toBe(true);
  });
});

describe('CHICHARON_BASELINE', () => {
  it('has hotelPricePerNight of 150', () => {
    expect(CHICHARON_BASELINE.hotelPricePerNight).toBe(150);
  });

  it('has mealPricePerDay of 50', () => {
    expect(CHICHARON_BASELINE.mealPricePerDay).toBe(50);
  });
});
