import { describe, expect, it } from 'vitest';
import type { ProcessedSegment, RouteSegment, TripDay, TripSettings, TripSummary } from '../types';
import type { SuggestedStop } from './stop-suggestion-types';
import { buildAcceptedItineraryTimeline, groupEventsByTripDay } from './accepted-itinerary-timeline';

const LOC_A = { id: 'a', name: 'A', lat: 49.895, lng: -97.138, type: 'waypoint' as const };
const LOC_B = { id: 'b', name: 'B', lat: 49.0, lng: -96.0, type: 'waypoint' as const };
const LOC_C = { id: 'c', name: 'C', lat: 48.0, lng: -95.0, type: 'waypoint' as const };

function makeSegment(from = LOC_A, to = LOC_B, overrides: Partial<RouteSegment> = {}): RouteSegment {
  return {
    from,
    to,
    distanceKm: 200,
    durationMinutes: 120,
    fuelNeededLitres: 20,
    fuelCost: 30,
    ...overrides,
  };
}

function makeDay(dayNumber: number, date: string, segments: TripDay['segments'], segmentIndices: number[]): TripDay {
  return {
    dayNumber,
    date,
    dateFormatted: date,
    route: segments.length ? `${segments[0].from.name} → ${segments[segments.length - 1].to.name}` : 'Free Day',
    segments,
    segmentIndices,
    timezoneChanges: [],
    budget: { gasUsed: 0, hotelCost: 0, foodEstimate: 0, miscCost: 0, dayTotal: 0, gasRemaining: 0, hotelRemaining: 0, foodRemaining: 0 },
    totals: {
      distanceKm: segments.reduce((sum, segment) => sum + segment.distanceKm, 0),
      driveTimeMinutes: segments.reduce((sum, segment) => sum + segment.durationMinutes, 0),
      stopTimeMinutes: 0,
      departureTime: `${date}T08:00:00.000Z`,
      arrivalTime: `${date}T10:00:00.000Z`,
    },
  };
}

function makeProcessedSegment(from = LOC_A, to = LOC_B, overrides: Partial<ProcessedSegment> = {}): ProcessedSegment {
  return {
    ...makeSegment(from, to, overrides),
    _originalIndex: 0,
    ...overrides,
  };
}

function makeSummary(segments: RouteSegment[], days: TripDay[]): TripSummary {
  return {
    totalDistanceKm: segments.reduce((sum, segment) => sum + segment.distanceKm, 0),
    totalDurationMinutes: segments.reduce((sum, segment) => sum + segment.durationMinutes, 0),
    totalFuelLitres: segments.reduce((sum, segment) => sum + segment.fuelNeededLitres, 0),
    totalFuelCost: segments.reduce((sum, segment) => sum + segment.fuelCost, 0),
    gasStops: 0,
    costPerPerson: 15,
    drivingDays: days.filter(day => day.segmentIndices.length > 0).length,
    segments,
    days,
    fullGeometry: [],
  };
}

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

function makeStop(id: string, accepted: boolean): SuggestedStop {
  return {
    id,
    type: 'fuel',
    afterSegmentIndex: -1,
    estimatedTime: new Date('2026-08-01T09:00:00Z'),
    duration: 15,
    reason: 'test',
    priority: 'recommended',
    details: {},
    accepted,
    dismissed: false,
  };
}

describe('groupEventsByTripDay', () => {
  it('keeps free days and groups driving-day events into departure windows', () => {
    const day1 = makeDay(1, '2026-08-01', [makeProcessedSegment(LOC_A, LOC_B)], [0]);
    const freeDay = makeDay(2, '2026-08-02', [], []);
    const day3 = makeDay(3, '2026-08-03', [makeProcessedSegment(LOC_B, LOC_C, { _originalIndex: 1 })], [1]);
    const events = [
      { type: 'departure', arrivalTime: new Date('2026-08-01T08:00:00Z') },
      { type: 'arrival', arrivalTime: new Date('2026-08-01T10:00:00Z') },
      { type: 'departure', arrivalTime: new Date('2026-08-03T08:00:00Z') },
      { type: 'arrival', arrivalTime: new Date('2026-08-03T10:00:00Z') },
    ] as unknown as import('./trip-timeline').TimedEvent[];

    const grouped = groupEventsByTripDay(events, [day1, freeDay, day3]);

    expect(grouped).toHaveLength(3);
    expect(grouped[0].events).toHaveLength(2);
    expect(grouped[1].events).toHaveLength(0);
    expect(grouped[2].events).toHaveLength(2);
  });
});

describe('buildAcceptedItineraryTimeline', () => {
  it('builds itinerary events from accepted suggestions only', () => {
    const segments = [makeSegment()];
    const days = [makeDay(1, '2026-08-01', [makeProcessedSegment()], [0])];
    const summary = makeSummary(segments, days);

    const acceptedTimeline = buildAcceptedItineraryTimeline({
      summary,
      settings: SETTINGS,
      tripDays: days,
      startTime: new Date('2026-08-01T08:00:00Z'),
      activeSuggestions: [makeStop('accepted-stop', true), makeStop('pending-stop', false)],
    });

    expect(acceptedTimeline.events.some(event => event.stops.some(stop => stop.id === 'accepted-stop'))).toBe(true);
    expect(acceptedTimeline.events.some(event => event.stops.some(stop => stop.id === 'pending-stop'))).toBe(false);
  });
});