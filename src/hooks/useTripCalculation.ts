import { useState, useCallback, useRef } from 'react';
import type { Location, Vehicle, TripSettings, TripSummary, RouteStrategy } from '../types';
import { calculateRoute, fetchAllRouteStrategies } from '../lib/api';
import {
  calculateTripCosts,
  calculateStrategicFuelStops,
  calculateArrivalTimes,
  type StrategicFuelStop,
} from '../lib/calculations';
import { snapFuelStopsToStations } from '../lib/fuel-stop-snapper';
import { buildRoundTripSegments, checkAndSetOvernightPrompt, fireAndForgetOvernightSnap } from '../lib/trip-calculation-helpers';
import {
  splitTripByDays,
  calculateCostBreakdown,
  getBudgetStatus,
} from '../lib/budget';
import { generateSmartStops, createStopConfig } from '../lib/stop-suggestions';
import { fetchWeather } from '../lib/weather';
import { addToHistory } from '../lib/storage';
import { serializeStateToURL } from '../lib/url';
import { validateTripInputs } from '../lib/validate-inputs';
import { buildStrategyUpdate } from '../lib/trip-strategy-selector';

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
  updateStopType: (segmentIndex: number, newStopType: import('../types').StopType) => void;
  updateDayNotes: (dayNumber: number, notes: string) => void;
  updateDayTitle: (dayNumber: number, title: string) => void;
  updateDayType: (dayNumber: number, dayType: import('../types').DayType) => void;
  updateDayOvernight: (dayNumber: number, overnight: import('../types').OvernightStop) => void;
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

  // Abort controller for background overnight-stop geocoding.
  // Cancelled when a new calculation starts so stale results never overwrite.
  const geocodeAbortRef = useRef<AbortController | null>(null);

  // Retain roundTripMidpoint across calculations so updateStopType can re-split days correctly
  const roundTripMidpointRef = useRef<number | undefined>(undefined);

  const calculateTrip = useCallback(async (): Promise<TripSummary | null> => {
    setIsCalculating(true);
    setError(null);

    // Cancel any in-progress geocoding from a prior calculation.
    geocodeAbortRef.current?.abort();
    const geocodeController = new AbortController();
    geocodeAbortRef.current = geocodeController;

    try {
      const routeData = await calculateRoute(locations, {
        avoidTolls: settings.avoidTolls,
        avoidBorders: settings.avoidBorders,
        scenicMode: settings.scenicMode,
      });

      if (!routeData) {
        setError('Could not calculate route. Please check your locations.');
        return null;
      }

      // Validate inputs before any expensive calculation
      const validationErrors = validateTripInputs(routeData.segments, settings);
      if (validationErrors.length > 0) {
        setError(validationErrors[0]);
        return null;
      }

      // Calculate base trip costs
      const tripSummary = calculateTripCosts(routeData.segments, vehicle, settings);
      tripSummary.fullGeometry = routeData.fullGeometry;

      // Fetch weather for each segment
      const segmentsWithWeather = await Promise.all(
        tripSummary.segments.map(async (seg) => {
          const weather = await fetchWeather(seg.to.lat, seg.to.lng, settings.departureDate);
          return { ...seg, weather: weather || undefined };
        })
      );

      // Calculate arrival times for each segment
      let segmentsWithTimes = calculateArrivalTimes(
        segmentsWithWeather,
        settings.departureDate,
        settings.departureTime
      );

      // For round trips, duplicate and reverse segments, then recalculate
      let roundTripMidpoint: number | undefined;
      if (settings.isRoundTrip) {
        const rt = buildRoundTripSegments(segmentsWithTimes, tripSummary, settings, vehicle);
        segmentsWithTimes = rt.segments;
        roundTripMidpoint = rt.roundTripMidpoint;
        roundTripMidpointRef.current = roundTripMidpoint;
      }

      tripSummary.segments = segmentsWithTimes;
      tripSummary.roundTripMidpoint = roundTripMidpoint;

      // Split trip into days with budget tracking
      const tripDays = splitTripByDays(
        segmentsWithTimes,
        settings,
        settings.departureDate,
        settings.departureTime,
        roundTripMidpoint,
        routeData.fullGeometry,
      );
      tripSummary.days = tripDays;

      // Calculate overall cost breakdown
      if (tripDays.length > 0) {
        tripSummary.costBreakdown = calculateCostBreakdown(tripDays, settings.numTravelers);
        tripSummary.budgetStatus = getBudgetStatus(settings.budget, tripSummary.costBreakdown);
        tripSummary.budgetRemaining = settings.budget.total - tripSummary.costBreakdown.total;
      }

      // Calculate strategic fuel stops
      const fuelStops = calculateStrategicFuelStops(
        routeData.fullGeometry,
        tripSummary.segments,
        vehicle,
        settings
      );
      setStrategicFuelStops(fuelStops);

      // Patch each day's arrival time to include smart-stop durations (fuel, rest, meal).
      // finalizeTripDay only counts segment.stopDuration in stopTimeMinutes, missing the
      // SuggestedStop durations that the SmartTimeline clock accumulates. Each stop's
      // dayNumber field maps it to the correct TripDay.
      const smartStopsForPatch = generateSmartStops(
        tripSummary.segments,
        createStopConfig(vehicle, settings, tripSummary.fullGeometry),
        tripDays,
      );
      for (const day of tripDays) {
        if (!day.totals.arrivalTime || day.segments.length === 0) continue;
        const dayStopMinutes = smartStopsForPatch
          .filter(s => s.dayNumber === day.dayNumber && s.type !== 'overnight' && !s.dismissed)
          .reduce((sum, s) => sum + s.duration, 0);
        if (dayStopMinutes > 0) {
          const adjustedArrival = new Date(day.totals.arrivalTime);
          adjustedArrival.setMinutes(adjustedArrival.getMinutes() + dayStopMinutes);
          day.totals.arrivalTime = adjustedArrival.toISOString();
        }
      }

      // Background: snap fuel stop pins to real OSM gas stations.
      // Fire-and-forget — updates markers in place once the query resolves.
      snapFuelStopsToStations(fuelStops).then(snapped => {
        setStrategicFuelStops(snapped);
      }).catch(() => {
        // Silently keep geometry-interpolated positions if Overpass is unavailable
      });

      checkAndSetOvernightPrompt(
        tripSummary, tripDays, settings,
        setSuggestedOvernightStop, setShowOvernightPrompt,
      );

      // Add to history
      addToHistory(tripSummary);

      // Generate share URL
      serializeStateToURL(locations, vehicle, settings);
      setShareUrl(window.location.href);

      // Update state
      setLocalSummary(tripSummary);
      onSummaryChange(tripSummary);
      onCalculationComplete?.();

      // ── Fetch named route strategies in the background ─────────────────
      // Fire-and-forget: populates the strategy picker after the main result
      // is already displayed, so it never blocks the primary calculation.
      setRouteStrategies([]);
      setActiveStrategyIndex(0);
      fetchAllRouteStrategies(locations, settings.avoidTolls).then(strategies => {
        if (!geocodeController.signal.aborted) {
          setRouteStrategies(strategies);
        }
      });
      // ─────────────────────────────────────────────────────────────────

      // Fire-and-forget: snap overnight stop markers to nearest real town.
      fireAndForgetOvernightSnap(tripDays, tripSummary, geocodeController, setLocalSummary, onSummaryChange);
      // ─────────────────────────────────────────────────────────────────

      return tripSummary;
    } catch (e) {
      console.error(e);
      setError('An error occurred while calculating the route.');
      return null;
    } finally {
      setIsCalculating(false);
    }
  }, [locations, vehicle, settings, onSummaryChange, onCalculationComplete]);

  // Switch to a named route strategy — swaps geometry + recalculates fuel costs.
  // Day itinerary, weather, and POIs are preserved from the primary calculation.
  const selectStrategy = useCallback(
    (index: number) => {
      const strategy = routeStrategies[index];
      if (!strategy || !localSummary) return;
      setActiveStrategyIndex(index);
      const updatedSummary = buildStrategyUpdate(strategy, localSummary, vehicle, settings);
      setLocalSummary(updatedSummary);
      onSummaryChange(updatedSummary);
    },
    [routeStrategies, localSummary, vehicle, settings, onSummaryChange]
  );

  const updateStopType = useCallback(
    (segmentIndex: number, newStopType: import('../types').StopType) => {
      if (!localSummary) return;

      // Update the segment's stop type
      const updatedSegments = localSummary.segments.map((seg, idx) =>
        idx === segmentIndex ? { ...seg, stopType: newStopType } : seg
      );

      // Recalculate arrival times with new stop durations
      const segmentsWithTimes = calculateArrivalTimes(
        updatedSegments,
        settings.departureDate,
        settings.departureTime
      );

      // Re-split days so overnight markings update day budgets and structure
      const updatedDays = splitTripByDays(
        segmentsWithTimes,
        settings,
        settings.departureDate,
        settings.departureTime,
        roundTripMidpointRef.current,
        localSummary.fullGeometry as [number, number][],
      );

      const updatedCostBreakdown = updatedDays.length > 0
        ? calculateCostBreakdown(updatedDays, settings.numTravelers)
        : localSummary.costBreakdown;

      const updatedSummary = {
        ...localSummary,
        segments: segmentsWithTimes,
        days: updatedDays,
        costBreakdown: updatedCostBreakdown,
        budgetStatus: updatedCostBreakdown ? getBudgetStatus(settings.budget, updatedCostBreakdown) : localSummary.budgetStatus,
        budgetRemaining: updatedCostBreakdown ? settings.budget.total - updatedCostBreakdown.total : localSummary.budgetRemaining,
      };

      setLocalSummary(updatedSummary);
      onSummaryChange(updatedSummary);

      // Refresh strategic fuel stop map pins to reflect any changed overnight stops.
      const newFuelStops = calculateStrategicFuelStops(
        localSummary.fullGeometry as [number, number][],
        segmentsWithTimes,
        vehicle,
        settings,
      );
      setStrategicFuelStops(newFuelStops);
      // Fire-and-forget snap to real OSM stations
      snapFuelStopsToStations(newFuelStops).then(snapped => {
        setStrategicFuelStops(snapped);
      }).catch(() => {});
    },
    [localSummary, settings, vehicle, onSummaryChange]
  );

  // Generic day updater — updates a single day in summary.days
  const updateDay = useCallback(
    (dayNumber: number, patch: Partial<import('../types').TripDay>) => {
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
    (dayNumber: number, dayType: import('../types').DayType) => updateDay(dayNumber, { dayType }),
    [updateDay]
  );

  const updateDayOvernight = useCallback(
    (dayNumber: number, overnight: import('../types').OvernightStop) => updateDay(dayNumber, { overnight }),
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
    setShareUrl(null);
    setError(null);
    setShowOvernightPrompt(false);
    setSuggestedOvernightStop(null);
    onSummaryChange(null);
  }, [onSummaryChange]);

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
    updateDayNotes,
    updateDayTitle,
    updateDayType,
    updateDayOvernight,
    clearError,
    clearTripCalculation,
  };
}
