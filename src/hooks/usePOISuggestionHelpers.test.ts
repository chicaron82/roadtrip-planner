import { describe, expect, it } from 'vitest';
import type { Location, POISuggestion } from '../types';
import {
  buildPOISuggestionResults,
  groupRoundTripPOIs,
  preservePOIActionState,
  setPOIActionState,
} from './usePOISuggestionHelpers';

const destination: Location = {
  id: 'dest',
  name: 'Destination',
  lat: 49,
  lng: -97,
  type: 'waypoint',
};

function makeSuggestion(overrides: Partial<POISuggestion> & Pick<POISuggestion, 'id' | 'name' | 'category'>): POISuggestion {
  return {
    id: overrides.id,
    name: overrides.name,
    category: overrides.category,
    lat: overrides.lat ?? 49,
    lng: overrides.lng ?? -97,
    bucket: overrides.bucket ?? 'along-way',
    distanceFromRoute: overrides.distanceFromRoute ?? 0.5,
    detourTimeMinutes: overrides.detourTimeMinutes ?? 5,
    segmentIndex: overrides.segmentIndex ?? 0,
    rankingScore: overrides.rankingScore ?? 90,
    categoryMatchScore: overrides.categoryMatchScore ?? 80,
    popularityScore: overrides.popularityScore ?? 70,
    timingFitScore: overrides.timingFitScore ?? 75,
    actionState: overrides.actionState ?? 'suggested',
    address: overrides.address,
    estimatedArrivalTime: overrides.estimatedArrivalTime,
    fitsInBreakWindow: overrides.fitsInBreakWindow,
    userNotes: overrides.userNotes,
    mirrorSegmentIndex: overrides.mirrorSegmentIndex,
    osmId: overrides.osmId,
    osmType: overrides.osmType,
    tags: overrides.tags,
  };
}

describe('groupRoundTripPOIs', () => {
  it('merges mirrored outbound and return suggestions', () => {
    const outbound = makeSuggestion({ id: 'out', name: 'Cafe', category: 'cafe', lat: 49, lng: -97, segmentIndex: 0 });
    const returnLeg = makeSuggestion({ id: 'ret', name: 'Cafe Return', category: 'cafe', lat: 49.01, lng: -97.01, segmentIndex: 3 });

    const result = groupRoundTripPOIs([outbound, returnLeg], 2);
    expect(result).toHaveLength(1);
    expect(result[0].mirrorSegmentIndex).toBe(3);
  });

  it('keeps unmatched return-leg suggestions', () => {
    const outbound = makeSuggestion({ id: 'out', name: 'Museum', category: 'museum', segmentIndex: 0 });
    const returnLeg = makeSuggestion({ id: 'ret', name: 'Gas Return', category: 'gas', segmentIndex: 3 });

    const result = groupRoundTripPOIs([outbound, returnLeg], 2);
    expect(result.map(poi => poi.id)).toEqual(['out', 'ret']);
  });
});

describe('POI action-state helpers', () => {
  it('updates a single POI action state', () => {
    const result = setPOIActionState([
      makeSuggestion({ id: 'a', name: 'A', category: 'gas' }),
      makeSuggestion({ id: 'b', name: 'B', category: 'hotel' }),
    ], 'b', 'added');

    expect(result.find(poi => poi.id === 'a')?.actionState).toBe('suggested');
    expect(result.find(poi => poi.id === 'b')?.actionState).toBe('added');
  });

  it('preserves user state and notes across reranks', () => {
    const next = [makeSuggestion({ id: 'x', name: 'X', category: 'restaurant' })];
    const previous = [makeSuggestion({ id: 'x', name: 'X', category: 'restaurant', actionState: 'dismissed', userNotes: 'skip' })];

    const result = preservePOIActionState(next, previous);
    expect(result[0].actionState).toBe('dismissed');
    expect(result[0].userNotes).toBe('skip');
  });
});

describe('buildPOISuggestionResults', () => {
  it('derives inference corpus from utility categories only', () => {
    const alongWay = [
      makeSuggestion({ id: 'gas-1', name: 'Fuel', category: 'gas' }),
      makeSuggestion({ id: 'cafe-1', name: 'Cafe', category: 'cafe' }),
      makeSuggestion({ id: 'museum-1', name: 'Museum', category: 'museum' }),
    ];

    const result = buildPOISuggestionResults({
      alongWay,
      atDestination: [makeSuggestion({ id: 'dest-1', name: 'Attraction', category: 'attraction', bucket: 'destination' })],
      routeGeometry: [[49, -97], [49.5, -96.5]],
      segments: [],
      tripPreferences: ['foodie'],
      destination,
    });

    expect(result.inference.map(poi => poi.id).sort()).toEqual(['cafe-1', 'gas-1']);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});