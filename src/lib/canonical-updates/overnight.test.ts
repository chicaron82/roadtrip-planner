import { describe, it, expect } from 'vitest';
import type { TripDay, OvernightStop } from '../../types';
import { updateOvernight } from './overnight';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeDay(dayNumber: number, overrides: Partial<TripDay> = {}): TripDay {
  return {
    dayNumber,
    date: '2025-08-16',
    dateFormatted: 'Sat, Aug 16',
    route: 'A → B',
    segments: [],
    segmentIndices: [],
    timezoneChanges: [],
    budget: { gasUsed: 0, hotelCost: 0, foodEstimate: 0, miscCost: 0, dayTotal: 0, bankRemaining: 1000 },
    totals: { distanceKm: 0, driveTimeMinutes: 0, stopTimeMinutes: 0, departureTime: '2025-08-16T08:00:00', arrivalTime: '2025-08-16T16:00:00' },
    ...overrides,
  };
}

function makeOvernight(overrides: Partial<OvernightStop> = {}): OvernightStop {
  return {
    location: { id: 'hotel-1', name: 'Comfort Inn', lat: 49.895, lng: -97.138, type: 'waypoint' },
    cost: 120,
    roomsNeeded: 1,
    ...overrides,
  };
}

// ─── updateOvernight ──────────────────────────────────────────────────────────

describe('updateOvernight', () => {
  it('sets overnight on a day with no existing overnight', () => {
    const days = [makeDay(1)];
    const overnight = makeOvernight();
    const result = updateOvernight(days, 1, overnight);
    expect(result[0].overnight).toEqual(overnight);
  });

  it('replaces an existing overnight stop', () => {
    const old = makeOvernight({ hotelName: 'Budget Inn', cost: 80 });
    const days = [makeDay(1, { overnight: old })];
    const replacement = makeOvernight({ hotelName: 'Grand Hotel', cost: 250 });
    const result = updateOvernight(days, 1, replacement);
    expect(result[0].overnight?.hotelName).toBe('Grand Hotel');
    expect(result[0].overnight?.cost).toBe(250);
  });

  it('returns the same array reference when dayNumber not found', () => {
    const days = [makeDay(1)];
    const result = updateOvernight(days, 99, makeOvernight());
    expect(result).toBe(days);
  });

  it('returns a new array reference when dayNumber is found', () => {
    const days = [makeDay(1)];
    const result = updateOvernight(days, 1, makeOvernight());
    expect(result).not.toBe(days);
  });

  it('does not mutate the original array', () => {
    const days = [makeDay(1)];
    const original0 = days[0];
    updateOvernight(days, 1, makeOvernight());
    expect(days[0]).toBe(original0);
    expect(days[0].overnight).toBeUndefined();
  });

  it('does not mutate the original day object', () => {
    const day = makeDay(1);
    updateOvernight([day], 1, makeOvernight());
    expect(day.overnight).toBeUndefined();
  });

  it('returns a new day object (not the same reference)', () => {
    const day = makeDay(1);
    const days = [day];
    const result = updateOvernight(days, 1, makeOvernight());
    expect(result[0]).not.toBe(day);
  });

  it('only updates the target day in a multi-day array', () => {
    const days = [makeDay(1), makeDay(2), makeDay(3)];
    const overnight = makeOvernight({ hotelName: 'Lake House' });
    const result = updateOvernight(days, 2, overnight);
    expect(result[0].overnight).toBeUndefined();
    expect(result[1].overnight?.hotelName).toBe('Lake House');
    expect(result[2].overnight).toBeUndefined();
  });

  it('preserves untouched day objects as the same reference', () => {
    const day1 = makeDay(1);
    const day2 = makeDay(2);
    const day3 = makeDay(3);
    const result = updateOvernight([day1, day2, day3], 2, makeOvernight());
    expect(result[0]).toBe(day1);
    expect(result[2]).toBe(day3);
  });

  it('handles an overnight with all optional fields populated', () => {
    const days = [makeDay(1)];
    const full = makeOvernight({
      accommodationType: 'hotel',
      hotelName: 'Grand Chalet',
      address: '123 Main St',
      cost: 200,
      roomsNeeded: 2,
      amenities: ['breakfast', 'pool'],
      checkIn: '3:00 PM',
      checkOut: '11:00 AM',
      notes: 'Quiet rooms requested',
    });
    const result = updateOvernight(days, 1, full);
    expect(result[0].overnight).toEqual(full);
  });

  it('handles dayNumber 0 (does not exist, no-op)', () => {
    const days = [makeDay(1)];
    const result = updateOvernight(days, 0, makeOvernight());
    expect(result).toBe(days);
  });

  it('handles an empty array (no-op, returns empty array)', () => {
    const days: TripDay[] = [];
    const result = updateOvernight(days, 1, makeOvernight());
    expect(result).toBe(days);
    expect(result).toHaveLength(0);
  });

  it('updates the first day in the array (dayNumber 1)', () => {
    const days = [makeDay(1), makeDay(2)];
    const result = updateOvernight(days, 1, makeOvernight({ hotelName: 'First Night' }));
    expect(result[0].overnight?.hotelName).toBe('First Night');
    expect(result[1].overnight).toBeUndefined();
  });

  it('updates the last day in the array', () => {
    const days = [makeDay(1), makeDay(2), makeDay(3)];
    const result = updateOvernight(days, 3, makeOvernight({ hotelName: 'Last Night' }));
    expect(result[2].overnight?.hotelName).toBe('Last Night');
    expect(result[0].overnight).toBeUndefined();
    expect(result[1].overnight).toBeUndefined();
  });

  it('preserves all other fields on the updated day', () => {
    const day = makeDay(1, { title: 'Beach Day', notes: 'Sunscreen!', dayType: 'flexible' });
    const result = updateOvernight([day], 1, makeOvernight());
    expect(result[0].title).toBe('Beach Day');
    expect(result[0].notes).toBe('Sunscreen!');
    expect(result[0].dayType).toBe('flexible');
  });
});
