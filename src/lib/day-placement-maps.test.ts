import { describe, expect, it } from 'vitest';
import type { CanonicalTripDay } from './canonical-trip';
import { buildDayPlacementMaps } from './day-placement-maps';
import type { ProcessedSegment, TripDay } from '../types';

const LOC_A = { id: 'a', name: 'A', lat: 49.895, lng: -97.138, type: 'waypoint' as const };
const LOC_B = { id: 'b', name: 'B', lat: 49.0, lng: -96.0, type: 'waypoint' as const };
const LOC_C = { id: 'c', name: 'C', lat: 48.0, lng: -95.0, type: 'waypoint' as const };

function makeSegment(from = LOC_A, to = LOC_B, originalIndex = 0): ProcessedSegment {
  return {
    from,
    to,
    distanceKm: 200,
    durationMinutes: 120,
    fuelNeededLitres: 20,
    fuelCost: 30,
    _originalIndex: originalIndex,
  };
}

function makeDay(dayNumber: number, date: string, segments: ProcessedSegment[], segmentIndices: number[]): TripDay {
  return {
    dayNumber,
    date,
    dateFormatted: date,
    route: segments.length ? `${segments[0].from.name} -> ${segments[segments.length - 1].to.name}` : 'Free Day',
    segments,
    segmentIndices,
    timezoneChanges: [],
    budget: { gasUsed: 0, hotelCost: 0, foodEstimate: 0, miscCost: 0, dayTotal: 0, bankRemaining: 1000 },
    totals: {
      distanceKm: segments.reduce((sum, segment) => sum + segment.distanceKm, 0),
      driveTimeMinutes: segments.reduce((sum, segment) => sum + segment.durationMinutes, 0),
      stopTimeMinutes: 0,
      departureTime: `${date}T08:00:00.000Z`,
      arrivalTime: `${date}T10:00:00.000Z`,
    },
  };
}

function makeCanonicalDay(day: TripDay, flatIndex: number, originalIndex: number): CanonicalTripDay {
  return {
    meta: day,
    events: [
      {
        id: `evt-${day.dayNumber}`,
        type: 'arrival',
        arrivalTime: new Date(`${day.date}T10:00:00.000Z`),
        departureTime: new Date(`${day.date}T10:00:00.000Z`),
        durationMinutes: 0,
        distanceFromOriginKm: 200 * (day.dayNumber + 1),
        locationHint: day.route,
        stops: [],
        timezone: 'UTC',
        flatIndex,
        originalIndex,
        segment: day.segments[day.segments.length - 1],
      },
    ],
  };
}

describe('buildDayPlacementMaps', () => {
  it('keeps split driving days grouped on their original segment index for journal mode', () => {
    const day1 = makeDay(1, '2026-08-01', [makeSegment(LOC_A, LOC_B, 0)], [0]);
    const day2 = makeDay(2, '2026-08-02', [makeSegment(LOC_B, LOC_C, 0)], [0]);
    const freeDay = makeDay(3, '2026-08-03', [], []);
    const day4 = makeDay(4, '2026-08-04', [makeSegment(LOC_C, LOC_A, 1)], [1]);

    const canonicalDays: CanonicalTripDay[] = [
      makeCanonicalDay(day1, 0, 0),
      makeCanonicalDay(day2, 1, 0),
      { meta: freeDay, events: [] },
      makeCanonicalDay(day4, 2, 1),
    ];

    const { dayStartMap, freeDaysAfterSegment } = buildDayPlacementMaps(canonicalDays, 'original');

    expect(dayStartMap.get(0)?.map(entry => entry.day.dayNumber)).toEqual([1, 2]);
    expect(dayStartMap.get(0)?.[0].isFirst).toBe(true);
    expect(dayStartMap.get(0)?.[1].isFirst).toBe(false);
    expect(dayStartMap.get(1)?.map(entry => entry.day.dayNumber)).toEqual([4]);
    expect(freeDaysAfterSegment.get(0)?.map(day => day.dayNumber)).toEqual([3]);
  });

  it('uses flat indices for itinerary mode while keeping free days after the last driving segment', () => {
    const day1 = makeDay(1, '2026-08-01', [makeSegment(LOC_A, LOC_B, 0)], [0]);
    const day2 = makeDay(2, '2026-08-02', [makeSegment(LOC_B, LOC_C, 0)], [0]);
    const freeDay = makeDay(3, '2026-08-03', [], []);

    const canonicalDays: CanonicalTripDay[] = [
      makeCanonicalDay(day1, 0, 0),
      makeCanonicalDay(day2, 1, 0),
      { meta: freeDay, events: [] },
    ];

    const { dayStartMap, freeDaysAfterSegment } = buildDayPlacementMaps(canonicalDays, 'flat');

    expect(dayStartMap.get(0)?.map(entry => entry.day.dayNumber)).toEqual([1]);
    expect(dayStartMap.get(1)?.map(entry => entry.day.dayNumber)).toEqual([2]);
    expect(freeDaysAfterSegment.get(1)?.map(day => day.dayNumber)).toEqual([3]);
  });
});