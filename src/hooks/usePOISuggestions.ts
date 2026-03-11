import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Location, POISuggestion, TripPreference, TripSummary } from '../types';
import { fetchPOISuggestions } from '../lib/poi-service';
import { hashRouteKey } from '../lib/poi-service/cache';
import { buildPOISuggestionResults } from './usePOISuggestionHelpers';

interface UsePOISuggestionsOptions {
  routeGeometry?: [number, number][];
  segments?: TripSummary['segments'];
  origin?: Location;
  destination?: Location;
  tripPreferences?: TripPreference[];
  roundTripMidpoint?: number;
}

interface UsePOISuggestionsReturn {
  poiSuggestions: POISuggestion[];
  poiInference: POISuggestion[];
  isLoadingPOIs: boolean;
  poiPartialResults: boolean;
  poiFetchFailed: boolean;
  addPOI: (poiId: string) => void;
  dismissPOI: (poiId: string) => void;
  resetPOISuggestions: () => void;
}

export function usePOISuggestions({
  routeGeometry,
  segments,
  origin,
  destination,
  tripPreferences = [],
  roundTripMidpoint,
}: UsePOISuggestionsOptions = {}): UsePOISuggestionsReturn {
  // Local state for optimistic UI actions (added / dismissed)
  const [poiActions, setPoiActions] = useState<Record<string, 'added' | 'dismissed'>>({});
  const [lastRouteHash, setLastRouteHash] = useState<string | null>(null);

  const addPOI = useCallback((poiId: string) => {
    setPoiActions(prev => ({ ...prev, [poiId]: 'added' }));
  }, []);

  const dismissPOI = useCallback((poiId: string) => {
    setPoiActions(prev => ({ ...prev, [poiId]: 'dismissed' }));
  }, []);

  const resetPOISuggestions = useCallback(() => {
    setPoiActions({});
  }, []);

  // Use a stable query key based on geometry hash mapping
  const currentRouteHash = useMemo(() => {
    if (!routeGeometry || !destination) return null;
    return hashRouteKey(routeGeometry, destination, tripPreferences);
  }, [routeGeometry, destination, tripPreferences]);

  // Derive state asynchronously to avoid effect cascades.
  // If the route strictly changed, flush the recorded POI actions.
  if (currentRouteHash !== lastRouteHash) {
    setLastRouteHash(currentRouteHash);
    setPoiActions({});
  }

  const queryKey = useMemo(() => ['poiSuggestions', currentRouteHash], [currentRouteHash]);
  const enabled = !!routeGeometry && routeGeometry.length > 0 && !!origin && !!destination;

  const { data, isFetching: isLoadingPOIs, isError: poiFetchFailed } = useQuery({
    queryKey,
    queryFn: () => fetchPOISuggestions(routeGeometry!, origin!, destination!, tripPreferences),
    enabled,
    staleTime: 30 * 60 * 1000, // 30 minutes cache life
    refetchOnWindowFocus: false,
  });

  const poiPartialResults = !!data?.partialResults;

  // Derive final POIs by merging raw fetched data with local action state and UI filtering rules
  const { poiSuggestions, poiInference } = useMemo(() => {
    if (!data || !routeGeometry || !segments || !destination) {
      return { poiSuggestions: [], poiInference: [] };
    }

    const { suggestions: baseSuggestions, inference } = buildPOISuggestionResults({
      alongWay: data.alongWay,
      atDestination: data.atDestination,
      routeGeometry,
      segments,
      tripPreferences,
      destination,
      roundTripMidpoint,
    });

    const poiSuggestions = baseSuggestions.map(poi => {
      const action = poiActions[poi.id];
      if (action) return { ...poi, actionState: action };
      return poi;
    });

    return { poiSuggestions, poiInference: inference };
  }, [data, routeGeometry, segments, tripPreferences, destination, roundTripMidpoint, poiActions]);

  return {
    poiSuggestions,
    poiInference,
    isLoadingPOIs,
    poiPartialResults,
    poiFetchFailed,
    addPOI,
    dismissPOI,
    resetPOISuggestions,
  };
}