import { describe, it, expect } from 'vitest';
import { buildSimulationItems } from './timeline-simulation';
import { flattenDrivingSegments } from './flatten-driving-segments';
import type { RouteSegment, TripDay, TripSummary, TripSettings, Vehicle, ProcessedSegment } from '../types';
import type { SuggestedStop } from './stop-suggestion-types';

// ─── Test Fixtures ────────────────────────────────────────────────────────────

const LOC_WPG = { id: 'wpg', name: 'Winnipeg', lat: 49.895, lng: -97.138, type: 'waypoint' as const };
const LOC_TB  = { id: 'tb', name: 'Thunder Bay', lat: 48.382, lng: -89.246, type: 'waypoint' as const };
const LOC_SSM = { id: 'ssm', name: 'Sault Ste. Marie', lat: 46.510, lng: -84.330, type: 'waypoint' as const };
const LOC_VAN = { id: 'van', name: 'Vancouver', lat: 49.283, lng: -123.121, type: 'waypoint' as const };

function makeSeg(from: typeof LOC_WPG, to: typeof LOC_WPG, overrides: Partial<RouteSegment> = {}): RouteSegment {
  return {
    from, to,
    distanceKm: 700,
    durationMinutes: 480, // 8h
    fuelNeededLitres: 63,
    fuelCost: 97,
    ...overrides,
  };
}

function makeProcessedSeg(
  from: typeof LOC_WPG,
  to: typeof LOC_WPG,
  origIdx: number,
  overrides: Partial<ProcessedSegment> = {},
): ProcessedSegment {
  return {
    from, to,
    distanceKm: 350,
    durationMinutes: 240, // 4h sub-segment
    fuelNeededLitres: 32,
    fuelCost: 49,
    _originalIndex: origIdx,
    ...overrides,
  };
}

function makeDay(dayNumber: number, date: string, segments: ProcessedSegment[], segmentIndices: number[]): TripDay {
  const driveMin = segments.reduce((sum, s) => sum + s.durationMinutes, 0);
  const dist = segments.reduce((sum, s) => sum + s.distanceKm, 0);
  return {
    dayNumber,
    date,
    dateFormatted: `Day ${dayNumber}`,
    route: segments.length ? `${segments[0].from.name} → ${segments[segments.length - 1].to.name}` : 'Free Day',
    segments,
    segmentIndices,
    timezoneChanges: [],
    budget: { gasUsed: 0, hotelCost: 0, foodEstimate: 0, miscCost: 0, dayTotal: 0, gasRemaining: 0, hotelRemaining: 0, foodRemaining: 0 },
    totals: {
      distanceKm: dist,
      driveTimeMinutes: driveMin,
      stopTimeMinutes: 0,
      departureTime: `${date}T08:00:00`,
      arrivalTime: `${date}T${String(8 + Math.floor(driveMin / 60)).padStart(2, '0')}:${String(driveMin % 60).padStart(2, '0')}:00`,
    },
  };
}

function makeFreeDay(dayNumber: number, date: string): TripDay {
  return makeDay(dayNumber, date, [], []);
}

const DEFAULT_SETTINGS: TripSettings = {
  units: 'metric',
  currency: 'CAD',
  maxDriveHours: 8,
  numTravelers: 2,
  numDrivers: 1,
  budgetMode: 'open',
  budget: { mode: 'open', allocation: 'flexible', profile: 'balanced', weights: { gas: 25, hotel: 35, food: 25, misc: 15 }, gas: 250, hotel: 350, food: 250, misc: 150, total: 1000 },
  departureDate: '2026-08-01',
  departureTime: '08:00',
  returnDate: '2026-08-07',
  arrivalDate: '2026-08-07',
  arrivalTime: '17:00',
  useArrivalTime: false,
  gasPrice: 1.55,
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
};

const DEFAULT_VEHICLE: Vehicle = {
  year: '2022', make: 'Toyota', model: 'Corolla',
  fuelEconomyCity: 8.0, fuelEconomyHwy: 6.5, tankSize: 50,
};

function makeSummary(segments: RouteSegment[]): TripSummary {
  return {
    totalDistanceKm: segments.reduce((s, seg) => s + seg.distanceKm, 0),
    totalDurationMinutes: segments.reduce((s, seg) => s + seg.durationMinutes, 0),
    totalFuelLitres: segments.reduce((s, seg) => s + seg.fuelNeededLitres, 0),
    totalFuelCost: segments.reduce((s, seg) => s + seg.fuelCost, 0),
    gasStops: 0,
    costPerPerson: 50,
    drivingDays: 1,
    segments,
    fullGeometry: [],
  };
}

// ─── flattenDrivingSegments ────────────────────────────────────────────────────

describe('flattenDrivingSegments', () => {
  it('falls back to wrapping original segments when days is undefined', () => {
    const segs = [makeSeg(LOC_WPG, LOC_TB), makeSeg(LOC_TB, LOC_SSM)];
    const result = flattenDrivingSegments(segs, undefined);

    expect(result.segments).toHaveLength(2);
    expect(result.segments[0].seg._originalIndex).toBe(0);
    expect(result.segments[1].seg._originalIndex).toBe(1);
    expect(result.segments[0].flatIdx).toBe(0);
    expect(result.segments[1].flatIdx).toBe(1);
    expect(result.dayBoundaries.size).toBe(0);
  });

  it('flattens multi-day transit sub-segments with correct flat indices', () => {
    // Simulates WPG → VAN split into 3 sub-segments across 3 driving days
    const subSeg1 = makeProcessedSeg(LOC_WPG, LOC_TB, 0);
    const subSeg2 = makeProcessedSeg(LOC_TB, LOC_SSM, 0);
    const subSeg3 = makeProcessedSeg(LOC_SSM, LOC_VAN, 0);

    const days = [
      makeDay(1, '2026-08-01', [subSeg1], [0]),
      makeDay(2, '2026-08-02', [subSeg2], [0]),
      makeDay(3, '2026-08-03', [subSeg3], [0]),
    ];

    const result = flattenDrivingSegments([makeSeg(LOC_WPG, LOC_VAN)], days);

    expect(result.segments).toHaveLength(3);
    expect(result.segments[0].flatIdx).toBe(0);
    expect(result.segments[1].flatIdx).toBe(1);
    expect(result.segments[2].flatIdx).toBe(2);

    // All share the same _originalIndex
    expect(result.segments[0].seg._originalIndex).toBe(0);
    expect(result.segments[1].seg._originalIndex).toBe(0);
    expect(result.segments[2].seg._originalIndex).toBe(0);

    // Day boundaries at index 1 (day 2) and index 2 (day 3) — NOT index 0 (day 1)
    expect(result.dayBoundaries.size).toBe(2);
    expect(result.dayBoundaries.get(1)?.dayNumber).toBe(2);
    expect(result.dayBoundaries.get(2)?.dayNumber).toBe(3);
    expect(result.dayBoundaries.has(0)).toBe(false);
  });

  it('skips free days (no segmentIndices)', () => {
    const subSeg1 = makeProcessedSeg(LOC_WPG, LOC_TB, 0);
    const subSeg2 = makeProcessedSeg(LOC_TB, LOC_SSM, 0);

    const days = [
      makeDay(1, '2026-08-01', [subSeg1], [0]),
      makeFreeDay(2, '2026-08-02'),
      makeDay(3, '2026-08-03', [subSeg2], [0]),
    ];

    const result = flattenDrivingSegments([makeSeg(LOC_WPG, LOC_SSM)], days);

    expect(result.segments).toHaveLength(2);
    // Day boundary only for the 2nd driving day (day 3), at flat index 1
    expect(result.dayBoundaries.size).toBe(1);
    expect(result.dayBoundaries.get(1)?.dayNumber).toBe(3);
  });

  it('handles round trip with outbound and return sub-segments', () => {
    // Outbound: 2 sub-segs (original index 0), Return: 2 sub-segs (original index 1)
    const out1 = makeProcessedSeg(LOC_WPG, LOC_TB, 0);
    const out2 = makeProcessedSeg(LOC_TB, LOC_VAN, 0);
    const ret1 = makeProcessedSeg(LOC_VAN, LOC_TB, 1);
    const ret2 = makeProcessedSeg(LOC_TB, LOC_WPG, 1);

    const days = [
      makeDay(1, '2026-08-01', [out1], [0]),
      makeDay(2, '2026-08-02', [out2], [0]),
      makeFreeDay(3, '2026-08-03'),         // free day at destination
      makeDay(4, '2026-08-04', [ret1], [1]),
      makeDay(5, '2026-08-05', [ret2], [1]),
    ];

    const origSegs = [makeSeg(LOC_WPG, LOC_VAN), makeSeg(LOC_VAN, LOC_WPG)];
    const result = flattenDrivingSegments(origSegs, days);

    expect(result.segments).toHaveLength(4);
    expect(result.segments.map(s => s.seg._originalIndex)).toEqual([0, 0, 1, 1]);
    expect(result.segments.map(s => s.flatIdx)).toEqual([0, 1, 2, 3]);

    // Day boundaries: day2 @1, day4 @2, day5 @3
    expect(result.dayBoundaries.size).toBe(3);
    expect(result.dayBoundaries.get(0)).toBeUndefined();
    expect(result.dayBoundaries.get(1)?.dayNumber).toBe(2);
    expect(result.dayBoundaries.get(2)?.dayNumber).toBe(4);
    expect(result.dayBoundaries.get(3)?.dayNumber).toBe(5);
  });
});

// ─── buildSimulationItems ─────────────────────────────────────────────────────

describe('buildSimulationItems', () => {
  it('produces stop items with correct flat indices (no days)', () => {
    const segs = [makeSeg(LOC_WPG, LOC_TB), makeSeg(LOC_TB, LOC_SSM)];
    const summary = makeSummary(segs);
    const items = buildSimulationItems({
      summary,
      settings: DEFAULT_SETTINGS,
      vehicle: DEFAULT_VEHICLE,
      days: undefined,
      startTime: new Date('2026-08-01T08:00:00'),
      activeSuggestions: [],
    });

    const stops = items.filter(i => i.type === 'stop');
    expect(stops).toHaveLength(2);
    expect(stops[0].index).toBe(0);
    expect(stops[0].originalIndex).toBe(0);
    expect(stops[1].index).toBe(1);
    expect(stops[1].originalIndex).toBe(1);
  });

  it('resets clock at day boundaries for multi-day transit', () => {
    // 3-day transit: each sub-segment is 7h. Without day boundary resets,
    // the simulation would show 21h continuous driving.
    const subSeg1 = makeProcessedSeg(LOC_WPG, LOC_TB, 0, { durationMinutes: 420 });
    const subSeg2 = makeProcessedSeg(LOC_TB, LOC_SSM, 0, { durationMinutes: 420 });
    const subSeg3 = makeProcessedSeg(LOC_SSM, LOC_VAN, 0, { durationMinutes: 420 });

    const days = [
      makeDay(1, '2026-08-01', [subSeg1], [0]),
      makeDay(2, '2026-08-02', [subSeg2], [0]),
      makeDay(3, '2026-08-03', [subSeg3], [0]),
    ];

    const summary = makeSummary([makeSeg(LOC_WPG, LOC_VAN, { durationMinutes: 1260 })]);
    const items = buildSimulationItems({
      summary,
      settings: DEFAULT_SETTINGS,
      vehicle: DEFAULT_VEHICLE,
      days,
      startTime: new Date('2026-08-01T08:00:00'),
      activeSuggestions: [],
    });

    const stops = items.filter(i => i.type === 'stop');
    expect(stops).toHaveLength(3);

    // Day 1: depart 08:00, arrive 15:00
    expect(stops[0].arrivalTime.getHours()).toBe(15);

    // Day 2: clock reset to 08:00, arrive 15:00 (not 22:00!)
    expect(stops[1].arrivalTime.getDate()).toBe(2);
    expect(stops[1].arrivalTime.getHours()).toBe(15);

    // Day 3: clock reset to 08:00, arrive 15:00 (not 29h total!)
    expect(stops[2].arrivalTime.getDate()).toBe(3);
    expect(stops[2].arrivalTime.getHours()).toBe(15);
  });

  it('flat index differs from originalIndex for transit sub-segments', () => {
    const subSeg1 = makeProcessedSeg(LOC_WPG, LOC_TB, 0);
    const subSeg2 = makeProcessedSeg(LOC_TB, LOC_VAN, 0);

    const days = [
      makeDay(1, '2026-08-01', [subSeg1], [0]),
      makeDay(2, '2026-08-02', [subSeg2], [0]),
    ];

    const summary = makeSummary([makeSeg(LOC_WPG, LOC_VAN)]);
    const items = buildSimulationItems({
      summary,
      settings: DEFAULT_SETTINGS,
      vehicle: DEFAULT_VEHICLE,
      days,
      startTime: new Date('2026-08-01T08:00:00'),
      activeSuggestions: [],
    });

    const stops = items.filter(i => i.type === 'stop');
    // Both have originalIndex 0 (same original segment)
    expect(stops[0].originalIndex).toBe(0);
    expect(stops[1].originalIndex).toBe(0);
    // But different flat indices
    expect(stops[0].index).toBe(0);
    expect(stops[1].index).toBe(1);
  });

  it('emits accepted stops after LAST sub-segment of each original', () => {
    const subSeg1 = makeProcessedSeg(LOC_WPG, LOC_TB, 0);
    const subSeg2 = makeProcessedSeg(LOC_TB, LOC_VAN, 0);

    const days = [
      makeDay(1, '2026-08-01', [subSeg1], [0]),
      makeDay(2, '2026-08-02', [subSeg2], [0]),
    ];

    const acceptedStop: SuggestedStop = {
      id: 'fuel-1',
      type: 'fuel',
      reason: 'Fuel up at destination',
      afterSegmentIndex: 0,
      estimatedTime: new Date('2026-08-02T12:00:00'),
      duration: 15,
      priority: 'recommended',
      accepted: true,
      details: {},
    };

    const summary = makeSummary([makeSeg(LOC_WPG, LOC_VAN)]);
    const items = buildSimulationItems({
      summary,
      settings: DEFAULT_SETTINGS,
      vehicle: DEFAULT_VEHICLE,
      days,
      startTime: new Date('2026-08-01T08:00:00'),
      activeSuggestions: [acceptedStop],
    });

    // Should appear AFTER the 2nd stop (last sub-seg of original 0), not after the 1st
    const stopIndices = items.map((it, idx) => ({ type: it.type, idx }));
    const sugIdx = stopIndices.findIndex(s => s.type === 'suggested');
    const lastStopIdx = stopIndices.filter(s => s.type === 'stop').pop()!.idx;
    expect(sugIdx).toBeGreaterThan(lastStopIdx);
  });

  it('does not emit accepted stops between sub-segments of same original', () => {
    // 3 sub-segments of original 0: stop should NOT appear after sub-seg 1 or 2
    const subSeg1 = makeProcessedSeg(LOC_WPG, LOC_TB, 0, { durationMinutes: 240, fuelNeededLitres: 20 });
    const subSeg2 = makeProcessedSeg(LOC_TB, LOC_SSM, 0, { durationMinutes: 240, fuelNeededLitres: 20 });
    const subSeg3 = makeProcessedSeg(LOC_SSM, LOC_VAN, 0, { durationMinutes: 240, fuelNeededLitres: 20 });

    const days = [
      makeDay(1, '2026-08-01', [subSeg1], [0]),
      makeDay(2, '2026-08-02', [subSeg2], [0]),
      makeDay(3, '2026-08-03', [subSeg3], [0]),
    ];

    const acceptedStop: SuggestedStop = {
      id: 'meal-1',
      type: 'meal',
      reason: 'Lunch at destination',
      afterSegmentIndex: 0,
      estimatedTime: new Date('2026-08-03T12:00:00'),
      duration: 45,
      priority: 'recommended',
      accepted: true,
      details: {},
    };

    const summary = makeSummary([makeSeg(LOC_WPG, LOC_VAN, { durationMinutes: 720 })]);
    const items = buildSimulationItems({
      summary,
      settings: DEFAULT_SETTINGS,
      vehicle: DEFAULT_VEHICLE,
      days,
      startTime: new Date('2026-08-01T08:00:00'),
      activeSuggestions: [acceptedStop],
    });

    // There should be exactly 1 suggested item (after the 3rd stop)
    const suggested = items.filter(i => i.type === 'suggested');
    expect(suggested).toHaveLength(1);

    // And it should be the LAST item (after all 3 stops)
    const lastItem = items[items.length - 1];
    expect(lastItem.type).toBe('suggested');
  });

  it('filters out overnight stops from accepted list', () => {
    const seg = makeProcessedSeg(LOC_WPG, LOC_TB, 0);
    const days = [makeDay(1, '2026-08-01', [seg], [0])];

    const overnightStop: SuggestedStop = {
      id: 'overnight-1',
      type: 'overnight',
      reason: 'Hotel in Thunder Bay',
      afterSegmentIndex: 0,
      estimatedTime: new Date('2026-08-01T17:00:00'),
      duration: 600,
      priority: 'recommended',
      accepted: true,
      details: {},
    };

    const summary = makeSummary([makeSeg(LOC_WPG, LOC_TB)]);
    const items = buildSimulationItems({
      summary,
      settings: DEFAULT_SETTINGS,
      vehicle: DEFAULT_VEHICLE,
      days,
      startTime: new Date('2026-08-01T08:00:00'),
      activeSuggestions: [overnightStop],
    });

    // Overnight stops should NOT appear as simulation items
    expect(items.filter(i => i.type === 'suggested')).toHaveLength(0);
  });

  it('resets fuel tank at day boundaries', () => {
    // Each sub-seg uses 45L of a 50L tank. Without reset, 2nd sub-seg
    // would trigger a gas stop because currentFuel would be 5L.
    const subSeg1 = makeProcessedSeg(LOC_WPG, LOC_TB, 0, { fuelNeededLitres: 45 });
    const subSeg2 = makeProcessedSeg(LOC_TB, LOC_VAN, 0, { fuelNeededLitres: 45 });

    const days = [
      makeDay(1, '2026-08-01', [subSeg1], [0]),
      makeDay(2, '2026-08-02', [subSeg2], [0]),
    ];

    const summary = makeSummary([makeSeg(LOC_WPG, LOC_VAN, { fuelNeededLitres: 90 })]);
    const items = buildSimulationItems({
      summary,
      settings: DEFAULT_SETTINGS,
      vehicle: DEFAULT_VEHICLE,
      days,
      startTime: new Date('2026-08-01T08:00:00'),
      activeSuggestions: [],
    });

    // With day-boundary fuel reset, no gas stops should be inserted
    const gasStops = items.filter(i => i.type === 'gas');
    expect(gasStops).toHaveLength(0);
  });

  it('inserts safety-net gas stop when tank is low and no accepted fuel exists', () => {
    // Single segment using most of the tank
    const seg = makeSeg(LOC_WPG, LOC_TB, { fuelNeededLitres: 45, durationMinutes: 120 });
    const summary = makeSummary([seg, makeSeg(LOC_TB, LOC_SSM, { fuelNeededLitres: 40, durationMinutes: 120 })]);
    const items = buildSimulationItems({
      summary,
      settings: DEFAULT_SETTINGS,
      vehicle: DEFAULT_VEHICLE,
      days: undefined,
      startTime: new Date('2026-08-01T08:00:00'),
      activeSuggestions: [],
    });

    // Should have at least one gas stop before the 2nd segment
    const gasStops = items.filter(i => i.type === 'gas');
    expect(gasStops.length).toBeGreaterThanOrEqual(1);
  });

  it('skips safety-net gas when tank is nearly full', () => {
    // Segment with high fuelNeeded but tank is full at start — this is the
    // "mega-segment" scenario where fuelNeeded exceeds tank capacity
    const seg = makeSeg(LOC_WPG, LOC_VAN, { fuelNeededLitres: 80, durationMinutes: 480 });
    const summary = makeSummary([seg]);
    const items = buildSimulationItems({
      summary,
      settings: DEFAULT_SETTINGS,
      vehicle: DEFAULT_VEHICLE,
      days: undefined,
      startTime: new Date('2026-08-01T08:00:00'),
      activeSuggestions: [],
    });

    // No gas stops — tank was full at start (nearly full), so safety net is skipped
    const gasStops = items.filter(i => i.type === 'gas');
    expect(gasStops).toHaveLength(0);
  });
});
