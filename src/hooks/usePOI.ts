import { useState, useCallback } from 'react';
import type { Location, POI, POICategory, MarkerCategory, POISuggestion, TripSummary, TripPreference } from '../types';
import { searchNearbyPOIs, searchPOIsAlongRoute } from '../lib/poi';
import { usePOISuggestions } from './usePOISuggestions';

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
  poiFetchFailed: boolean;

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
    fetchRoutePOIs,
    refreshSuggestions,
    resetPOISuggestions,
  } = usePOISuggestions();

  // Toggle POI category on map
  const toggleCategory = useCallback(async (id: POICategory, searchLocation: Location | null, routeGeometry?: [number, number][] | null) => {
    setError(null);

    // Functional update — no need for markerCategories in the dep array
    let targetCategory: MarkerCategory | undefined;
    setMarkerCategories(prev => {
      const updated = prev.map((c) => c.id === id ? { ...c, visible: !c.visible } : c);
      targetCategory = updated.find((c) => c.id === id);
      return updated;
    });

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
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const resetPOIs = useCallback(() => {
    setPois([]);
    resetPOISuggestions();
    setMarkerCategories(DEFAULT_MARKER_CATEGORIES);
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
    fetchRoutePOIs,
    refreshSuggestions,
    clearError,
    resetPOIs,
  };
}
