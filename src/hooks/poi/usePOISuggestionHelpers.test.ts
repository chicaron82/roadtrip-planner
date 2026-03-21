import { describe, expect, it } from 'vitest';
import type { Location, POISuggestion } from '../../types';
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

  it('returns empty array for empty input', () => {
    expect(groupRoundTripPOIs([], 2)).toEqual([]);
  });

  it('does not merge when categories differ even if locations overlap', () => {
    const outbound = makeSuggestion({ id: 'out', name: 'Gas', category: 'gas', lat: 49, lng: -97, segmentIndex: 0 });
    const returnLeg = makeSuggestion({ id: 'ret', name: 'Restaurant', category: 'restaurant', lat: 49.01, lng: -97.01, segmentIndex: 3 });

    const result = groupRoundTripPOIs([outbound, returnLeg], 2);
    expect(result).toHaveLength(2);
  });

  it('does not merge when location difference exceeds tolerance', () => {
    const outbound = makeSuggestion({ id: 'out', name: 'Gas A', category: 'gas', lat: 49, lng: -97, segmentIndex: 0 });
    const returnLeg = makeSuggestion({ id: 'ret', name: 'Gas B', category: 'gas', lat: 49.1, lng: -97.1, segmentIndex: 3 }); // > 0.025 lat

    const result = groupRoundTripPOIs([outbound, returnLeg], 2);
    expect(result).toHaveLength(2);
    expect(result[0].mirrorSegmentIndex).toBeUndefined();
  });

  it('preserves destination-bucket POIs at the end', () => {
    const along = makeSuggestion({ id: 'a', name: 'Along', category: 'gas', segmentIndex: 0 });
    const dest = makeSuggestion({ id: 'd', name: 'Dest', category: 'attraction', bucket: 'destination', segmentIndex: 1 });

    const result = groupRoundTripPOIs([along, dest], 2);
    expect(result[result.length - 1].id).toBe('d');
  });

  it('does not match a return POI to multiple outbound POIs (Set tracking)', () => {
    const out1 = makeSuggestion({ id: 'out1', name: 'Gas 1', category: 'gas', lat: 49, lng: -97, segmentIndex: 0 });
    const out2 = makeSuggestion({ id: 'out2', name: 'Gas 2', category: 'gas', lat: 49.01, lng: -97.01, segmentIndex: 1 });
    const ret = makeSuggestion({ id: 'ret', name: 'Gas Ret', category: 'gas', lat: 49.005, lng: -97.005, segmentIndex: 4 });

    const result = groupRoundTripPOIs([out1, out2, ret], 2);
    // Only one outbound should get the mirror, the other stays unmapped
    const mirrored = result.filter(p => p.mirrorSegmentIndex !== undefined);
    expect(mirrored).toHaveLength(1);
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

  it('returns a new array (does not mutate input)', () => {
    const original = [makeSuggestion({ id: 'a', name: 'A', category: 'gas' })];
    const result = setPOIActionState(original, 'a', 'dismissed');
    expect(result).not.toBe(original);
    expect(original[0].actionState).toBe('suggested'); // original unchanged
  });

  it('leaves all POIs unchanged when id does not match', () => {
    const pois = [makeSuggestion({ id: 'a', name: 'A', category: 'gas' })];
    const result = setPOIActionState(pois, 'nonexistent', 'added');
    expect(result[0].actionState).toBe('suggested');
  });

  it('preserves user state and notes across reranks', () => {
    const next = [makeSuggestion({ id: 'x', name: 'X', category: 'restaurant' })];
    const previous = [makeSuggestion({ id: 'x', name: 'X', category: 'restaurant', actionState: 'dismissed', userNotes: 'skip' })];

    const result = preservePOIActionState(next, previous);
    expect(result[0].actionState).toBe('dismissed');
    expect(result[0].userNotes).toBe('skip');
  });

  it('keeps default state for new POIs not in previous array', () => {
    const next = [makeSuggestion({ id: 'new', name: 'New', category: 'gas' })];
    const previous = [makeSuggestion({ id: 'old', name: 'Old', category: 'gas', actionState: 'added' })];

    const result = preservePOIActionState(next, previous);
    expect(result[0].actionState).toBe('suggested');
  });

  it('handles empty previous array gracefully', () => {
    const next = [makeSuggestion({ id: 'a', name: 'A', category: 'gas' })];
    const result = preservePOIActionState(next, []);
    expect(result[0].actionState).toBe('suggested');
  });

  it('handles empty next array gracefully', () => {
    const result = preservePOIActionState([], [makeSuggestion({ id: 'a', name: 'A', category: 'gas' })]);
    expect(result).toEqual([]);
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

  it('includes both along-way and destination POIs in suggestions', () => {
    const result = buildPOISuggestionResults({
      alongWay: [makeSuggestion({ id: 'along-1', name: 'Along 1', category: 'gas' })],
      atDestination: [makeSuggestion({ id: 'dest-1', name: 'Dest 1', category: 'attraction', bucket: 'destination' })],
      routeGeometry: [[49, -97], [49.5, -96.5]],
      segments: [],
      tripPreferences: [],
      destination,
    });

    const ids = result.suggestions.map(s => s.id);
    expect(ids).toContain('along-1');
    expect(ids).toContain('dest-1');
  });

  it('applies round-trip grouping only when roundTripMidpoint is provided', () => {
    const out = makeSuggestion({ id: 'out', name: 'Gas', category: 'gas', lat: 49, lng: -97, segmentIndex: 0 });
    const ret = makeSuggestion({ id: 'ret', name: 'Gas Ret', category: 'gas', lat: 49.01, lng: -97.01, segmentIndex: 3 });

    const withMidpoint = buildPOISuggestionResults({
      alongWay: [out, ret],
      atDestination: [],
      routeGeometry: [[49, -97], [49.5, -96.5]],
      segments: [],
      tripPreferences: [],
      destination,
      roundTripMidpoint: 2,
    });

    const withoutMidpoint = buildPOISuggestionResults({
      alongWay: [out, ret],
      atDestination: [],
      routeGeometry: [[49, -97], [49.5, -96.5]],
      segments: [],
      tripPreferences: [],
      destination,
    });

    // With midpoint: merged → fewer results
    expect(withMidpoint.suggestions.length).toBeLessThanOrEqual(withoutMidpoint.suggestions.length);
  });

  it('inference excludes non-utility categories like museum, viewpoint', () => {
    const result = buildPOISuggestionResults({
      alongWay: [
        makeSuggestion({ id: 'museum-1', name: 'Museum', category: 'museum' }),
        makeSuggestion({ id: 'viewpoint-1', name: 'Viewpoint', category: 'viewpoint' }),
      ],
      atDestination: [],
      routeGeometry: [[49, -97], [49.5, -96.5]],
      segments: [],
      tripPreferences: [],
      destination,
    });

    expect(result.inference).toHaveLength(0);
  });

  it('inference does not include destination-bucket POIs', () => {
    const result = buildPOISuggestionResults({
      alongWay: [],
      atDestination: [makeSuggestion({ id: 'dest-gas', name: 'Dest Gas', category: 'gas', bucket: 'destination' })],
      routeGeometry: [[49, -97], [49.5, -96.5]],
      segments: [],
      tripPreferences: [],
      destination,
    });

    expect(result.inference).toHaveLength(0);
  });

  it('handles empty along-way and destination arrays', () => {
    const result = buildPOISuggestionResults({
      alongWay: [],
      atDestination: [],
      routeGeometry: [[49, -97], [49.5, -96.5]],
      segments: [],
      tripPreferences: [],
      destination,
    });

    expect(result.suggestions).toEqual([]);
    expect(result.inference).toEqual([]);
  });
});