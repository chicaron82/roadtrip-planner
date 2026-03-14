/**
 * poi-mutations.ts — unit tests for canonical POI add/dismiss helpers.
 *
 * Pure array transformers — no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import type { POISuggestion } from '../../types';
import { addPoiToTimeline, dismissPoi } from './poi-mutations';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePOI(id: string, actionState: POISuggestion['actionState'] = 'suggested'): POISuggestion {
  return {
    id, name: `Place ${id}`, lat: 49.9, lng: -97.2,
    category: 'gas',
    bucket: 'along-way',
    distanceFromRoute: 0.5,
    detourTimeMinutes: 5,
    rankingScore: 80,
    categoryMatchScore: 75,
    popularityScore: 70,
    timingFitScore: 65,
    actionState,
  };
}

// ─── addPoiToTimeline ─────────────────────────────────────────────────────────

describe('addPoiToTimeline', () => {
  it('transitions a pending POI to added', () => {
    const suggestions = [makePOI('a'), makePOI('b')];
    const result = addPoiToTimeline(suggestions, 'a');
    expect(result.find(p => p.id === 'a')?.actionState).toBe('added');
  });

  it('leaves other POIs unchanged', () => {
    const suggestions = [makePOI('a'), makePOI('b')];
    const result = addPoiToTimeline(suggestions, 'a');
    expect(result.find(p => p.id === 'b')?.actionState).toBe('suggested');
  });

  it('returns the same array reference when POI is already added (no-op)', () => {
    const suggestions = [makePOI('a', 'added')];
    expect(addPoiToTimeline(suggestions, 'a')).toBe(suggestions);
  });

  it('returns the same array reference when POI id is not found', () => {
    const suggestions = [makePOI('a')];
    expect(addPoiToTimeline(suggestions, 'does-not-exist')).toBe(suggestions);
  });

  it('returns a new array reference when a change is made', () => {
    const suggestions = [makePOI('a')];
    const result = addPoiToTimeline(suggestions, 'a');
    expect(result).not.toBe(suggestions);
  });

  it('preserves array length', () => {
    const suggestions = [makePOI('a'), makePOI('b'), makePOI('c')];
    expect(addPoiToTimeline(suggestions, 'b')).toHaveLength(3);
  });
});

// ─── dismissPoi ───────────────────────────────────────────────────────────────

describe('dismissPoi', () => {
  it('transitions a pending POI to dismissed', () => {
    const suggestions = [makePOI('x'), makePOI('y')];
    const result = dismissPoi(suggestions, 'x');
    expect(result.find(p => p.id === 'x')?.actionState).toBe('dismissed');
  });

  it('leaves other POIs unchanged', () => {
    const suggestions = [makePOI('x'), makePOI('y')];
    const result = dismissPoi(suggestions, 'x');
    expect(result.find(p => p.id === 'y')?.actionState).toBe('suggested');
  });

  it('returns the same array reference when POI is already dismissed (no-op)', () => {
    const suggestions = [makePOI('x', 'dismissed')];
    expect(dismissPoi(suggestions, 'x')).toBe(suggestions);
  });

  it('returns the same array reference when POI id is not found', () => {
    const suggestions = [makePOI('x')];
    expect(dismissPoi(suggestions, 'not-here')).toBe(suggestions);
  });

  it('returns a new array reference when a change is made', () => {
    const suggestions = [makePOI('x')];
    const result = dismissPoi(suggestions, 'x');
    expect(result).not.toBe(suggestions);
  });

  it('can dismiss a POI that was previously added', () => {
    const suggestions = [makePOI('x', 'added')];
    const result = dismissPoi(suggestions, 'x');
    expect(result.find(p => p.id === 'x')?.actionState).toBe('dismissed');
  });
});
