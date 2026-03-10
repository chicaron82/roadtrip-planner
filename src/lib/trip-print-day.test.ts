import { describe, expect, it } from 'vitest';
import type { TripDay, TripSettings, TripSummary, Vehicle } from '../types';
import type { PrintInput } from './canonical-trip';
import type { TimedEvent } from './trip-timeline-types';
import { buildDayHTML } from './trip-print-day';
import { buildPrintHTML } from './trip-print-builders';

const SETTINGS: TripSettings = {
  units: 'metric',
  currency: 'CAD',
  maxDriveHours: 16,
  numTravelers: 3,
  numDrivers: 3,
  budgetMode: 'plan-to-budget',
  budget: {
    mode: 'plan-to-budget',
    allocation: 'fixed',
    profile: 'balanced',
    weights: { gas: 25, hotel: 35, food: 25, misc: 15 },
    gas: 0,
    hotel: 0,
    food: 0,
    misc: 0,
    total: 3500,
  },
  departureDate: '2026-03-07',
  departureTime: '06:00',
  returnDate: '2026-03-13',
  arrivalDate: '2026-03-13',
  arrivalTime: '20:00',
  useArrivalTime: false,
  gasPrice: 1.6,
  hotelPricePerNight: 150,
  mealPricePerDay: 50,
  isRoundTrip: true,
  avoidTolls: false,
  avoidBorders: false,
  scenicMode: false,
  routePreference: 'fastest',
  stopFrequency: 'balanced',
  tripPreferences: [],
  targetArrivalHour: 21,
  dayTripDurationHours: 0,
  includeStartingLocation: true,
};

const DAY: TripDay = {
  dayNumber: 2,
  date: '2026-03-08',
  dateFormatted: 'Sun, Mar 8',
  route: 'Munising → Montreal, Quebec',
  segments: [{
    _originalIndex: 1,
    from: { id: 'm', name: 'Munising', lat: 46.4, lng: -86.65, type: 'waypoint' },
    to: { id: 'yul', name: 'Montreal, Quebec', lat: 45.5, lng: -73.56, type: 'destination' },
    distanceKm: 1158,
    durationMinutes: 786,
    fuelNeededLitres: 80,
    fuelCost: 105,
    departureTime: '2026-03-08T12:00:00.000Z',
    arrivalTime: '2026-03-09T01:06:00.000Z',
  }],
  segmentIndices: [1],
  overnight: {
    location: { id: 'm', name: 'Munising', lat: 46.4, lng: -86.65, type: 'waypoint' },
    accommodationType: 'hotel',
    cost: 300,
    roomsNeeded: 2,
  },
  timezoneChanges: [],
  budget: {
    gasUsed: 105,
    hotelCost: 300,
    foodEstimate: 200,
    miscCost: 0,
    dayTotal: 605,
    bankRemaining: 1000,
  },
  totals: {
    distanceKm: 1158,
    driveTimeMinutes: 786,
    stopTimeMinutes: 0,
    departureTime: '2026-03-08T12:00:00.000Z',
    arrivalTime: '2026-03-09T01:06:00.000Z',
  },
};

const EVENTS: TimedEvent[] = [
  {
    id: 'departure-day2',
    type: 'departure',
    arrivalTime: new Date('2026-03-08T12:00:00.000Z'),
    departureTime: new Date('2026-03-08T12:00:00.000Z'),
    durationMinutes: 0,
    distanceFromOriginKm: 1160,
    locationHint: 'Winnipeg, Manitoba',
    stops: [],
    timezone: 'America/Toronto',
  },
  {
    id: 'overnight-day2',
    type: 'overnight',
    arrivalTime: new Date('2026-03-09T01:06:00.000Z'),
    departureTime: new Date('2026-03-09T13:00:00.000Z'),
    durationMinutes: 720,
    distanceFromOriginKm: 2318,
    locationHint: 'Winnipeg, Manitoba',
    stops: [],
    timezone: 'America/Toronto',
  },
];

const SUMMARY: TripSummary = {
  totalDistanceKm: 4636,
  totalDurationMinutes: 3146,
  totalFuelLitres: 300,
  totalFuelCost: 420,
  gasStops: 4,
  costPerPerson: 1156.67,
  drivingDays: 4,
  segments: DAY.segments,
  fullGeometry: [],
  days: [DAY],
  costBreakdown: {
    fuel: 420,
    accommodation: 1800,
    meals: 1250,
    misc: 0,
    total: 3470,
    perPerson: 1156.67,
  },
  budgetStatus: 'under',
  budgetRemaining: 30,
};

const VEHICLE: Vehicle = {
  year: '2022',
  make: 'Toyota',
  model: 'Sienna',
  fuelEconomyCity: 10.5,
  fuelEconomyHwy: 7.9,
  tankSize: 68,
};

const PRINT_INPUT: PrintInput = {
  summary: SUMMARY,
  days: [{ meta: DAY, events: EVENTS }],
  inputs: {
    locations: [],
    vehicle: VEHICLE,
    settings: SETTINGS,
  },
};

const DAY_TRIP_DAY: TripDay = {
  dayNumber: 1,
  date: '2026-03-08',
  dateFormatted: 'Sun, Mar 8',
  route: 'Winnipeg, Manitoba → Winnipeg, Manitoba',
  segments: [
    {
      _originalIndex: 0,
      from: { id: 'wpg', name: 'Winnipeg, Manitoba', lat: 49.89, lng: -97.13, type: 'origin' },
      to: { id: 'plp', name: 'Portage la Prairie, Manitoba', lat: 49.97, lng: -98.29, type: 'destination' },
      distanceKm: 85,
      durationMinutes: 63,
      fuelNeededLitres: 8,
      fuelCost: 10,
      departureTime: '2026-03-08T15:00:00.000Z',
      arrivalTime: '2026-03-08T16:03:00.000Z',
    },
    {
      _originalIndex: 1,
      from: { id: 'plp', name: 'Portage la Prairie, Manitoba', lat: 49.97, lng: -98.29, type: 'destination' },
      to: { id: 'wpg', name: 'Winnipeg, Manitoba', lat: 49.89, lng: -97.13, type: 'origin' },
      distanceKm: 85,
      durationMinutes: 63,
      fuelNeededLitres: 8,
      fuelCost: 10,
      departureTime: '2026-03-08T20:03:00.000Z',
      arrivalTime: '2026-03-08T21:06:00.000Z',
    },
  ],
  segmentIndices: [0, 1],
  timezoneChanges: [],
  budget: {
    gasUsed: 20,
    hotelCost: 0,
    foodEstimate: 50,
    miscCost: 0,
    dayTotal: 70,
    bankRemaining: 1000,
  },
  totals: {
    distanceKm: 170,
    driveTimeMinutes: 127,
    stopTimeMinutes: 240,
    departureTime: '2026-03-08T15:00:00.000Z',
    arrivalTime: '2026-03-08T21:06:00.000Z',
  },
};

const DAY_TRIP_EVENTS: TimedEvent[] = [
  {
    id: 'departure',
    type: 'departure',
    arrivalTime: new Date('2026-03-08T15:00:00.000Z'),
    departureTime: new Date('2026-03-08T15:00:00.000Z'),
    durationMinutes: 0,
    distanceFromOriginKm: 0,
    locationHint: 'Winnipeg, Manitoba',
    stops: [],
    timezone: 'America/Winnipeg',
  },
  {
    id: 'destination-dwell',
    type: 'destination',
    arrivalTime: new Date('2026-03-08T16:03:00.000Z'),
    departureTime: new Date('2026-03-08T20:03:00.000Z'),
    durationMinutes: 240,
    distanceFromOriginKm: 85,
    locationHint: 'Portage la Prairie, Manitoba',
    stops: [],
    timezone: 'America/Winnipeg',
  },
  {
    id: 'arrival',
    type: 'arrival',
    arrivalTime: new Date('2026-03-08T21:06:00.000Z'),
    departureTime: new Date('2026-03-08T21:06:00.000Z'),
    durationMinutes: 0,
    distanceFromOriginKm: 170,
    locationHint: 'Winnipeg, Manitoba',
    stops: [],
    timezone: 'America/Winnipeg',
  },
];

describe('buildDayHTML', () => {
  it('prefers the resolved day route over stale departure event hints', () => {
    const html = buildDayHTML(DAY, SETTINGS, null, 'metric', EVENTS);

    expect(html).toContain('Route: Munising → Montreal, Quebec');
    expect(html).not.toContain('Route: Winnipeg, Manitoba → Montreal, Quebec');
  });

  it('uses the snapped overnight location for overnight event rendering', () => {
    const html = buildDayHTML(DAY, SETTINGS, null, 'metric', EVENTS);

    expect(html).toContain('Munising');
    expect(html).not.toContain('Overnight</strong><span class="event-location">Winnipeg, Manitoba</span>');
  });

  it('omits time-saved optimization text from print output', () => {
    const html = buildDayHTML(DAY, SETTINGS, null, 'metric', [{
      ...EVENTS[0],
      id: 'combo',
      type: 'combo',
      durationMinutes: 45,
      departureTime: new Date('2026-03-08T15:45:00.000Z'),
      locationHint: 'near Sault Ste. Marie, ON',
      timeSavedMinutes: 210,
    }]);

    expect(html).not.toContain('saves 210 min');
  });

  it('shows trip budget remaining and per-day cost breakdown', () => {
    const html = buildDayHTML(DAY, SETTINGS, null, 'metric', EVENTS, 2895);

    expect(html).toContain('Trip budget remaining: $2895.00');
    expect(html).toContain('Day Estimate:');
    expect(html).toContain('fuel est.');
    expect(html).toContain('hotel est.');
    expect(html).toContain('meals est.');
    expect(html).not.toContain('Fuel budget left:');
    expect(html).not.toContain('Hotel budget left:');
  });

  it('shows the turnaround city in same-day round trip route labels', () => {
    const html = buildDayHTML(DAY_TRIP_DAY, SETTINGS, null, 'metric', DAY_TRIP_EVENTS, 3430);

    expect(html).toContain('Route: Winnipeg, Manitoba → Portage la Prairie, Manitoba → Winnipeg, Manitoba');
  });
});

describe('buildPrintHTML budget messaging', () => {
  it('renders cover page with budget health, BEAST MODE badge, and itinerary header', () => {
    const html = buildPrintHTML('Winnipeg → Montreal', PRINT_INPUT, null, EVENTS);

    // Cover page budget card
    expect(html).toContain('Budget is sound');
    expect(html).toContain('$3470.00');   // est. cost from costBreakdown.total
    expect(html).toContain('$3500.00');   // budget target

    // BEAST MODE — maxDriveHours is 16 in SETTINGS
    expect(html).toContain('BEAST MODE');

    // Itinerary section header
    expect(html).toContain('Day-by-Day Itinerary');

    // Old overview format removed
    expect(html).not.toContain('Budget target:');
    expect(html).not.toContain('Total budget remaining:');
  });
});