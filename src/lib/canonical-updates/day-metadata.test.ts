import { describe, it, expect } from 'vitest';
import type { TripDay } from '../../types';
import {
  updateDayNotes,
  updateDayTitle,
  updateDayType,
  updateDayMetadata,
} from './day-metadata';

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

// ─── updateDayNotes ───────────────────────────────────────────────────────────

describe('updateDayNotes', () => {
  it('sets notes on a day that has none', () => {
    const days = [makeDay(1)];
    const result = updateDayNotes(days, 1, 'Beach day 🌊');
    expect(result[0].notes).toBe('Beach day 🌊');
  });

  it('overwrites existing notes', () => {
    const days = [makeDay(1, { notes: 'old notes' })];
    const result = updateDayNotes(days, 1, 'new notes');
    expect(result[0].notes).toBe('new notes');
  });

  it('sets notes to empty string', () => {
    const days = [makeDay(1, { notes: 'something' })];
    const result = updateDayNotes(days, 1, '');
    expect(result[0].notes).toBe('');
  });

  it('returns the same array reference when dayNumber not found', () => {
    const days = [makeDay(1)];
    const result = updateDayNotes(days, 99, 'irrelevant');
    expect(result).toBe(days);
  });

  it('returns a new array reference when dayNumber is found', () => {
    const days = [makeDay(1)];
    const result = updateDayNotes(days, 1, 'notes');
    expect(result).not.toBe(days);
  });

  it('does not mutate the original array', () => {
    const days = [makeDay(1, { notes: 'original' })];
    updateDayNotes(days, 1, 'changed');
    expect(days[0].notes).toBe('original');
  });

  it('does not mutate the original day object', () => {
    const day = makeDay(1, { notes: 'original' });
    updateDayNotes([day], 1, 'changed');
    expect(day.notes).toBe('original');
  });

  it('only updates the target day in a multi-day array', () => {
    const days = [makeDay(1, { notes: 'day1' }), makeDay(2, { notes: 'day2' }), makeDay(3, { notes: 'day3' })];
    const result = updateDayNotes(days, 2, 'updated');
    expect(result[0].notes).toBe('day1');
    expect(result[1].notes).toBe('updated');
    expect(result[2].notes).toBe('day3');
  });

  it('preserves other day objects as the same reference (no unnecessary clones)', () => {
    const day1 = makeDay(1);
    const day2 = makeDay(2);
    const result = updateDayNotes([day1, day2], 1, 'notes');
    expect(result[1]).toBe(day2);
  });
});

// ─── updateDayTitle ───────────────────────────────────────────────────────────

describe('updateDayTitle', () => {
  it('sets title on a day', () => {
    const days = [makeDay(1)];
    const result = updateDayTitle(days, 1, "Let's Get Outta Here");
    expect(result[0].title).toBe("Let's Get Outta Here");
  });

  it('overwrites an existing title', () => {
    const days = [makeDay(1, { title: 'Old Title' })];
    const result = updateDayTitle(days, 1, 'New Title');
    expect(result[0].title).toBe('New Title');
  });

  it('returns same array reference when dayNumber not found', () => {
    const days = [makeDay(1)];
    const result = updateDayTitle(days, 5, 'unused');
    expect(result).toBe(days);
  });

  it('does not mutate the original day', () => {
    const day = makeDay(1, { title: 'Before' });
    updateDayTitle([day], 1, 'After');
    expect(day.title).toBe('Before');
  });

  it('only updates the target day', () => {
    const days = [makeDay(1, { title: 'Day 1' }), makeDay(2, { title: 'Day 2' })];
    const result = updateDayTitle(days, 2, 'Updated');
    expect(result[0].title).toBe('Day 1');
    expect(result[1].title).toBe('Updated');
  });
});

// ─── updateDayType ────────────────────────────────────────────────────────────

describe('updateDayType', () => {
  it('sets dayType to flexible', () => {
    const days = [makeDay(1)];
    const result = updateDayType(days, 1, 'flexible');
    expect(result[0].dayType).toBe('flexible');
  });

  it('sets dayType to free', () => {
    const days = [makeDay(1, { dayType: 'planned' })];
    const result = updateDayType(days, 1, 'free');
    expect(result[0].dayType).toBe('free');
  });

  it('sets dayType to planned', () => {
    const days = [makeDay(1, { dayType: 'flexible' })];
    const result = updateDayType(days, 1, 'planned');
    expect(result[0].dayType).toBe('planned');
  });

  it('returns same array reference when dayNumber not found', () => {
    const days = [makeDay(1)];
    const result = updateDayType(days, 99, 'flexible');
    expect(result).toBe(days);
  });

  it('does not mutate the original day', () => {
    const day = makeDay(1, { dayType: 'planned' });
    updateDayType([day], 1, 'free');
    expect(day.dayType).toBe('planned');
  });

  it('only modifies the target day', () => {
    const days = [makeDay(1, { dayType: 'planned' }), makeDay(2, { dayType: 'planned' })];
    const result = updateDayType(days, 1, 'flexible');
    expect(result[0].dayType).toBe('flexible');
    expect(result[1].dayType).toBe('planned');
  });
});

// ─── updateDayMetadata ────────────────────────────────────────────────────────

describe('updateDayMetadata', () => {
  it('updates title only', () => {
    const days = [makeDay(1, { notes: 'keep me' })];
    const result = updateDayMetadata(days, 1, { title: 'New Title' });
    expect(result[0].title).toBe('New Title');
    expect(result[0].notes).toBe('keep me');
  });

  it('updates notes only', () => {
    const days = [makeDay(1, { title: 'keep me' })];
    const result = updateDayMetadata(days, 1, { notes: 'fresh notes' });
    expect(result[0].notes).toBe('fresh notes');
    expect(result[0].title).toBe('keep me');
  });

  it('updates dayType only', () => {
    const days = [makeDay(1)];
    const result = updateDayMetadata(days, 1, { dayType: 'free' });
    expect(result[0].dayType).toBe('free');
  });

  it('updates all three fields at once', () => {
    const days = [makeDay(1)];
    const result = updateDayMetadata(days, 1, { title: 'T', notes: 'N', dayType: 'flexible' });
    expect(result[0].title).toBe('T');
    expect(result[0].notes).toBe('N');
    expect(result[0].dayType).toBe('flexible');
  });

  it('returns same array reference when dayNumber not found', () => {
    const days = [makeDay(1)];
    const result = updateDayMetadata(days, 42, { title: 'unused' });
    expect(result).toBe(days);
  });

  it('does not mutate the original array or day', () => {
    const day = makeDay(1, { title: 'original' });
    const days = [day];
    updateDayMetadata(days, 1, { title: 'changed' });
    expect(days[0].title).toBe('original');
    expect(day.title).toBe('original');
  });

  it('works with an empty patch object (no change to patched fields)', () => {
    const days = [makeDay(1, { title: 'keep' })];
    const result = updateDayMetadata(days, 1, {});
    // Day is still replaced (new object), but title preserved
    expect(result[0].title).toBe('keep');
  });

  it('only updates the target day in a multi-day array', () => {
    const days = [makeDay(1, { title: 'A' }), makeDay(2, { title: 'B' }), makeDay(3, { title: 'C' })];
    const result = updateDayMetadata(days, 2, { title: 'X' });
    expect(result[0].title).toBe('A');
    expect(result[1].title).toBe('X');
    expect(result[2].title).toBe('C');
  });

  it('handles non-sequential dayNumbers (finds by value, not index)', () => {
    const days = [makeDay(10, { title: 'ten' }), makeDay(20, { title: 'twenty' })];
    const result = updateDayMetadata(days, 20, { title: 'updated' });
    expect(result[0].title).toBe('ten');
    expect(result[1].title).toBe('updated');
  });
});
