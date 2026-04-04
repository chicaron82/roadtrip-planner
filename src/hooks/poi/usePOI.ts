import { useCallback } from 'react';
import type { POISuggestion, TripSummary, TripPreference, Location } from '../../types';
import { usePOISuggestions } from './usePOISuggestions';

interface UsePOIOptions {
  routeGeometry?: [number, number][];
  summary?: TripSummary | null;
  origin?: Location;
  destination?: Location;
  tripPreferences?: TripPreference[];
  roundTripMidpoint?: number;
}

interface UsePOIReturn {
  // POI Suggestions (route-based, ranked/trimmed for SmartTimeline)
  poiSuggestions: POISuggestion[];

  // Inference corpus (unranked gas/hotel/restaurant/cafe — for Tier-2 hub detection)
  poiInference: POISuggestion[];

  // Actions
  clearError: () => void;
  resetPOIs: () => void;
}

export function usePOI({
  routeGeometry,
  summary,
  origin,
  destination,
  tripPreferences = [],
  roundTripMidpoint,
}: UsePOIOptions = {}): UsePOIReturn {
  const {
    poiSuggestions,
    poiInference,
    resetPOISuggestions,
  } = usePOISuggestions({
    routeGeometry,
    summary,
    origin,
    destination,
    tripPreferences,
    roundTripMidpoint,
  });

  const clearError = useCallback(() => {}, []);

  const resetPOIs = useCallback(() => {
    resetPOISuggestions();
  }, [resetPOISuggestions]);

  return {
    poiSuggestions,
    poiInference,
    clearError,
    resetPOIs,
  };
}
