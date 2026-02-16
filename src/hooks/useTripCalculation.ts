import { useState, useCallback } from 'react';
import type { Location, Vehicle, TripSettings, TripSummary } from '../types';
import { calculateRoute } from '../lib/api';
import {
  calculateTripCosts,
  calculateStrategicFuelStops,
  calculateArrivalTimes,
  type StrategicFuelStop,
} from '../lib/calculations';
import {
  splitTripByDays,
  calculateCostBreakdown,
  getBudgetStatus,
} from '../lib/budget';
import { fetchWeather } from '../lib/weather';
import { addToHistory } from '../lib/storage';
import { serializeStateToURL } from '../lib/url';

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

  // Overnight Stop Prompt
  showOvernightPrompt: boolean;
  suggestedOvernightStop: Location | null;
  dismissOvernightPrompt: () => void;

  // Actions
  calculateTrip: () => Promise<void>;
  updateStopType: (segmentIndex: number, newStopType: import('../types').StopType) => void;
  clearError: () => void;
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

  // Overnight stop prompt state
  const [showOvernightPrompt, setShowOvernightPrompt] = useState(false);
  const [suggestedOvernightStop, setSuggestedOvernightStop] = useState<Location | null>(null);

  // Store summary locally for updateStopType
  const [localSummary, setLocalSummary] = useState<TripSummary | null>(null);

  const calculateTrip = useCallback(async () => {
    setIsCalculating(true);
    setError(null);

    try {
      const routeData = await calculateRoute(locations, {
        avoidTolls: settings.avoidTolls,
        scenicMode: settings.scenicMode,
      });

      if (!routeData) {
        setError('Could not calculate route. Please check your locations.');
        return;
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

      // For round trips, duplicate segments in reverse for return journey
      if (settings.isRoundTrip) {
        const outboundSegments = segmentsWithTimes;
        const returnSegments = [...outboundSegments].reverse().map((seg) => ({
          ...seg,
          from: seg.to,
          to: seg.from,
          departureTime: undefined,
          arrivalTime: undefined,
          stopDuration: undefined,
          stopType: 'drive' as const,
        }));

        // Combine outbound + return and recalculate times
        const fullRoundTripSegments = [...outboundSegments, ...returnSegments];
        segmentsWithTimes = calculateArrivalTimes(
          fullRoundTripSegments,
          settings.departureDate,
          settings.departureTime
        );

        // Recalculate totals from duplicated segments
        tripSummary.totalDistanceKm = segmentsWithTimes.reduce((sum, s) => sum + s.distanceKm, 0);
        tripSummary.totalDurationMinutes = segmentsWithTimes.reduce(
          (sum, s) => sum + s.durationMinutes,
          0
        );
        tripSummary.totalFuelLitres = segmentsWithTimes.reduce(
          (sum, s) => sum + s.fuelNeededLitres,
          0
        );
        tripSummary.totalFuelCost = segmentsWithTimes.reduce((sum, s) => sum + s.fuelCost, 0);
      }

      tripSummary.segments = segmentsWithTimes;

      // Split trip into days with budget tracking
      const tripDays = splitTripByDays(
        segmentsWithTimes,
        settings,
        settings.departureDate,
        settings.departureTime
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

      // Check if overnight stop is recommended
      const totalHours = tripSummary.totalDurationMinutes / 60;
      const exceedsMaxHours = totalHours > settings.maxDriveHours;

      if (exceedsMaxHours) {
        // Calculate midpoint for overnight stop
        const targetDistance = tripSummary.totalDistanceKm * 0.5;
        let currentDist = 0;
        let overnightLocation: Location | null = null;

        for (const segment of tripSummary.segments) {
          currentDist += segment.distanceKm;
          if (currentDist >= targetDistance) {
            overnightLocation = segment.to;
            break;
          }
        }

        if (overnightLocation) {
          setSuggestedOvernightStop(overnightLocation);
          setShowOvernightPrompt(true);
        }
      } else {
        setShowOvernightPrompt(false);
      }

      // Add to history
      addToHistory(tripSummary);

      // Generate share URL
      serializeStateToURL(locations, vehicle, settings);
      setShareUrl(window.location.href);

      // Update state
      setLocalSummary(tripSummary);
      onSummaryChange(tripSummary);
      onCalculationComplete?.();
    } catch (e) {
      console.error(e);
      setError('An error occurred while calculating the route.');
    } finally {
      setIsCalculating(false);
    }
  }, [locations, vehicle, settings, onSummaryChange, onCalculationComplete]);

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

      // Update summary with recalculated times
      const updatedSummary = {
        ...localSummary,
        segments: segmentsWithTimes,
      };

      setLocalSummary(updatedSummary);
      onSummaryChange(updatedSummary);
    },
    [localSummary, settings.departureDate, settings.departureTime, onSummaryChange]
  );

  const dismissOvernightPrompt = useCallback(() => {
    setShowOvernightPrompt(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isCalculating,
    error,
    shareUrl,
    strategicFuelStops,
    showOvernightPrompt,
    suggestedOvernightStop,
    dismissOvernightPrompt,
    calculateTrip,
    updateStopType,
    clearError,
  };
}
