import { describe, expect, it } from 'vitest';
import { makeDay, makeSegment, makeSettings } from '../../test/fixtures';
import { analyzeTiming } from './analyze-timing';

describe('analyzeTiming', () => {
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
});