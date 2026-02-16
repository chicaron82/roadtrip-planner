import { useState, useCallback } from 'react';
import type { Location, POI, POICategory, MarkerCategory, POISuggestion, TripSummary, TripPreference } from '../types';
import { searchNearbyPOIs } from '../lib/poi';
import { fetchPOISuggestions } from '../lib/poi-service';
import { rankAndFilterPOIs, rankDestinationPOIs } from '../lib/poi-ranking';

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

  // POI Suggestions (route-based)
  poiSuggestions: POISuggestion[];
  isLoadingPOIs: boolean;

  // Errors
  error: string | null;

  // Actions
  toggleCategory: (id: POICategory, searchLocation: Location | null) => Promise<void>;
  addPOI: (poiId: string) => void;
  dismissPOI: (poiId: string) => void;
  fetchRoutePOIs: (
    routeGeometry: [number, number][],
    origin: Location,
    destination: Location,
    tripPreferences: TripPreference[],
    segments: TripSummary['segments']
  ) => Promise<void>;
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
  const [isLoadingPOIs, setIsLoadingPOIs] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Toggle POI category on map
  const toggleCategory = useCallback(async (id: POICategory, searchLocation: Location | null) => {
    setError(null);

    const newCategories = markerCategories.map((c) =>
      c.id === id ? { ...c, visible: !c.visible } : c
    );
    setMarkerCategories(newCategories);

    const targetCategory = newCategories.find((c) => c.id === id);

    if (targetCategory?.visible) {
      if (!searchLocation || searchLocation.lat === 0) {
        setError('Please select a location first.');
        setMarkerCategories((prev) =>
          prev.map((c) => (c.id === id ? { ...c, visible: false } : c))
        );
        return;
      }

      setLoadingCategory(id);
      try {
        const newPois = await searchNearbyPOIs(searchLocation.lat, searchLocation.lng, id);

        if (newPois.length === 0) {
          setError(`No ${targetCategory.label} found nearby.`);
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
      segments: TripSummary['segments']
    ) => {
      if (routeGeometry.length === 0) return;

      setIsLoadingPOIs(true);
      try {
        const poiData = await fetchPOISuggestions(
          routeGeometry,
          origin,
          destination,
          tripPreferences
        );

        // Rank and filter along-way POIs (top 5)
        const rankedAlongWay = rankAndFilterPOIs(
          poiData.alongWay,
          routeGeometry,
          segments,
          tripPreferences,
          5
        );

        // Rank and filter destination POIs (top 5)
        const rankedDestination = rankDestinationPOIs(
          poiData.atDestination,
          tripPreferences,
          5
        );

        setPoiSuggestions([...rankedAlongWay, ...rankedDestination]);
      } catch (err) {
        console.error('Failed to fetch POI suggestions:', err);
        // Don't fail the whole trip calculation if POIs fail
      } finally {
        setIsLoadingPOIs(false);
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const resetPOIs = useCallback(() => {
    setPois([]);
    setPoiSuggestions([]);
    setMarkerCategories(DEFAULT_MARKER_CATEGORIES);
  }, []);

  return {
    pois,
    markerCategories,
    loadingCategory,
    poiSuggestions,
    isLoadingPOIs,
    error,
    toggleCategory,
    addPOI,
    dismissPOI,
    fetchRoutePOIs,
    clearError,
    resetPOIs,
  };
}
