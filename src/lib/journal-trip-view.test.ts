import { describe, expect, it } from 'vitest';
import { applyStopOverrides, resolveJournalEntryLocation } from './journal-trip-view';
import { makeLocation, makeSegment, makeSummary } from '../test/fixtures';

describe('journal-trip-view helpers', () => {
  it('resolves journal entry locations by stable stopId before segment index fallback', () => {
    const firstStop = { ...makeLocation('First Stop'), id: 'first-stop' };
    const actualStop = { ...makeLocation('Actual Stop'), id: 'actual-stop' };
    const summary = makeSummary({
      segments: [
        makeSegment({ to: firstStop, _originalIndex: 0 }),
        makeSegment({ to: actualStop, _originalIndex: 1 }),
      ],
    });

    const resolved = resolveJournalEntryLocation(summary, {
      stopId: 'actual-stop',
      segmentIndex: 0,
    });

    expect(resolved?.name).toBe('Actual Stop');
  });

  it('applies persisted stop overrides without inventing new stop truth', () => {
    const suggestions = [
      {
        id: 'fuel-1',
        type: 'fuel' as const,
        reason: 'Fuel',
        afterSegmentIndex: 0,
        estimatedTime: new Date('2025-08-16T11:00:00Z'),
        duration: 15,
        priority: 'recommended' as const,
        details: {},
        accepted: false,
        dismissed: false,
      },
      {
        id: 'meal-1',
        type: 'meal' as const,
        reason: 'Meal',
        afterSegmentIndex: 0,
        estimatedTime: new Date('2025-08-16T12:00:00Z'),
        duration: 45,
        priority: 'optional' as const,
        details: {},
        accepted: false,
        dismissed: false,
      },
    ];

    const applied = applyStopOverrides(suggestions, {
      'fuel-1': { accepted: true, duration: 20 },
      'meal-1': { dismissed: true },
    });

    expect(applied[0].accepted).toBe(true);
    expect(applied[0].duration).toBe(20);
    expect(applied[1].dismissed).toBe(true);
  });
});