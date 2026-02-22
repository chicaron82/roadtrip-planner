/**
 * Shared test fixtures for the roadtrip-planner test suite.
 *
 * Single source of truth for makeSegment / makeDay / makeSummary /
 * makeBudget / makeSettings so test files don't drift apart.
 *
 * Usage:
 *   import { makeSettings, makeSummary, makeDay } from '../test/fixtures';
 */

import type {
  TripSummary,
  TripSettings,
  TripDay,
  RouteSegment,
  TripBudget,
  Location,
} from '../types';

// ==================== PRIMITIVES ====================

export function makeLocation(name: string, lat = 49.8, lng = -97.1): Location {
  return { id: `loc-${name}`, name, lat, lng, type: 'waypoint' };
}

export function makeSegment(overrides: Partial<RouteSegment> = {}): RouteSegment {
  return {
    from: makeLocation('A'),
    to: makeLocation('B'),
    distanceKm: 200,
    durationMinutes: 120,
    fuelNeededLitres: 15,
    fuelCost: 25,
    ...overrides,
  };
}

// ==================== BUDGET ====================

export function makeBudget(overrides: Partial<TripBudget> = {}): TripBudget {
  return {
    mode: 'plan-to-budget',
    allocation: 'flexible',
    profile: 'balanced',
    weights: { gas: 25, hotel: 35, food: 30, misc: 10 },
    gas: 600,
    hotel: 800,
    food: 400,
    misc: 200,
    total: 2000,
    ...overrides,
  };
}

// ==================== SETTINGS ====================

/**
 * Canonical default settings for tests.
 * Matches feasibility.test.ts defaults (4 travelers, 2 drivers, 10h drive).
 * Override anything via the `overrides` param.
 */
export function makeSettings(overrides: Partial<TripSettings> = {}): TripSettings {
  return {
    units: 'metric',
    currency: 'CAD',
    maxDriveHours: 10,
    numTravelers: 4,
    numDrivers: 2,
    budgetMode: 'plan-to-budget',
    budget: makeBudget(),
    departureDate: '2025-08-16',
    departureTime: '09:00',
    returnDate: '',
    arrivalDate: '2025-08-21',
    arrivalTime: '22:00',
    useArrivalTime: false,
    gasPrice: 1.50,
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
    ...overrides,
  };
}

// ==================== DAY / SUMMARY ====================

export function makeDay(overrides: Partial<TripDay> = {}): TripDay {
  return {
    dayNumber: 1,
    date: '2025-08-16',
    dateFormatted: 'Sat, Aug 16',
    route: 'Winnipeg → Sault Ste. Marie',
    segments: [makeSegment()],
    segmentIndices: [0],
    timezoneChanges: [],
    budget: {
      gasUsed: 150,
      hotelCost: 204,
      foodEstimate: 80,
      miscCost: 0,
      dayTotal: 434,
      gasRemaining: 450,
      hotelRemaining: 596,
      foodRemaining: 320,
    },
    totals: {
      distanceKm: 400,
      driveTimeMinutes: 240,
      stopTimeMinutes: 30,
      departureTime: '2025-08-16T09:00:00',
      arrivalTime: '2025-08-16T13:30:00',
    },
    ...overrides,
  };
}

/**
 * Build a TripSummary from an array of days (feasibility-test style) or
 * from direct field overrides (trip-analyzer-test style). Both work.
 *
 *   makeSummary([day1, day2])
 *   makeSummary({ totalDistanceKm: 800 })
 *   makeSummary([day1], { totalFuelCost: 999 })
 */
export function makeSummary(
  daysOrOverrides: TripDay[] | Partial<TripSummary> = [],
  extraOverrides: Partial<TripSummary> = {},
): TripSummary {
  const days = Array.isArray(daysOrOverrides) ? daysOrOverrides : undefined;
  const overrides = Array.isArray(daysOrOverrides) ? extraOverrides : daysOrOverrides;

  const segments = days?.flatMap(d => d.segments) ?? [makeSegment()];
  const totalDistanceKm = days?.reduce((s, d) => s + d.totals.distanceKm, 0) ?? 500;
  const totalDurationMinutes = days?.reduce((s, d) => s + d.totals.driveTimeMinutes, 0) ?? 360;

  return {
    totalDistanceKm,
    totalDurationMinutes,
    totalFuelLitres: 40,
    totalFuelCost: 70,
    gasStops: 1,
    costPerPerson: 200,
    drivingDays: days?.length ?? 1,
    segments,
    fullGeometry: [],
    ...(days ? { days } : {}),
    ...overrides,
  };
}
