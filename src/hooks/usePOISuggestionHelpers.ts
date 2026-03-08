import type { Location, POISuggestion, TripPreference, TripSummary } from '../types';
import { rankAndFilterPOIs, rankDestinationPOIs } from '../lib/poi-ranking';

const UTILITY_CATEGORIES = new Set(['gas', 'restaurant', 'cafe', 'hotel']);

/**
 * Merge along-way POIs that appear on both the outbound and return legs
 * of a round trip into a single suggestion with mirrorSegmentIndex.
 */
export function groupRoundTripPOIs(
  pois: POISuggestion[],
  roundTripMidpoint: number,
): POISuggestion[] {
  const outbound = pois.filter(poi => poi.bucket === 'along-way' && (poi.segmentIndex ?? 0) < roundTripMidpoint);
  const returnLeg = pois.filter(poi => poi.bucket === 'along-way' && (poi.segmentIndex ?? 0) >= roundTripMidpoint);
  const destination = pois.filter(poi => poi.bucket === 'destination');
  const usedReturnIds = new Set<string>();

  const merged = outbound.map(outboundPoi => {
    for (const returnPoi of returnLeg) {
      if (usedReturnIds.has(returnPoi.id)) continue;
      if (returnPoi.category !== outboundPoi.category) continue;
      if (Math.abs(returnPoi.lat - outboundPoi.lat) < 0.025 && Math.abs(returnPoi.lng - outboundPoi.lng) < 0.04) {
        usedReturnIds.add(returnPoi.id);
        return { ...outboundPoi, mirrorSegmentIndex: returnPoi.segmentIndex };
      }
    }

    return outboundPoi;
  });

  const unmatchedReturn = returnLeg.filter(poi => !usedReturnIds.has(poi.id));
  return [...merged, ...unmatchedReturn, ...destination];
}

export function setPOIActionState(
  suggestions: POISuggestion[],
  poiId: string,
  actionState: POISuggestion['actionState'],
): POISuggestion[] {
  return suggestions.map(poi => poi.id === poiId ? { ...poi, actionState } : poi);
}

export function preservePOIActionState(
  nextSuggestions: POISuggestion[],
  previousSuggestions: POISuggestion[],
): POISuggestion[] {
  return nextSuggestions.map(next => {
    const existing = previousSuggestions.find(previous => previous.id === next.id);
    return existing
      ? { ...next, actionState: existing.actionState, userNotes: existing.userNotes }
      : next;
  });
}

interface BuildPOISuggestionResultsParams {
  alongWay: POISuggestion[];
  atDestination: POISuggestion[];
  routeGeometry: [number, number][];
  segments: TripSummary['segments'];
  tripPreferences: TripPreference[];
  destination: Location;
  roundTripMidpoint?: number;
}

export function buildPOISuggestionResults({
  alongWay,
  atDestination,
  routeGeometry,
  segments,
  tripPreferences,
  destination,
  roundTripMidpoint,
}: BuildPOISuggestionResultsParams): { suggestions: POISuggestion[]; inference: POISuggestion[] } {
  const rankedAlongWay = rankAndFilterPOIs(alongWay, routeGeometry, segments, tripPreferences, 15);
  const rankedDestination = rankDestinationPOIs(
    atDestination,
    tripPreferences,
    { lat: destination.lat!, lng: destination.lng! },
    8,
  );

  const combined = [...rankedAlongWay, ...rankedDestination];
  const suggestions = roundTripMidpoint
    ? groupRoundTripPOIs(combined, roundTripMidpoint)
    : combined;

  return {
    suggestions,
    inference: alongWay.filter(poi => UTILITY_CATEGORIES.has(poi.category)),
  };
}