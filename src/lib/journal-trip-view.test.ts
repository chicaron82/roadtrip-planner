import { describe, expect, it } from 'vitest';
import {
  applyStopOverrides,
  buildJournalTimelineStops,
  findJournalEntry,
  resolveJournalEntryLocation,
  resolveJournalTimelineStop,
} from './journal-trip-view';
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

  it('builds journal timeline stops from projected stop items instead of raw summary order', () => {
    const guardSegment = makeSegment({
      to: { ...makeLocation('Guard'), id: 'guard-border-hop' },
      _originalIndex: 1,
    });
    const actualSegment = makeSegment({
      to: { ...makeLocation('Actual Stop'), id: 'actual-stop' },
      _originalIndex: 2,
    });

    const stops = buildJournalTimelineStops([
      {
        type: 'stop',
        segment: guardSegment,
        arrivalTime: new Date('2025-08-16T10:00:00Z'),
        index: 1,
        originalIndex: 1,
      },
      {
        type: 'stop',
        segment: actualSegment,
        arrivalTime: new Date('2025-08-16T12:00:00Z'),
        index: 3,
        originalIndex: 2,
      },
    ]);

    expect(stops).toEqual([
      {
        flatIndex: 3,
        originalIndex: 2,
        segment: actualSegment,
      },
    ]);
  });

  it('finds projected journal stops and entries by accepted-itinerary-backed identity first', () => {
    const actualSegment = makeSegment({
      to: { ...makeLocation('Actual Stop'), id: 'actual-stop' },
      _originalIndex: 4,
    });
    const stops = [{
      flatIndex: 7,
      originalIndex: 4,
      segment: actualSegment,
    }];

    const stop = resolveJournalTimelineStop(stops, 4);
    const entry = findJournalEntry([
      {
        id: 'entry-actual-stop',
        stopId: 'actual-stop',
        segmentIndex: 1,
        photos: [],
        notes: '',
        status: 'planned',
        isHighlight: false,
        createdAt: new Date('2025-08-16T09:00:00Z'),
        updatedAt: new Date('2025-08-16T09:00:00Z'),
      },
    ], stop);

    expect(stop).toEqual(stops[0]);
    expect(entry?.stopId).toBe('actual-stop');
    expect(entry?.segmentIndex).toBe(1);
  });
});