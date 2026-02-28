import { useState, useCallback, useRef } from 'react';
import type { Location, POI, POICategory, MarkerCategory, POISuggestion, TripSummary, TripPreference } from '../types';
import { searchNearbyPOIs, searchPOIsAlongRoute } from '../lib/poi';
import { fetchPOISuggestions } from '../lib/poi-service';
import { rankAndFilterPOIs, rankDestinationPOIs } from '../lib/poi-ranking';

/**
 * Merge along-way POIs that appear on both the outbound and return legs
 * of a round trip into a single suggestion with mirrorSegmentIndex.
 * POIs within 2km, same category, one outbound + one return → merged.
 * Unmatched return-leg POIs are kept so the user can still discover them.
 */
function groupRoundTripPOIs(
  pois: POISuggestion[],
  roundTripMidpoint: number
): POISuggestion[] {
  const outbound = pois.filter(p => p.bucket === 'along-way' && (p.segmentIndex ?? 0) < roundTripMidpoint);
  const returnLeg = pois.filter(p => p.bucket === 'along-way' && (p.segmentIndex ?? 0) >= roundTripMidpoint);
  const destination = pois.filter(p => p.bucket === 'destination');

  const usedReturnIds = new Set<string>();

  const merged = outbound.map(outPOI => {
    for (const retPOI of returnLeg) {
      if (usedReturnIds.has(retPOI.id)) continue;
      if (retPOI.category !== outPOI.category) continue;
      // ~2km threshold using flat-earth: |Δlat|<0.025° AND |Δlng|<0.04°
      if (Math.abs(retPOI.lat - outPOI.lat) < 0.025 && Math.abs(retPOI.lng - outPOI.lng) < 0.04) {
        usedReturnIds.add(retPOI.id);
        return { ...outPOI, mirrorSegmentIndex: retPOI.segmentIndex };
      }
    }
    return outPOI;
  });

  // Keep return-leg POIs that have no outbound mirror (unique to return route)
  const unmatchedReturn = returnLeg.filter(p => !usedReturnIds.has(p.id));

  return [...merged, ...unmatchedReturn, ...destination];
}

const DEFAULT_MARKER_CATEGORIES: MarkerCategory[] = [
  { id: 'gas', label: 'Gas', emoji: '⛽', color: 'bg-green-500', visible: false },
  { id: 'food', label: 'Food', emoji: '🍔', color: 'bg-orange-500', visible: false },
  { id: 'hotel', label: 'Hotel', emoji: '🏨', color: 'bg-blue-500', visible: false },
  { id: 'attraction', label: 'Sights', emoji: '📸', color: 'bg-purple-500', visible: false },
];

interface UsePOIReturn {
  // Map POIs (user-toggled categories)
  pois: POI[];
  markerCategories: MarkerCategory[];
  loadingCategory: POICategory | null;

  // POI Suggestions (route-based, ranked/trimmed for discovery UI)
  poiSuggestions: POISuggestion[];
  isLoadingPOIs: boolean;
  poiPartialResults: boolean;

  // Inference corpus (unranked gas/hotel/restaurant/cafe — for Tier-2 hub detection)
  poiInference: POISuggestion[];

  // Errors
  error: string | null;

  // Actions
  toggleCategory: (id: POICategory, searchLocation: Location | null, routeGeometry?: [number, number][] | null) => Promise<void>;
  addPOI: (poiId: string) => void;
  dismissPOI: (poiId: string) => void;
  fetchRoutePOIs: (
    routeGeometry: [number, number][],
    origin: Location,
    destination: Location,
    tripPreferences: TripPreference[],
    segments: TripSummary['segments'],
    roundTripMidpoint?: number
  ) => Promise<void>;
  /** Re-rank already-fetched corridor data with new preferences (no new Overpass calls). */
  refreshSuggestions: (
    routeGeometry: [number, number][],
    segments: TripSummary['segments'],
    tripPreferences: TripPreference[],
    destination: Location,
    roundTripMidpoint?: number
  ) => void;
  clearError: () => void;
  resetPOIs: () => void;
}

export function usePOI(): UsePOIReturn {
  // Map POIs state
  const [pois, setPois] = useState<POI[]>([]);
  const [markerCategories, setMarkerCategories] = useState<MarkerCategory[]>(DEFAULT_MARKER_CATEGORIES);
  const [loadingCategory, setLoadingCategory] = useState<POICategory | null>(null);

  // POI Suggestions state
  const [poiSuggestions, setPoiSuggestions] = useState<POISuggestion[]>([]);
  const [poiInference, setPoiInference] = useState<POISuggestion[]>([]);
  const [isLoadingPOIs, setIsLoadingPOIs] = useState(false);
  const [poiPartialResults, setPoiPartialResults] = useState(false);
  // Cached raw corridor data for refreshSuggestions (re-rank without re-fetch)
  const rawCorridor = useRef<{ alongWay: POISuggestion[]; atDestination: POISuggestion[] } | null>(null);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Toggle POI category on map
  const toggleCategory = useCallback(async (id: POICategory, searchLocation: Location | null, routeGeometry?: [number, number][] | null) => {
    setError(null);

    const newCategories = markerCategories.map((c) =>
      c.id === id ? { ...c, visible: !c.visible } : c
    );
    setMarkerCategories(newCategories);

    const targetCategory = newCategories.find((c) => c.id === id);

    if (targetCategory?.visible) {
      // Need either a route or a search location
      if ((!routeGeometry || routeGeometry.length < 2) && (!searchLocation || searchLocation.lat === 0)) {
        setError('Please calculate a route first.');
        setMarkerCategories((prev) =>
          prev.map((c) => (c.id === id ? { ...c, visible: false } : c))
        );
        return;
      }

      setLoadingCategory(id);
      try {
        // Use route-corridor search when route exists, fall back to point search
        const newPois = routeGeometry && routeGeometry.length >= 2
          ? await searchPOIsAlongRoute(routeGeometry, id)
          : await searchNearbyPOIs(searchLocation!.lat, searchLocation!.lng, id);

        if (newPois.length === 0) {
          setError(`No ${targetCategory.label} found along your route.`);
        }

        setPois((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const uniqueNewPois = newPois.filter((p) => !existingIds.has(p.id));
          return [...prev, ...uniqueNewPois];
        });
      } catch (err) {
        console.error(err);
        setError('Failed to fetch places.');
        setMarkerCategories((prev) =>
          prev.map((c) => (c.id === id ? { ...c, visible: false } : c))
        );
      } finally {
        setLoadingCategory(null);
      }
    } else {
      // Hide category - remove those POIs
      setPois((prev) => prev.filter((p) => p.category !== id));
    }
  }, [markerCategories]);

  // Add POI to trip (mark as added)
  const addPOI = useCallback((poiId: string) => {
    setPoiSuggestions((prev) =>
      prev.map((poi) =>
        poi.id === poiId ? { ...poi, actionState: 'added' as const } : poi
      )
    );
    // TODO: In future, add POI as a stop in the itinerary timeline
  }, []);

  // Dismiss POI suggestion
  const dismissPOI = useCallback((poiId: string) => {
    setPoiSuggestions((prev) =>
      prev.map((poi) =>
        poi.id === poiId ? { ...poi, actionState: 'dismissed' as const } : poi
      )
    );
  }, []);

  // Fetch POI suggestions for a route
  const fetchRoutePOIs = useCallback(
    async (
      routeGeometry: [number, number][],
      origin: Location,
      destination: Location,
      tripPreferences: TripPreference[],
      segments: TripSummary['segments'],
      roundTripMidpoint?: number
    ) => {
      if (routeGeometry.length === 0) return;

      setIsLoadingPOIs(true);
      setPoiPartialResults(false);
      try {
        const poiData = await fetchPOISuggestions(
          routeGeometry,
          origin,
          destination,
          tripPreferences
        );

        if (poiData.partialResults) setPoiPartialResults(true);

        // Stash raw results so refreshSuggestions can re-rank without re-fetching
        rawCorridor.current = { alongWay: poiData.alongWay, atDestination: poiData.atDestination };

        // Rank and filter along-way POIs (top 15 for discovery)
        const rankedAlongWay = rankAndFilterPOIs(
          poiData.alongWay,
          routeGeometry,
          segments,
          tripPreferences,
          15
        );

        // Rank and filter destination POIs (top 8)
        const rankedDestination = rankDestinationPOIs(
          poiData.atDestination,
          tripPreferences,
          { lat: destination.lat!, lng: destination.lng! },
          8
        );

        // Merge outbound+return mirrors for round trips
        const combined = [...rankedAlongWay, ...rankedDestination];
        const suggestions = roundTripMidpoint
          ? groupRoundTripPOIs(combined, roundTripMidpoint)
          : combined;

        setPoiSuggestions(suggestions);

        // Inference corpus: reuse corridor data filtered to utility categories.
        // INFERENCE_CATEGORIES (gas/restaurant/cafe) are always fetched by
        // poi-service/index.ts regardless of user preferences, so no 2nd call needed.
        const UTILITY_CATS = new Set(['gas', 'restaurant', 'cafe', 'hotel']);
        setPoiInference(poiData.alongWay.filter(p => UTILITY_CATS.has(p.category)));

      } catch (err) {
        console.error('Failed to fetch POI suggestions:', err);
        // Don’t fail the whole trip calculation if POIs fail
      } finally {
        setIsLoadingPOIs(false);
      }
    },
    []
  );

  /** Re-rank the cached corridor data with potentially new preferences.
   *  No Overpass calls — instant refresh. Falls back gracefully if cache is empty. */
  const refreshSuggestions = useCallback((
    routeGeometry: [number, number][],
    segments: TripSummary['segments'],
    tripPreferences: TripPreference[],
    destination: Location,
    roundTripMidpoint?: number
  ) => {
    const raw = rawCorridor.current;
    if (!raw) return;

    const rankedAlongWay = rankAndFilterPOIs(raw.alongWay, routeGeometry, segments, tripPreferences, 15);
    const rankedDestination = rankDestinationPOIs(
      raw.atDestination, tripPreferences,
      { lat: destination.lat!, lng: destination.lng! }, 8
    );
    const combined = [...rankedAlongWay, ...rankedDestination];
    const suggestions = roundTripMidpoint
      ? groupRoundTripPOIs(combined, roundTripMidpoint)
      : combined;
    setPoiSuggestions(prev =>
      // Preserve user action states (added/dismissed) from previous suggestions
      suggestions.map(s => {
        const existing = prev.find(p => p.id === s.id);
        return existing ? { ...s, actionState: existing.actionState, userNotes: existing.userNotes } : s;
      })
    );
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const resetPOIs = useCallback(() => {
    setPois([]);
    setPoiSuggestions([]);
    setPoiInference([]);
    setPoiPartialResults(false);
    rawCorridor.current = null;
    setMarkerCategories(DEFAULT_MARKER_CATEGORIES);
  }, []);

  return {
    pois,
    markerCategories,
    loadingCategory,
    poiSuggestions,
    poiInference,
    isLoadingPOIs,
    poiPartialResults,
    error,
    toggleCategory,
    addPOI,
    dismissPOI,
    fetchRoutePOIs,
    refreshSuggestions,
    clearError,
    resetPOIs,
  };
}
