import { useState, useCallback, useRef } from 'react';
import type { Location, POI, POICategory, MarkerCategory, POISuggestion, TripSummary, TripPreference } from '../types';
import { searchNearbyPOIs, searchPOIsAlongRoute } from '../lib/poi';
import { usePOISuggestions } from './usePOISuggestions';

const DEFAULT_MARKER_CATEGORIES: MarkerCategory[] = [
  { id: 'gas', label: 'Gas', emoji: '⛽', color: 'bg-green-500', visible: false },
  { id: 'food', label: 'Food', emoji: '🍔', color: 'bg-orange-500', visible: false },
  { id: 'hotel', label: 'Hotel', emoji: '🏨', color: 'bg-blue-500', visible: false },
  { id: 'attraction', label: 'Sights', emoji: '📸', color: 'bg-purple-500', visible: false },
];

interface UsePOIOptions {
  routeGeometry?: [number, number][];
  segments?: TripSummary['segments'];
  origin?: Location;
  destination?: Location;
  tripPreferences?: TripPreference[];
  roundTripMidpoint?: number;
}

interface UsePOIReturn {
  // Map POIs (user-toggled categories)
  pois: POI[];
  markerCategories: MarkerCategory[];
  loadingCategory: POICategory | null;

  // POI Suggestions (route-based, ranked/trimmed for discovery UI)
  poiSuggestions: POISuggestion[];
  isLoadingPOIs: boolean;
  poiPartialResults: boolean;
  poiFetchFailed: boolean;

  // Inference corpus (unranked gas/hotel/restaurant/cafe — for Tier-2 hub detection)
  poiInference: POISuggestion[];

  // Errors
  error: string | null;

  // Actions
  toggleCategory: (id: POICategory, searchLocation: Location | null, routeGeometry?: [number, number][] | null) => Promise<void>;
  addPOI: (poiId: string) => void;
  dismissPOI: (poiId: string) => void;
  clearError: () => void;
  resetPOIs: () => void;
}

export function usePOI({
  routeGeometry,
  segments,
  origin,
  destination,
  tripPreferences = [],
  roundTripMidpoint,
}: UsePOIOptions = {}): UsePOIReturn {
  // Map POIs state
  const [pois, setPois] = useState<POI[]>([]);
  const [markerCategories, setMarkerCategories] = useState<MarkerCategory[]>(DEFAULT_MARKER_CATEGORIES);
  const [loadingCategory, setLoadingCategory] = useState<POICategory | null>(null);
  // Mirror markerCategories in a ref so toggleCategory can read the current
  // value synchronously — avoiding the stale-closure race that would occur
  // if we captured it inside the functional setState update that schedules async.
  const markerCategoriesRef = useRef<MarkerCategory[]>(DEFAULT_MARKER_CATEGORIES);
  // Error state
  const [error, setError] = useState<string | null>(null);
  const {
    poiSuggestions,
    poiInference,
    isLoadingPOIs,
    poiPartialResults,
    poiFetchFailed,
    addPOI,
    dismissPOI,
    resetPOISuggestions,
  } = usePOISuggestions({
    routeGeometry,
    segments,
    origin,
    destination,
    tripPreferences,
    roundTripMidpoint,
  });

  // Toggle POI category on map
  const toggleCategory = useCallback(async (id: POICategory, searchLocation: Location | null, currentRouteGeometry?: [number, number][] | null) => {
    setError(null);

    // Read current visibility synchronously from the ref (safe against rapid
    // double-clicks where the React state update hasn't settled yet).
    const currentCategories = markerCategoriesRef.current;
    const prevCategory = currentCategories.find((c) => c.id === id);
    const willBeVisible = !prevCategory?.visible;

    const updatedCategories = currentCategories.map((c) =>
      c.id === id ? { ...c, visible: willBeVisible } : c
    );
    markerCategoriesRef.current = updatedCategories;
    setMarkerCategories(updatedCategories);

    if (willBeVisible) {
      // Need either a route or a search location
      if ((!currentRouteGeometry || currentRouteGeometry.length < 2) && (!searchLocation || searchLocation.lat === 0)) {
        setError('Please calculate a route first.');
        const reset = markerCategoriesRef.current.map((c) => c.id === id ? { ...c, visible: false } : c);
        markerCategoriesRef.current = reset;
        setMarkerCategories(reset);
        return;
      }

      setLoadingCategory(id);
      try {
        // Use route-corridor search when route exists, fall back to point search
        const targetCategory = updatedCategories.find((c) => c.id === id);
        const newPois = currentRouteGeometry && currentRouteGeometry.length >= 2
          ? await searchPOIsAlongRoute(currentRouteGeometry, id)
          : await searchNearbyPOIs(searchLocation!.lat, searchLocation!.lng, id);

        if (newPois.length === 0) {
          setError(`No ${targetCategory?.label ?? id} found along your route.`);
        }

        setPois((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const uniqueNewPois = newPois.filter((p) => !existingIds.has(p.id));
          return [...prev, ...uniqueNewPois];
        });
      } catch (err) {
        console.error(err);
        setError('Failed to fetch places.');
        const reset = markerCategoriesRef.current.map((c) => c.id === id ? { ...c, visible: false } : c);
        markerCategoriesRef.current = reset;
        setMarkerCategories(reset);
      } finally {
        setLoadingCategory(null);
      }
    } else {
      // Hide category - remove those POIs
      setPois((prev) => prev.filter((p) => p.category !== id));
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const resetPOIs = useCallback(() => {
    const reset = DEFAULT_MARKER_CATEGORIES;
    markerCategoriesRef.current = reset;
    setPois([]);
    resetPOISuggestions();
    setMarkerCategories(reset);
  }, [resetPOISuggestions]);

  return {
    pois,
    markerCategories,
    loadingCategory,
    poiSuggestions,
    poiInference,
    isLoadingPOIs,
    poiPartialResults,
    poiFetchFailed,
    error,
    toggleCategory,
    addPOI,
    dismissPOI,
    clearError,
    resetPOIs,
  };
}
