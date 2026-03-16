import { describe, expect, it } from 'vitest';
import { makeDay, makeSegment, makeSettings } from '../../test/fixtures';
import { analyzeTiming, analyzeDateWindow } from './analyze-timing';

// ── analyzeTiming — long push ─────────────────────────────────────────────────

describe('analyzeTiming — long uninterrupted segment', () => {
  it('adds a gentle heads-up for a very long uninterrupted segment', () => {
    const day = makeDay({
      dayNumber: 5,
      segments: [makeSegment({ durationMinutes: 507, distanceKm: 780, _originalIndex: 0 })],
      totals: {
        distanceKm: 780,
        driveTimeMinutes: 507,
        stopTimeMinutes: 0,
        departureTime: '2026-08-05T09:00:00',
        arrivalTime: '2026-08-05T17:27:00',
      },
    });

    const warnings = analyzeTiming([day], makeSettings({ stopFrequency: 'balanced' }));
    const longPush = warnings.find(
      warning => warning.category === 'timing' && warning.message.includes('Long uninterrupted stretch'),
    );

    expect(longPush).toBeDefined();
    expect(longPush?.message).toContain('Day 5');
    expect(longPush?.message).toContain('8h 27m');
    expect(longPush?.suggestion).toContain('3.5h');
  });

  it('does not warn when longest segment is under 6h (longPushHours)', () => {
    const day = makeDay({
      segments: [makeSegment({ durationMinutes: 300 })], // 5h
      totals: { distanceKm: 400, driveTimeMinutes: 300, stopTimeMinutes: 0, departureTime: '2026-08-05T09:00:00', arrivalTime: '2026-08-05T14:00:00' },
    });
    const warnings = analyzeTiming([day]);
    expect(warnings.filter(w => w.message.includes('Long uninterrupted'))).toHaveLength(0);
  });

  it('uses conservative comfortRefuel when stopFrequency is conservative', () => {
    const day = makeDay({
      segments: [makeSegment({ durationMinutes: 400 })], // 6h 40m → triggers
      totals: { distanceKm: 500, driveTimeMinutes: 400, stopTimeMinutes: 0, departureTime: '2026-08-05T09:00:00', arrivalTime: '2026-08-05T15:40:00' },
    });
    const warnings = analyzeTiming([day], makeSettings({ stopFrequency: 'conservative' }));
    const longPush = warnings.find(w => w.message.includes('Long uninterrupted'));
    expect(longPush).toBeDefined();
    expect(longPush?.suggestion).toContain('2.5h');
  });

  it('returns empty for an empty days array', () => {
    expect(analyzeTiming([])).toEqual([]);
  });
});

// ── analyzeTiming — late arrival ──────────────────────────────────────────────

describe('analyzeTiming — late arrival', () => {
  it('warns when arrival is at or after 10 PM', () => {
    const day = makeDay({
      totals: { distanceKm: 800, driveTimeMinutes: 600, stopTimeMinutes: 0, departureTime: '2026-08-05T09:00:00', arrivalTime: '2026-08-05T22:30:00' },
    });
    const warnings = analyzeTiming([day]);
    expect(warnings.some(w => w.message.includes('Late arrival'))).toBe(true);
  });

  it('does not warn when arrival is before 10 PM', () => {
    const day = makeDay({
      totals: { distanceKm: 400, driveTimeMinutes: 300, stopTimeMinutes: 0, departureTime: '2026-08-05T09:00:00', arrivalTime: '2026-08-05T21:59:00' },
    });
    const warnings = analyzeTiming([day]);
    expect(warnings.some(w => w.message.includes('Late arrival'))).toBe(false);
  });

  it('warns at info level when arrival exceeds targetArrivalHour but is before 10 PM', () => {
    const day = makeDay({
      totals: { distanceKm: 600, driveTimeMinutes: 480, stopTimeMinutes: 0, departureTime: '2026-08-05T09:00:00', arrivalTime: '2026-08-05T19:30:00' },
    });
    // targetArrivalHour=18 (6 PM), arrival at 7:30 PM — past target but before 10 PM
    const warnings = analyzeTiming([day], makeSettings({ targetArrivalHour: 18 }));
    const late = warnings.find(w => w.message.includes('Late arrival'));
    expect(late).toBeDefined();
    expect(late?.severity).toBe('info');
    expect(late?.detail).toContain('6 PM');
  });

  it('uses warning severity when arrival is past 10 PM regardless of target', () => {
    const day = makeDay({
      totals: { distanceKm: 800, driveTimeMinutes: 600, stopTimeMinutes: 0, departureTime: '2026-08-05T09:00:00', arrivalTime: '2026-08-05T23:00:00' },
    });
    const warnings = analyzeTiming([day], makeSettings({ targetArrivalHour: 18 }));
    const late = warnings.find(w => w.message.includes('Late arrival'));
    expect(late).toBeDefined();
    expect(late?.severity).toBe('warning');
  });

  it('does not warn when arrival is before the targetArrivalHour', () => {
    const day = makeDay({
      totals: { distanceKm: 400, driveTimeMinutes: 300, stopTimeMinutes: 0, departureTime: '2026-08-05T09:00:00', arrivalTime: '2026-08-05T17:00:00' },
    });
    const warnings = analyzeTiming([day], makeSettings({ targetArrivalHour: 18 }));
    expect(warnings.some(w => w.message.includes('Late arrival'))).toBe(false);
  });
});

// ── analyzeTiming — early departure ───────────────────────────────────────────

describe('analyzeTiming — early departure', () => {
  it('warns when departure is before 4 AM (and not midnight sentinel)', () => {
    const day = makeDay({
      totals: { distanceKm: 400, driveTimeMinutes: 240, stopTimeMinutes: 0, departureTime: '2026-08-05T03:30:00', arrivalTime: '2026-08-05T07:30:00' },
    });
    const warnings = analyzeTiming([day]);
    expect(warnings.some(w => w.message.includes('Early departure'))).toBe(true);
    expect(warnings.find(w => w.message.includes('Early departure'))?.severity).toBe('info');
  });

  it('skips the midnight sentinel (00:00)', () => {
    const day = makeDay({
      totals: { distanceKm: 200, driveTimeMinutes: 120, stopTimeMinutes: 0, departureTime: '2026-08-05T00:00:00', arrivalTime: '2026-08-05T02:00:00' },
    });
    const warnings = analyzeTiming([day]);
    expect(warnings.some(w => w.message.includes('Early departure'))).toBe(false);
  });

  it('skips early departure check on free days', () => {
    const day = makeDay({
      dayType: 'free' as TripDay['dayType'],
      totals: { distanceKm: 0, driveTimeMinutes: 0, stopTimeMinutes: 0, departureTime: '2026-08-05T02:00:00', arrivalTime: '' },
    });
    const warnings = analyzeTiming([day]);
    expect(warnings.some(w => w.message.includes('Early departure'))).toBe(false);
  });
});

// ── analyzeTiming — compressed rest ───────────────────────────────────────────

describe('analyzeTiming — compressed rest between days', () => {
  it('warns when rest between consecutive days is under 6h', () => {
    const day1 = makeDay({
      dayNumber: 1,
      totals: { distanceKm: 600, driveTimeMinutes: 480, stopTimeMinutes: 0, departureTime: '2026-08-05T09:00:00', arrivalTime: '2026-08-05T23:00:00' },
    });
    const day2 = makeDay({
      dayNumber: 2,
      totals: { distanceKm: 400, driveTimeMinutes: 300, stopTimeMinutes: 0, departureTime: '2026-08-06T04:30:00', arrivalTime: '2026-08-06T09:30:00' },
    });
    const warnings = analyzeTiming([day1, day2]);
    const rest = warnings.find(w => w.message.includes('rest'));
    expect(rest).toBeDefined();
    expect(rest?.severity).toBe('warning'); // 5.5h rest → warning (not critical)
  });

  it('critical severity when rest is under 4h', () => {
    const day1 = makeDay({
      dayNumber: 1,
      totals: { distanceKm: 600, driveTimeMinutes: 480, stopTimeMinutes: 0, departureTime: '2026-08-05T09:00:00', arrivalTime: '2026-08-06T01:00:00' },
    });
    const day2 = makeDay({
      dayNumber: 2,
      totals: { distanceKm: 400, driveTimeMinutes: 300, stopTimeMinutes: 0, departureTime: '2026-08-06T04:00:00', arrivalTime: '2026-08-06T09:00:00' },
    });
    const warnings = analyzeTiming([day1, day2]);
    const rest = warnings.find(w => w.message.includes('rest'));
    expect(rest?.severity).toBe('critical');
  });

  it('does not warn when rest is 6h or more', () => {
    const day1 = makeDay({
      dayNumber: 1,
      totals: { distanceKm: 400, driveTimeMinutes: 300, stopTimeMinutes: 0, departureTime: '2026-08-05T09:00:00', arrivalTime: '2026-08-05T20:00:00' },
    });
    const day2 = makeDay({
      dayNumber: 2,
      totals: { distanceKm: 400, driveTimeMinutes: 300, stopTimeMinutes: 0, departureTime: '2026-08-06T08:00:00', arrivalTime: '2026-08-06T13:00:00' },
    });
    const warnings = analyzeTiming([day1, day2]);
    expect(warnings.some(w => w.message.includes('rest'))).toBe(false);
  });

  it('skips rest check when next day is a free day', () => {
    const day1 = makeDay({
      dayNumber: 1,
      totals: { distanceKm: 600, driveTimeMinutes: 480, stopTimeMinutes: 0, departureTime: '2026-08-05T09:00:00', arrivalTime: '2026-08-05T23:00:00' },
    });
    const day2 = makeDay({
      dayNumber: 2,
      dayType: 'free' as TripDay['dayType'],
      totals: { distanceKm: 0, driveTimeMinutes: 0, stopTimeMinutes: 0, departureTime: '2026-08-06T04:00:00', arrivalTime: '' },
    });
    const warnings = analyzeTiming([day1, day2]);
    expect(warnings.some(w => w.message.includes('rest'))).toBe(false);
  });
});

// ── analyzeDateWindow ─────────────────────────────────────────────────────────

describe('analyzeDateWindow', () => {
  it('returns empty when both dates are missing', () => {
    const warnings = analyzeDateWindow([], makeSettings({ departureDate: '', returnDate: '' }));
    expect(warnings).toEqual([]);
  });

  it('warns round trip with no return date — no time at destination', () => {
    const warnings = analyzeDateWindow([], makeSettings({ isRoundTrip: true, returnDate: '' }));
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('no return date');
    expect(warnings[0].severity).toBe('warning');
  });

  it('critical warning when transit days exceed calendar days', () => {
    // 2 calendar days (Aug 16–17), but 3 transit days
    const days = [
      makeDay({ dayNumber: 1, segments: [makeSegment()] }),
      makeDay({ dayNumber: 2, segments: [makeSegment()] }),
      makeDay({ dayNumber: 3, segments: [makeSegment()] }),
    ];
    const warnings = analyzeDateWindow(days, makeSettings({ departureDate: '2026-08-16', returnDate: '2026-08-17' }));
    const overflow = warnings.find(w => w.category === 'date-window' && w.severity === 'critical');
    expect(overflow).toBeDefined();
    expect(overflow?.message).toContain('Trip extended');
  });

  it('warns when no free days on a multi-day trip', () => {
    // 3 calendar days (Aug 16–18) but 3 transit days → 0 free days
    const days = [
      makeDay({ dayNumber: 1, segments: [makeSegment()] }),
      makeDay({ dayNumber: 2, segments: [makeSegment()] }),
      makeDay({ dayNumber: 3, segments: [makeSegment()] }),
    ];
    const warnings = analyzeDateWindow(days, makeSettings({ departureDate: '2026-08-16', returnDate: '2026-08-18' }));
    expect(warnings.some(w => w.message.includes('No free days'))).toBe(true);
  });

  it('does not warn about 0 free days for single-day trips', () => {
    const days = [makeDay({ dayNumber: 1, segments: [makeSegment()] })];
    const warnings = analyzeDateWindow(days, makeSettings({ departureDate: '2026-08-16', returnDate: '2026-08-16' }));
    expect(warnings.some(w => w.message.includes('No free days'))).toBe(false);
  });

  it('info-level warning when only 1 free day on a long trip', () => {
    // 5 calendar days (Aug 16–20), 4 transit days → 1 free day
    const days = [
      makeDay({ dayNumber: 1, segments: [makeSegment()] }),
      makeDay({ dayNumber: 2, segments: [makeSegment()] }),
      makeDay({ dayNumber: 3, segments: [makeSegment()] }),
      makeDay({ dayNumber: 4, segments: [makeSegment()] }),
    ];
    const warnings = analyzeDateWindow(days, makeSettings({ departureDate: '2026-08-16', returnDate: '2026-08-20' }));
    expect(warnings.some(w => w.message.includes('Only 1 free day') && w.severity === 'info')).toBe(true);
  });

  it('no warning when plenty of free days', () => {
    // 7 calendar days (Aug 16–22), 2 transit days → 5 free days
    const days = [
      makeDay({ dayNumber: 1, segments: [makeSegment()] }),
      makeDay({ dayNumber: 2, segments: [makeSegment()] }),
    ];
    const warnings = analyzeDateWindow(days, makeSettings({ departureDate: '2026-08-16', returnDate: '2026-08-22' }));
    expect(warnings).toHaveLength(0);
  });

  it('excludes free days from transit count', () => {
    // 3 calendar days, 2 transit + 1 free → 1 free day remaining... but trip ≤ 3 days so no "only 1" warning
    const days = [
      makeDay({ dayNumber: 1, segments: [makeSegment()] }),
      makeDay({ dayNumber: 2, dayType: 'free' as TripDay['dayType'], segments: [] }),
      makeDay({ dayNumber: 3, segments: [makeSegment()] }),
    ];
    const warnings = analyzeDateWindow(days, makeSettings({ departureDate: '2026-08-16', returnDate: '2026-08-18' }));
    // 3 calendar days, 2 transit → 1 free, but trip is ≤3 days so no "only 1 free" warning
    expect(warnings.some(w => w.message.includes('No free days'))).toBe(false);
  });
});

// Need TripDay type for the dayType field
import type { TripDay } from '../../types';