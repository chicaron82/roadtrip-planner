import { useRef, useCallback, useLayoutEffect } from 'react';
import { recordTrip } from '../lib/user-profile';
import type { Location, TripSettings, TripSummary, TripPreference, RouteSegment } from '../types';
import type { AdaptiveDefaults } from '../lib/user-profile';

interface UseCalculateAndDiscoverOptions {
  calculateTrip: () => Promise<TripSummary | null>;
  locations: Location[];
  settings: TripSettings;
  setTripConfirmed: (v: boolean) => void;
  fetchRoutePOIs: (
    geometry: [number, number][],
    origin: Location,
    destination: Location,
    preferences: TripPreference[],
    segments: RouteSegment[],
    roundTripMidpoint?: number
  ) => Promise<void>;
  refreshAdaptiveDefaults: () => AdaptiveDefaults | null;
  setAdaptiveDefaults: (defaults: AdaptiveDefaults | null) => void;
}

/**
 * Orchestrates the "calculate route + discover POIs" two-step.
 * Owns the settingsRef stale-closure guard so App.tsx doesn't have to.
 */
export function useCalculateAndDiscover({
  calculateTrip, locations, settings, setTripConfirmed,
  fetchRoutePOIs, refreshAdaptiveDefaults, setAdaptiveDefaults,
}: UseCalculateAndDiscoverOptions) {
  const settingsRef = useRef(settings);
  useLayoutEffect(() => { settingsRef.current = settings; });

  const calculateAndDiscover = useCallback(async () => {
    setTripConfirmed(false);
    const tripResult = await calculateTrip();
    if (!tripResult) return;
    recordTrip(settingsRef.current);
    setAdaptiveDefaults(refreshAdaptiveDefaults());
    const origin = locations.find(l => l.type === 'origin');
    const destination = locations.find(l => l.type === 'destination');
    if (origin && destination && tripResult.fullGeometry) {
      fetchRoutePOIs(
        tripResult.fullGeometry as [number, number][],
        origin, destination,
        settings.tripPreferences,
        tripResult.segments,
        tripResult.roundTripMidpoint,
      );
    }
  }, [calculateTrip, locations, settings.tripPreferences, fetchRoutePOIs,
      refreshAdaptiveDefaults, setAdaptiveDefaults, setTripConfirmed]);

  return { calculateAndDiscover };
}
