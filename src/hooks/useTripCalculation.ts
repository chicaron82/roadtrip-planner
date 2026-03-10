import { useState, useCallback, useRef, useLayoutEffect } from 'react';
import type { Location, Vehicle, TripSettings, TripSummary, TripDay, RouteStrategy, StopType, DayType, OvernightStop } from '../types';
import type { StrategicFuelStop } from '../lib/calculations';
import type { SuggestedStop } from '../lib/stop-suggestion-types';
import { fetchAllRouteStrategies } from '../lib/api';
import { snapFuelStopsToStations } from '../lib/fuel-stop-snapper';
import { checkAndSetOvernightPrompt, fireAndForgetOvernightSnap } from './useOvernightSnap';
import { addToHistory } from '../lib/storage';
import { serializeStateToURL } from '../lib/url';
import { buildStrategyUpdate } from '../lib/trip-strategy-selector';
import {
  orchestrateTrip, orchestrateStopUpdate, orchestrateStrategySwap, TripCalculationError,
} from '../lib/trip-orchestrator';
import { useTripContext } from '../contexts/TripContext';

interface UseTripCalculationOptions {
  locations: Location[];
  vehicle: Vehicle;
  settings: TripSettings;
  onSummaryChange: (summary: TripSummary | null) => void;
  onCalculationComplete?: () => void;
}

interface UseTripCalculationReturn {
  // State
  isCalculating: boolean;
  error: string | null;
  shareUrl: string | null;
  strategicFuelStops: StrategicFuelStop[];

  // Route strategies (named alternatives: fastest / canada-only / scenic)
  routeStrategies: RouteStrategy[];
  activeStrategyIndex: number;

  // Overnight Stop Prompt
  showOvernightPrompt: boolean;
  suggestedOvernightStop: Location | null;
  dismissOvernightPrompt: () => void;

  // Actions
  calculateTrip: () => Promise<TripSummary | null>;
  selectStrategy: (index: number) => void;
  updateStopType: (segmentIndex: number, newStopType: StopType) => void;
  /** Merge user-added POI stops into the canonical timeline without an OSRM recalc. */
  rebuildCanonicalWithExternals: (externalStops: SuggestedStop[]) => void;
  updateDayNotes: (dayNumber: number, notes: string) => void;
  updateDayTitle: (dayNumber: number, title: string) => void;
  updateDayType: (dayNumber: number, dayType: DayType) => void;
  updateDayOvernight: (dayNumber: number, overnight: OvernightStop) => void;
  clearError: () => void;
  clearTripCalculation: () => void;
}

export function useTripCalculation({
  locations,
  vehicle,
  settings,
  onSummaryChange,
  onCalculationComplete,
}: UseTripCalculationOptions): UseTripCalculationReturn {
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [strategicFuelStops, setStrategicFuelStops] = useState<StrategicFuelStop[]>([]);
  const [routeStrategies, setRouteStrategies] = useState<RouteStrategy[]>([]);
  const [activeStrategyIndex, setActiveStrategyIndex] = useState(0);

  // Overnight stop prompt state
  const [showOvernightPrompt, setShowOvernightPrompt] = useState(false);
  const [suggestedOvernightStop, setSuggestedOvernightStop] = useState<Location | null>(null);

  // Store summary locally for updateStopType
  const [localSummary, setLocalSummary] = useState<TripSummary | null>(null);
  // canonicalTimeline lives in TripContext so deep consumers don't need prop drilling.
  const { setCanonicalTimeline } = useTripContext();

  // Abort controller for background overnight-stop geocoding.
  // Cancelled when a new calculation starts so stale results never overwrite.
  const geocodeAbortRef = useRef<AbortController | null>(null);

  // Generation counter for guarding unabortable async work (e.g. Overpass snaps).
  // Increment before any async op; capture the value; discard results if stale.
  const calcRunIdRef = useRef(0);

  // Retain roundTripMidpoint across calculations so updateStopType can re-split days correctly
  const roundTripMidpointRef = useRef<number | undefined>(undefined);

  // Ref-sync for settings — prevents calculateTrip from getting a new identity on
  // every settings change (e.g. editing hotel price between calculations).
  // useLayoutEffect ensures the ref is current before any paint.
  const settingsRef = useRef(settings);
  useLayoutEffect(() => { settingsRef.current = settings; });

  const calculateTrip = useCallback(async (): Promise<TripSummary | null> => {
    setIsCalculating(true);
    setError(null);

    // Cancel any in-progress geocoding from a prior calculation.
    geocodeAbortRef.current?.abort();
    const geocodeController = new AbortController();
    geocodeAbortRef.current = geocodeController;

    // Increment run ID so stale async results (Overpass snaps, strategy fetch)
    // from any prior calculation are discarded when they eventually resolve.
    const runId = ++calcRunIdRef.current;

    // Read settings from ref so this callback doesn't need settings in its dep array.
    // The ref is kept current via useLayoutEffect above.
    const currentSettings = settingsRef.current;

    try {
      const result = await orchestrateTrip(locations, vehicle, currentSettings);
      const { tripSummary, canonicalTimeline, projectedFuelStops } = result;
      roundTripMidpointRef.current = result.roundTripMidpoint;

      setCanonicalTimeline(canonicalTimeline);
      setStrategicFuelStops(projectedFuelStops);

      snapFuelStopsToStations(projectedFuelStops).then(snapped => {
        if (calcRunIdRef.current === runId) setStrategicFuelStops(snapped);
      }).catch((err) => {
        console.warn('[fuel-snap] Overpass unavailable — keeping simulation-interpolated positions', err);
      });

      checkAndSetOvernightPrompt(
        tripSummary, tripSummary.days!, currentSettings,
        setSuggestedOvernightStop, setShowOvernightPrompt,
      );

      addToHistory(tripSummary);
      serializeStateToURL(locations, vehicle, currentSettings);
      setShareUrl(window.location.href);
      setLocalSummary(tripSummary);
      onSummaryChange(tripSummary);
      onCalculationComplete?.();

      setRouteStrategies([]);
      setActiveStrategyIndex(0);
      fetchAllRouteStrategies(locations, currentSettings.avoidTolls).then(strategies => {
        if (!geocodeController.signal.aborted) {
          setRouteStrategies(strategies);
        }
      });

      fireAndForgetOvernightSnap(
        tripSummary.days!, tripSummary, canonicalTimeline, geocodeController,
        setLocalSummary, setCanonicalTimeline, onSummaryChange,
      );

      return tripSummary;
    } catch (e) {
      if (e instanceof TripCalculationError) {
        setError(e.message);
      } else {
        console.error(e);
        setError('An error occurred while calculating the route.');
      }
      return null;
    } finally {
      setIsCalculating(false);
    }
  }, [locations, vehicle, onSummaryChange, onCalculationComplete, setCanonicalTimeline]);

  // Switch to a named route strategy — swaps geometry + recalculates fuel costs.
  // Day itinerary, weather, and POIs are preserved from the primary calculation.
  const selectStrategy = useCallback(
    (index: number) => {
      const strategy = routeStrategies[index];
      if (!strategy || !localSummary) return;
      setActiveStrategyIndex(index);
      const updatedSummary = buildStrategyUpdate(strategy, localSummary, vehicle, settings);
      const { canonicalTimeline, projectedFuelStops } = orchestrateStrategySwap(
        updatedSummary, settings, vehicle, locations, roundTripMidpointRef.current,
      );
      setLocalSummary(updatedSummary);
      onSummaryChange(updatedSummary);
      setCanonicalTimeline(canonicalTimeline);
      setStrategicFuelStops(projectedFuelStops);
    },
    [routeStrategies, localSummary, vehicle, settings, locations, onSummaryChange, setCanonicalTimeline]
  );

  const updateStopType = useCallback(
    (segmentIndex: number, newStopType: StopType) => {
      if (!localSummary) return;

      const result = orchestrateStopUpdate(
        localSummary, segmentIndex, newStopType,
        settings, vehicle, locations, roundTripMidpointRef.current,
      );

      setLocalSummary(result.updatedSummary);
      onSummaryChange(result.updatedSummary);
      setStrategicFuelStops(result.projectedFuelStops);
      setCanonicalTimeline(result.canonicalTimeline);

      const snapRunId = ++calcRunIdRef.current;
      snapFuelStopsToStations(result.projectedFuelStops).then(snapped => {
        if (calcRunIdRef.current === snapRunId) setStrategicFuelStops(snapped);
      }).catch((err) => {
        console.warn('[fuel-snap] Overpass unavailable — keeping simulation-interpolated positions', err);
      });
    },
    [localSummary, settings, vehicle, locations, onSummaryChange, setCanonicalTimeline]
  );

  // Rebuild the canonical timeline with user-added POI stops merged in.
  // Calls the same synchronous pipeline as orchestrateStrategySwap — no OSRM call.
  // Intentionally does NOT update strategicFuelStops: external POI stops are
  // overlay stops and don't affect fuel-level projections.
  const rebuildCanonicalWithExternals = useCallback(
    (externalStops: SuggestedStop[]) => {
      if (!localSummary) return;
      const { canonicalTimeline } = orchestrateStrategySwap(
        localSummary, settings, vehicle, locations,
        roundTripMidpointRef.current, externalStops,
      );
      setCanonicalTimeline(canonicalTimeline);
    },
    [localSummary, settings, vehicle, locations, setCanonicalTimeline]
  );

  // Generic day updater — updates a single day in summary.days
  const updateDay = useCallback(
    (dayNumber: number, patch: Partial<TripDay>) => {
      if (!localSummary?.days) return;

      const updatedDays = localSummary.days.map(day =>
        day.dayNumber === dayNumber ? { ...day, ...patch } : day
      );

      const updatedSummary = {
        ...localSummary,
        days: updatedDays,
      };

      setLocalSummary(updatedSummary);
      onSummaryChange(updatedSummary);
    },
    [localSummary, onSummaryChange]
  );

  // Convenience wrappers
  const updateDayNotes = useCallback(
    (dayNumber: number, notes: string) => updateDay(dayNumber, { notes }),
    [updateDay]
  );

  const updateDayTitle = useCallback(
    (dayNumber: number, title: string) => updateDay(dayNumber, { title }),
    [updateDay]
  );

  const updateDayType = useCallback(
    (dayNumber: number, dayType: DayType) => updateDay(dayNumber, { dayType }),
    [updateDay]
  );

  const updateDayOvernight = useCallback(
    (dayNumber: number, overnight: OvernightStop) => updateDay(dayNumber, { overnight }),
    [updateDay]
  );

  const dismissOvernightPrompt = useCallback(() => {
    setShowOvernightPrompt(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearTripCalculation = useCallback(() => {
    setStrategicFuelStops([]);
    setRouteStrategies([]);
    setActiveStrategyIndex(0);
    setLocalSummary(null);
    setCanonicalTimeline(null); // clears context value
    setShareUrl(null);
    setError(null);
    setShowOvernightPrompt(false);
    setSuggestedOvernightStop(null);
    onSummaryChange(null);
  }, [onSummaryChange, setCanonicalTimeline]);

  return {
    isCalculating,
    error,
    shareUrl,
    strategicFuelStops,
    routeStrategies,
    activeStrategyIndex,
    showOvernightPrompt,
    suggestedOvernightStop,
    dismissOvernightPrompt,
    calculateTrip,
    selectStrategy,
    updateStopType,
    rebuildCanonicalWithExternals,
    updateDayNotes,
    updateDayTitle,
    updateDayType,
    updateDayOvernight,
    clearError,
    clearTripCalculation,
  };
}
