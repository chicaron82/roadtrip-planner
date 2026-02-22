import { useState, useCallback, useRef } from 'react';
import type { Location, Vehicle, TripSettings, TripSummary } from '../types';
import { calculateRoute } from '../lib/api';
import {
  calculateTripCosts,
  calculateStrategicFuelStops,
  calculateArrivalTimes,
  type StrategicFuelStop,
} from '../lib/calculations';
import { getTankSizeLitres, estimateGasStops } from '../lib/unit-conversions';
import {
  splitTripByDays,
  calculateCostBreakdown,
  getBudgetStatus,
} from '../lib/budget';
import { fetchWeather } from '../lib/weather';
import { addToHistory } from '../lib/storage';
import { serializeStateToURL } from '../lib/url';
import { reverseGeocodeTown } from '../lib/route-geocoder';

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
  calculateTrip: () => Promise<TripSummary | null>;
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

  // Overnight stop prompt state
  const [showOvernightPrompt, setShowOvernightPrompt] = useState(false);
  const [suggestedOvernightStop, setSuggestedOvernightStop] = useState<Location | null>(null);

  // Store summary locally for updateStopType
  const [localSummary, setLocalSummary] = useState<TripSummary | null>(null);

  // Abort controller for background overnight-stop geocoding.
  // Cancelled when a new calculation starts so stale results never overwrite.
  const geocodeAbortRef = useRef<AbortController | null>(null);

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
      let roundTripMidpoint: number | undefined;
      if (settings.isRoundTrip) {
        const outboundSegments = segmentsWithTimes;
        roundTripMidpoint = outboundSegments.length; // Index where return leg begins
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
          settings.departureTime,
          roundTripMidpoint
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

        // Recalculate derived values that were computed from one-way costs
        const tankSizeLitres = getTankSizeLitres(vehicle, settings.units);
        tripSummary.gasStops = estimateGasStops(tripSummary.totalFuelLitres, tankSizeLitres);
        tripSummary.costPerPerson = settings.numTravelers > 0
          ? tripSummary.totalFuelCost / settings.numTravelers
          : tripSummary.totalFuelCost;
        tripSummary.drivingDays = Math.ceil(tripSummary.totalDurationMinutes / 60 / settings.maxDriveHours);
      }

      tripSummary.segments = segmentsWithTimes;

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

      // Check if overnight stop is recommended
      // Skip if trip is already split into multiple days — day splitter handled it
      const totalHours = tripSummary.totalDurationMinutes / 60;
      const exceedsMaxHours = totalHours > settings.maxDriveHours;

      if (exceedsMaxHours && tripDays.length <= 1) {
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

      // ── Async overnight-stop geocoding (fire-and-forget) ──────────────
      // Transit split overnight locations have id='transit-split-N-M'
      // and linearly-interpolated lat/lng.  Resolve them to real city names
      // after emitting the initial summary so the UI isn't blocked.
      const transitDays = tripDays.filter(
        d => d.overnight?.location.id?.startsWith('transit-split-')
      );
      if (transitDays.length > 0) {
        (async () => {
          const enriched = tripDays.map(d => ({ ...d })); // shallow clone per day
          let changed = false;

          for (let i = 0; i < transitDays.length; i++) {
            if (geocodeController.signal.aborted) break;

            const day = transitDays[i];
            if (!day.overnight) continue;

            const { lat, lng } = day.overnight.location;
            const town = await reverseGeocodeTown(lat, lng, geocodeController.signal);

            if (town && !geocodeController.signal.aborted) {
              const idx = enriched.findIndex(d => d.dayNumber === day.dayNumber);
              if (idx >= 0) {
                const firstFrom = enriched[idx].segments[0]?.from.name ?? '';
                const clonedSegments = [...enriched[idx].segments];
                if (clonedSegments.length > 0) {
                  // The last segment is the one leading to the overnight stop
                  const lastSegIdx = clonedSegments.length - 1;
                  clonedSegments[lastSegIdx] = {
                    ...clonedSegments[lastSegIdx],
                    to: { ...clonedSegments[lastSegIdx].to, name: town }
                  };
                }

                enriched[idx] = {
                  ...enriched[idx],
                  route: `${firstFrom} \u2192 ${town}`,
                  segments: clonedSegments,
                  overnight: {
                    ...enriched[idx].overnight!,
                    location: { ...enriched[idx].overnight!.location, name: town },
                  },
                };
                
                // Also update the starting location of the NEXT day
                if (idx + 1 < enriched.length) {
                  const nextDay = enriched[idx + 1];
                  // Only update if it currently says 'Overnight Stop' to avoid overwriting real names
                  // if they somehow already have one.
                  const nextClonedSegments = [...nextDay.segments];
                  if (nextClonedSegments.length > 0 && nextClonedSegments[0].from.name === 'Overnight Stop') {
                    nextClonedSegments[0] = {
                      ...nextClonedSegments[0],
                      from: { ...nextClonedSegments[0].from, name: town }
                    };
                    
                    const nextLastTo = nextClonedSegments[nextClonedSegments.length - 1]?.to.name ?? 'Destination';
                    enriched[idx + 1] = {
                      ...nextDay,
                      route: `${town} \u2192 ${nextLastTo}`,
                      segments: nextClonedSegments
                    };
                  }
                }
                
                changed = true;
              }
            }

            // Nominatim usage policy: max 1 req/sec
            if (i < transitDays.length - 1) {
              await new Promise<void>(r => setTimeout(r, 1100));
            }
          }

          if (changed && !geocodeController.signal.aborted) {
            const updatedSummary = { ...tripSummary, days: enriched };
            setLocalSummary(updatedSummary);
            onSummaryChange(updatedSummary);
          }
        })();
      }
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
    showOvernightPrompt,
    suggestedOvernightStop,
    dismissOvernightPrompt,
    calculateTrip,
    updateStopType,
    updateDayNotes,
    updateDayTitle,
    updateDayType,
    updateDayOvernight,
    clearError,
    clearTripCalculation,
  };
}
