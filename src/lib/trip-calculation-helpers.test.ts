import { describe, expect, it } from 'vitest';
import type { CanonicalTripTimeline } from './canonical-trip';
import type { TripDay } from '../types';
import { applySnappedOvernightsToCanonicalTimeline, shouldPropagateSnappedOvernightToNextDay } from './trip-calculation-helpers';

function makeDay(route: string, fromName: string): TripDay {
  return {
    dayNumber: 2,
    date: '2026-03-08',
    dateFormatted: 'Sun, Mar 8',
    route,
    segments: [{
      _originalIndex: 1,
      from: { id: 'from', name: fromName, lat: 46.4, lng: -86.65, type: 'waypoint' },
      to: { id: 'to', name: 'Montreal, Quebec', lat: 45.5, lng: -73.56, type: 'destination' },
      distanceKm: 1158,
      durationMinutes: 786,
      fuelNeededLitres: 80,
      fuelCost: 105,
    }],
    segmentIndices: [1],
    timezoneChanges: [],
    budget: {
      gasUsed: 105,
      hotelCost: 300,
      foodEstimate: 200,
      miscCost: 0,
      dayTotal: 605,
      gasRemaining: 665,
      hotelRemaining: 625,
      foodRemaining: 675,
    },
    totals: {
      distanceKm: 1158,
      driveTimeMinutes: 786,
      stopTimeMinutes: 0,
      departureTime: '2026-03-08T12:00:00.000Z',
      arrivalTime: '2026-03-09T01:06:00.000Z',
    },
  };
}

describe('shouldPropagateSnappedOvernightToNextDay', () => {
  it('propagates when the next day still uses the Overnight Stop placeholder', () => {
    expect(shouldPropagateSnappedOvernightToNextDay(makeDay('Overnight Stop → Montreal, Quebec', 'Overnight Stop'))).toBe(true);
  });

  it('propagates when the next day route still uses an En route fallback', () => {
    expect(shouldPropagateSnappedOvernightToNextDay(makeDay('En route from Winnipeg → Montreal, Quebec', 'Winnipeg → Montreal (transit)'))).toBe(true);
  });

  it('does not propagate when the next day already has a real snapped departure city', () => {
    expect(shouldPropagateSnappedOvernightToNextDay(makeDay('Munising → Montreal, Quebec', 'Munising'))).toBe(false);
  });
});

describe('applySnappedOvernightsToCanonicalTimeline', () => {
  it('updates overnight and next-day departure labels used by print/export', () => {
    const dayOne = makeDay('El Paso, TX → Disneyland → Walt Disney World (transit)', 'El Paso, TX');
    dayOne.dayNumber = 2;
    dayOne.overnight = {
      location: { id: 'split', name: 'Disneyland → Walt Disney World (transit)', lat: 30, lng: -94, type: 'waypoint' },
      cost: 120,
      roomsNeeded: 1,
    };

    const dayTwo = makeDay('En route from Disneyland → Walt Disney World, Florida', 'Disneyland → Walt Disney World (transit)');
    dayTwo.dayNumber = 3;

    const timeline: CanonicalTripTimeline = {
      summary: { segments: [], days: [dayOne, dayTwo] } as never,
      days: [
        {
          meta: dayOne,
          events: [
            {
              id: 'overnight-day2',
              type: 'overnight',
              arrivalTime: new Date('2026-03-09T03:00:00.000Z'),
              departureTime: new Date('2026-03-09T15:00:00.000Z'),
              durationMinutes: 720,
              distanceFromOriginKm: 100,
              locationHint: 'Disneyland → Walt Disney World (transit)',
              stops: [],
              timezone: 'America/Chicago',
            },
          ],
        },
        {
          meta: dayTwo,
          events: [
            {
              id: 'departure-day3',
              type: 'departure',
              arrivalTime: new Date('2026-03-09T15:00:00.000Z'),
              departureTime: new Date('2026-03-09T15:00:00.000Z'),
              durationMinutes: 0,
              distanceFromOriginKm: 100,
              locationHint: 'En route from Disneyland',
              stops: [],
              timezone: 'America/Chicago',
            },
          ],
        },
      ],
      events: [],
      inputs: { locations: [], vehicle: {} as never, settings: {} as never },
    };

    const updatedSummary = { ...timeline.summary, days: [dayOne, dayTwo] } as never;
    const updated = applySnappedOvernightsToCanonicalTimeline(timeline, updatedSummary, [
      { dayNumber: 2, lat: 30.22, lng: -93.22, name: 'Lake Charles, LA' },
    ]);

    expect(updated.days[0].meta.route).toBe('El Paso, TX → Lake Charles, LA');
    expect(updated.days[0].events[0].locationHint).toBe('Lake Charles, LA');
    expect(updated.days[1].meta.route).toBe('Lake Charles, LA → Walt Disney World, Florida');
    expect(updated.days[1].meta.segments[0].from.name).toBe('Lake Charles, LA');
    expect(updated.days[1].events[0].locationHint).toBe('Lake Charles, LA');
  });
});