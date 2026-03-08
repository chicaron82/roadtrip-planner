import { useCallback, useRef, useState } from 'react';
import type { Location, POISuggestion, TripPreference, TripSummary } from '../types';
import { fetchPOISuggestions } from '../lib/poi-service';
import {
  buildPOISuggestionResults,
  preservePOIActionState,
  setPOIActionState,
} from './usePOISuggestionHelpers';

interface UsePOISuggestionsReturn {
  poiSuggestions: POISuggestion[];
  poiInference: POISuggestion[];
  isLoadingPOIs: boolean;
  poiPartialResults: boolean;
  addPOI: (poiId: string) => void;
  dismissPOI: (poiId: string) => void;
  fetchRoutePOIs: (
    routeGeometry: [number, number][],
    origin: Location,
    destination: Location,
    tripPreferences: TripPreference[],
    segments: TripSummary['segments'],
    roundTripMidpoint?: number,
  ) => Promise<void>;
  refreshSuggestions: (
    routeGeometry: [number, number][],
    segments: TripSummary['segments'],
    tripPreferences: TripPreference[],
    destination: Location,
    roundTripMidpoint?: number,
  ) => void;
  resetPOISuggestions: () => void;
}

export function usePOISuggestions(): UsePOISuggestionsReturn {
  const [poiSuggestions, setPoiSuggestions] = useState<POISuggestion[]>([]);
  const [poiInference, setPoiInference] = useState<POISuggestion[]>([]);
  const [isLoadingPOIs, setIsLoadingPOIs] = useState(false);
  const [poiPartialResults, setPoiPartialResults] = useState(false);
  const rawCorridor = useRef<{ alongWay: POISuggestion[]; atDestination: POISuggestion[] } | null>(null);

  const addPOI = useCallback((poiId: string) => {
    setPoiSuggestions(previous => setPOIActionState(previous, poiId, 'added'));
  }, []);

  const dismissPOI = useCallback((poiId: string) => {
    setPoiSuggestions(previous => setPOIActionState(previous, poiId, 'dismissed'));
  }, []);

  const fetchRoutePOIs = useCallback(async (
    routeGeometry: [number, number][],
    origin: Location,
    destination: Location,
    tripPreferences: TripPreference[],
    segments: TripSummary['segments'],
    roundTripMidpoint?: number,
  ) => {
    if (routeGeometry.length === 0) return;

    setIsLoadingPOIs(true);
    setPoiPartialResults(false);

    try {
      const poiData = await fetchPOISuggestions(routeGeometry, origin, destination, tripPreferences);
      if (poiData.partialResults) setPoiPartialResults(true);

      rawCorridor.current = { alongWay: poiData.alongWay, atDestination: poiData.atDestination };

      const { suggestions, inference } = buildPOISuggestionResults({
        alongWay: poiData.alongWay,
        atDestination: poiData.atDestination,
        routeGeometry,
        segments,
        tripPreferences,
        destination,
        roundTripMidpoint,
      });

      setPoiSuggestions(suggestions);
      setPoiInference(inference);
    } catch (error) {
      console.error('Failed to fetch POI suggestions:', error);
    } finally {
      setIsLoadingPOIs(false);
    }
  }, []);

  const refreshSuggestions = useCallback((
    routeGeometry: [number, number][],
    segments: TripSummary['segments'],
    tripPreferences: TripPreference[],
    destination: Location,
    roundTripMidpoint?: number,
  ) => {
    const raw = rawCorridor.current;
    if (!raw) return;

    const { suggestions } = buildPOISuggestionResults({
      alongWay: raw.alongWay,
      atDestination: raw.atDestination,
      routeGeometry,
      segments,
      tripPreferences,
      destination,
      roundTripMidpoint,
    });

    setPoiSuggestions(previous => preservePOIActionState(suggestions, previous));
  }, []);

  const resetPOISuggestions = useCallback(() => {
    setPoiSuggestions([]);
    setPoiInference([]);
    setPoiPartialResults(false);
    rawCorridor.current = null;
  }, []);

  return {
    poiSuggestions,
    poiInference,
    isLoadingPOIs,
    poiPartialResults,
    addPOI,
    dismissPOI,
    fetchRoutePOIs,
    refreshSuggestions,
    resetPOISuggestions,
  };
}