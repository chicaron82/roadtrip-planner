import { describe, expect, it } from 'vitest';
import type { TripDay } from '../types';
import { shouldPropagateSnappedOvernightToNextDay } from './trip-calculation-helpers';

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