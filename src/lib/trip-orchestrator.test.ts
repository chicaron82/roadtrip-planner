import { describe, it, expect } from 'vitest';
import type { TripDay, TripSummary, TripSettings } from '../types';
import type { TimedEvent } from './trip-timeline-types';
import type { SuggestedStop } from './stop-suggestion-types';
import type { CanonicalTripTimeline } from './canonical-trip';
import {
  patchDaysFromCanonicalEvents,
  projectFuelStopsFromSimulation,
  assembleCanonicalTimeline,
  getRoundTripDayTripStayMinutes,
} from './trip-orchestrator';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<TimedEvent>): TimedEvent {
  return {
    id: 'evt-1',
    type: 'drive',
    arrivalTime: new Date('2026-08-16T17:00:00Z'),
    departureTime: new Date('2026-08-16T09:00:00Z'),
    durationMinutes: 480,
    distanceFromOriginKm: 0,
    locationHint: 'Somewhere',
    stops: [],
    timezone: 'America/Chicago',
    ...overrides,
  };
}

function makeDay(overrides: Partial<TripDay> = {}): TripDay {
  return {
    dayNumber: 1,
    date: '2026-08-16',
    dateFormatted: 'Sat, Aug 16',
    route: '',
    segments: [
      {
        from: { id: 'a', name: 'Los Angeles, CA', lat: 34.05, lng: -118.24, type: 'waypoint' },
        to: { id: 'b', name: 'Phoenix, AZ', lat: 33.45, lng: -112.07, type: 'waypoint' },
        distanceKm: 600,
        durationMinutes: 360,
        fuelNeededLitres: 40,
        fuelCost: 60,
        _originalIndex: 0,
      },
    ],
    segmentIndices: [0],
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
      distanceKm: 600,
      driveTimeMinutes: 360,
      stopTimeMinutes: 0,
      departureTime: '2026-08-16T09:00:00.000Z',
      arrivalTime: '2026-08-16T17:00:00.000Z',
    },
    ...overrides,
  };
}

function makeFuelStop(overrides: Partial<SuggestedStop> = {}): SuggestedStop {
  return {
    id: 'fuel-1',
    type: 'fuel',
    reason: 'Fuel up in Flagstaff, AZ.',
    afterSegmentIndex: 0,
    estimatedTime: new Date('2026-08-16T13:00:00Z'),
    duration: 15,
    priority: 'recommended',
    details: { fuelCost: 55, fillType: 'full' },
    hubName: 'Flagstaff, AZ',
    lat: 35.19,
    lng: -111.65,
    distanceFromStart: 310,
    ...overrides,
  };
}

// Minimal TripSummary stub — only fields used by assembleCanonicalTimeline
function makeSummary(): TripSummary {
  return {
    segments: [],
    days: [],
    totalDistanceKm: 600,
    totalDurationMinutes: 360,
    totalFuelCost: 60,
    costPerPerson: 60,
    fuelStops: 1,
    estimatedFuelUsed: 40,
    costBreakdown: {
      fuel: 60, hotel: 0, food: 0, misc: 0, total: 60,
      details: { fuel: [], hotel: [], food: [], misc: [] },
    },
    budgetStatus: 'on-track',
    budgetRemaining: 0,
  } as unknown as TripSummary;
}

// ─── patchDaysFromCanonicalEvents ────────────────────────────────────────────

describe('patchDaysFromCanonicalEvents', () => {
  it('patches departure time from canonical departure event matching the day date', () => {
    const day = makeDay({ totals: { ...makeDay().totals, departureTime: '2026-08-16T09:00:00.000Z' } });
    const depEvent = makeEvent({
      id: 'dep-1',
      type: 'departure',
      arrivalTime: new Date('2026-08-16T08:30:00Z'),
      locationHint: 'Los Angeles, CA',
      timezone: 'America/Los_Angeles',
    });
    const arrEvent = makeEvent({
      id: 'arr-1',
      type: 'arrival',
      arrivalTime: new Date('2026-08-16T16:45:00Z'),
    });

    patchDaysFromCanonicalEvents([day], [depEvent, arrEvent]);

    expect(day.totals.departureTime).toBe(depEvent.arrivalTime.toISOString());
    expect(day.totals.arrivalTime).toBe(arrEvent.arrivalTime.toISOString());
  });

  it('patches arrival time from overnight event instead of arrival when overnight appears', () => {
    const day = makeDay();
    const depEvent = makeEvent({
      id: 'dep-1', type: 'departure',
      arrivalTime: new Date('2026-08-16T09:00:00Z'),
      locationHint: 'Los Angeles, CA',
      timezone: 'America/Los_Angeles',
    });
    const overnightEvent = makeEvent({
      id: 'ovn-1', type: 'overnight',
      arrivalTime: new Date('2026-08-16T22:00:00Z'),
      locationHint: 'near Flagstaff, AZ',
    });

    patchDaysFromCanonicalEvents([day], [depEvent, overnightEvent]);

    expect(day.totals.arrivalTime).toBe(overnightEvent.arrivalTime.toISOString());
  });

  it('falls back to last waypoint when no overnight or arrival event exists', () => {
    const day = makeDay();
    const depEvent = makeEvent({
      id: 'dep-1', type: 'departure',
      arrivalTime: new Date('2026-08-16T09:00:00Z'),
      timezone: 'America/Los_Angeles',
    });
    const waypointEvent = makeEvent({
      id: 'wp-1', type: 'waypoint',
      arrivalTime: new Date('2026-08-16T15:00:00Z'),
    });

    patchDaysFromCanonicalEvents([day], [depEvent, waypointEvent]);

    expect(day.totals.arrivalTime).toBe(waypointEvent.arrivalTime.toISOString());
  });

  it('does not patch times when no departure event matches the day date', () => {
    const day = makeDay({
      date: '2026-08-17',
      dateFormatted: 'Sun, Aug 17',
      totals: { ...makeDay().totals, departureTime: '2026-08-17T09:00:00.000Z' },
    });
    const originalDep = day.totals.departureTime;
    const originalArr = day.totals.arrivalTime;

    // dep event is on a different date
    const depEvent = makeEvent({
      id: 'dep-1', type: 'departure',
      arrivalTime: new Date('2026-08-16T09:00:00Z'),
      timezone: 'America/Los_Angeles',
    });

    patchDaysFromCanonicalEvents([day], [depEvent]);

    expect(day.totals.departureTime).toBe(originalDep);
    expect(day.totals.arrivalTime).toBe(originalArr);
  });

  it('skips days with no segments', () => {
    const day = makeDay({ segments: [] });
    const originalDep = day.totals.departureTime;

    const depEvent = makeEvent({
      id: 'dep-1', type: 'departure',
      arrivalTime: new Date('2026-08-16T09:00:00Z'),
      timezone: 'America/Los_Angeles',
    });

    patchDaysFromCanonicalEvents([day], [depEvent]);

    expect(day.totals.departureTime).toBe(originalDep);
  });

  it('builds route label from departure locationHint and last segment destination', () => {
    const day = makeDay({ route: '' });
    const depEvent = makeEvent({
      id: 'dep-1', type: 'departure',
      arrivalTime: new Date('2026-08-16T09:00:00Z'),
      locationHint: 'Los Angeles, CA',
      timezone: 'America/Los_Angeles',
    });
    const arrEvent = makeEvent({ id: 'arr-1', type: 'arrival', arrivalTime: new Date('2026-08-16T17:00:00Z') });

    patchDaysFromCanonicalEvents([day], [depEvent, arrEvent]);

    expect(day.route).toBe('Los Angeles, CA → Phoenix, AZ');
  });

  it('does not overwrite an already-populated route label', () => {
    const day = makeDay({ route: 'Existing Route' });
    const depEvent = makeEvent({
      id: 'dep-1', type: 'departure',
      arrivalTime: new Date('2026-08-16T09:00:00Z'),
      locationHint: 'Los Angeles, CA',
      timezone: 'America/Los_Angeles',
    });

    patchDaysFromCanonicalEvents([day], [depEvent]);

    expect(day.route).toBe('Existing Route');
  });

  it('strips (transit) suffix from destination when building route label', () => {
    const day = makeDay({
      route: '',
      segments: [{
        from: { id: 'a', name: 'Phoenix, AZ', lat: 33.45, lng: -112.07, type: 'waypoint' },
        to: { id: 'b', name: 'Albuquerque (transit)', lat: 35.08, lng: -106.65, type: 'waypoint' },
        distanceKm: 480, durationMinutes: 300, fuelNeededLitres: 30, fuelCost: 40,
        _originalIndex: 0,
      }],
    });
    const depEvent = makeEvent({
      id: 'dep-1', type: 'departure',
      arrivalTime: new Date('2026-08-16T09:00:00Z'),
      locationHint: 'Phoenix, AZ',
      timezone: 'America/Phoenix',
    });

    patchDaysFromCanonicalEvents([day], [depEvent]);

    expect(day.route).toBe('Phoenix, AZ → Albuquerque');
  });
});

// ─── projectFuelStopsFromSimulation ──────────────────────────────────────────

describe('projectFuelStopsFromSimulation', () => {
  it('converts a fuel stop to StrategicFuelStop shape', () => {
    const stop = makeFuelStop({ estimatedTime: new Date('2026-08-16T13:30:00Z') });
    const result = projectFuelStopsFromSimulation([stop]);

    expect(result).toHaveLength(1);
    expect(result[0].lat).toBe(35.19);
    expect(result[0].lng).toBe(-111.65);
    expect(result[0].stationName).toBe('Flagstaff, AZ');
    expect(result[0].isFullFill).toBe(true);
  });

  it('formats estimatedTime as 12-hour AM/PM string', () => {
    // 13:30 UTC → should render as something like "1:30 PM"
    const stop = makeFuelStop({ estimatedTime: new Date('2026-08-16T13:30:00Z') });
    const result = projectFuelStopsFromSimulation([stop]);

    expect(result[0].estimatedTime).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
  });

  it('filters out dismissed stops', () => {
    const dismissed = makeFuelStop({ dismissed: true });
    const active = makeFuelStop({ id: 'fuel-2', lat: 36.0, lng: -112.0 });
    const result = projectFuelStopsFromSimulation([dismissed, active]);

    expect(result).toHaveLength(1);
    expect(result[0].lat).toBe(36.0);
  });

  it('filters out non-fuel stops', () => {
    const rest = makeFuelStop({ type: 'rest' as const });
    const fuel = makeFuelStop({ id: 'fuel-2' });
    const result = projectFuelStopsFromSimulation([rest, fuel]);

    expect(result).toHaveLength(1);
  });

  it('filters out stops with missing coordinates', () => {
    const noCoords = makeFuelStop({ lat: undefined, lng: undefined });
    const result = projectFuelStopsFromSimulation([noCoords]);

    expect(result).toHaveLength(0);
  });

  it('returns empty array when given no stops', () => {
    expect(projectFuelStopsFromSimulation([])).toHaveLength(0);
  });
});

// ─── assembleCanonicalTimeline ───────────────────────────────────────────────

describe('assembleCanonicalTimeline', () => {
  it('returns an object with events, days, summary, and inputs', () => {
    const events: TimedEvent[] = [makeEvent({ id: 'e1', type: 'departure' })];
    const tripDays: TripDay[] = [makeDay()];
    const summary = makeSummary();
    const inputs: CanonicalTripTimeline['inputs'] = {
      locations: [],
      vehicle: {} as never,
      settings: {} as never,
    };

    const result = assembleCanonicalTimeline(events, tripDays, summary, inputs);

    expect(result.events).toBe(events);
    expect(result.summary).toBe(summary);
    expect(result.inputs).toBe(inputs);
    expect(Array.isArray(result.days)).toBe(true);
  });

  it('groups events into per-day buckets via groupEventsByTripDay', () => {
    const events: TimedEvent[] = [];
    const tripDays: TripDay[] = [makeDay(), makeDay({ dayNumber: 2, date: '2026-08-17' })];
    const result = assembleCanonicalTimeline(events, tripDays, makeSummary(), {
      locations: [], vehicle: {} as never, settings: {} as never,
    });

    // days array length should match tripDays
    expect(result.days.length).toBe(tripDays.length);
  });
});

// ─── getRoundTripDayTripStayMinutes ──────────────────────────────────────────

function makeMinimalSettings(overrides: Partial<TripSettings> = {}): TripSettings {
  return {
    units: 'metric',
    currency: 'CAD',
    maxDriveHours: 8,
    numTravelers: 2,
    numDrivers: 1,
    budgetMode: 'plan-to-budget',
    budget: { mode: 'plan-to-budget', allocation: 'flexible', profile: 'balanced', weights: { gas: 25, hotel: 35, food: 30, misc: 10 }, gas: 0, hotel: 0, food: 0, misc: 0, total: 0 },
    departureDate: '2026-08-16',
    departureTime: '09:00',
    returnDate: '',
    arrivalDate: '',
    arrivalTime: '',
    ...overrides,
  } as TripSettings;
}

describe('getRoundTripDayTripStayMinutes', () => {
  it('returns dayTripDurationHours * 60 for a qualifying RT day trip', () => {
    const summary = { ...makeSummary(), totalDurationMinutes: 300 }; // 5h < 8h limit
    const settings = makeMinimalSettings({ isRoundTrip: true, dayTripDurationHours: 3 });
    expect(getRoundTripDayTripStayMinutes(summary as TripSummary, 1, settings)).toBe(180);
  });

  it('returns 0 when isRoundTrip is false', () => {
    const summary = { ...makeSummary(), totalDurationMinutes: 200 };
    const settings = makeMinimalSettings({ isRoundTrip: false, dayTripDurationHours: 4 });
    expect(getRoundTripDayTripStayMinutes(summary as TripSummary, 1, settings)).toBe(0);
  });

  it('returns 0 when dayCount is more than 1', () => {
    const summary = { ...makeSummary(), totalDurationMinutes: 200 };
    const settings = makeMinimalSettings({ isRoundTrip: true, dayTripDurationHours: 4 });
    expect(getRoundTripDayTripStayMinutes(summary as TripSummary, 2, settings)).toBe(0);
  });

  it('returns 0 when totalDurationMinutes exceeds maxDriveHours limit', () => {
    const summary = { ...makeSummary(), totalDurationMinutes: 600 }; // 10h > 8h max
    const settings = makeMinimalSettings({ isRoundTrip: true, dayTripDurationHours: 4 });
    expect(getRoundTripDayTripStayMinutes(summary as TripSummary, 1, settings)).toBe(0);
  });

  it('returns 0 when dayTripDurationHours is undefined', () => {
    const summary = { ...makeSummary(), totalDurationMinutes: 200 };
    const settings = makeMinimalSettings({ isRoundTrip: true, dayTripDurationHours: undefined });
    expect(getRoundTripDayTripStayMinutes(summary as TripSummary, 1, settings)).toBe(0);
  });
});

