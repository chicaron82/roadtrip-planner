import { useState, useCallback, useRef } from 'react';
import type { Location, Vehicle, TripSettings, TripSummary, RouteStrategy } from '../types';
import { calculateRoute, fetchAllRouteStrategies } from '../lib/api';
import {
  calculateTripCosts,
  calculateStrategicFuelStops,
  calculateArrivalTimes,
  type StrategicFuelStop,
} from '../lib/calculations';
import { getTankSizeLitres, estimateGasStops } from '../lib/unit-conversions';
import { snapFuelStopsToStations } from '../lib/fuel-stop-snapper';
import { snapOvernightsToTowns } from '../lib/overnight-snapper';
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

      // For round trips, duplicate segments in reverse for return journey
      let roundTripMidpoint: number | undefined;
      if (settings.isRoundTrip) {
        const outboundSegments = segmentsWithTimes;
        roundTripMidpoint = outboundSegments.length; // Index where return leg begins
        roundTripMidpointRef.current = roundTripMidpoint;
        const returnSegments = [...outboundSegments].reverse().map((seg) => ({
          ...seg,
          from: seg.to,
          to: seg.from,
          departureTime: undefined,
          arrivalTime: undefined,
          stopDuration: undefined,
          stopType: 'drive' as const,
        }));

        // Combine outbound + return and recalculate times.
        // For day trips (total drive ≤ maxDriveHours), pass the dwell time so the
        // return leg departs the same day instead of jumping to next morning.
        const fullRoundTripSegments = [...outboundSegments, ...returnSegments];
        const totalRTMinutes = fullRoundTripSegments.reduce((sum, s) => sum + s.durationMinutes, 0);
        const isRTDayTrip = totalRTMinutes <= settings.maxDriveHours * 60;
        segmentsWithTimes = calculateArrivalTimes(
          fullRoundTripSegments,
          settings.departureDate,
          settings.departureTime,
          roundTripMidpoint,
          isRTDayTrip ? (settings.dayTripDurationHours ?? 0) * 60 : undefined,
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
        // Extend fullGeometry to cover both legs so resolveStopTowns can
        // interpolate positions past the midpoint (e.g. ~1855km on a 2786km
        // round trip). Return leg follows the same road in reverse.
        const outboundGeo = tripSummary.fullGeometry ?? [];
        const returnGeo = [...outboundGeo].reverse();
        // Skip the duplicated midpoint (last point of outbound === first of return)
        tripSummary.fullGeometry = [...outboundGeo, ...returnGeo.slice(1)] as [number, number][];
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

      // Day trip arrival time sync: segment arrivalTimes don't include fuel/meal stop
      // durations (those are computed separately by generateSmartStops). Without this
      // adjustment, the printed itinerary shows ~45min earlier arrival than SmartTimeline.
      if (tripDays.length === 1 && tripDays[0].totals.arrivalTime) {
        const smartStops = generateSmartStops(
          tripSummary.segments,
          createStopConfig(vehicle, settings, tripSummary.fullGeometry),
          tripDays,
        );
        // Sum non-overnight stop durations (fuel, meal, rest)
        const totalStopMinutes = smartStops
          .filter(s => s.type !== 'overnight' && !s.dismissed)
          .reduce((sum, s) => sum + s.duration, 0);

        if (totalStopMinutes > 0) {
          const adjustedArrival = new Date(tripDays[0].totals.arrivalTime);
          adjustedArrival.setMinutes(adjustedArrival.getMinutes() + totalStopMinutes);
          tripDays[0].totals.arrivalTime = adjustedArrival.toISOString();
        }
      }

      // Background: snap fuel stop pins to real OSM gas stations.
      // Fire-and-forget — updates markers in place once the query resolves.
      snapFuelStopsToStations(fuelStops).then(snapped => {
        setStrategicFuelStops(snapped);
      }).catch(() => {
        // Silently keep geometry-interpolated positions if Overpass is unavailable
      });

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

      // ── Async overnight-stop snapping (fire-and-forget) ──────────────
      // Transit-split overnight locations have id='transit-split-N-M' and
      // geometry-interpolated lat/lng — they land on the road, not in a town.
      // snapOvernightsToTowns fires one Overpass query and returns the nearest
      // real settlement for each, updating both coordinates AND name.
      snapOvernightsToTowns(tripDays, geocodeController.signal)
        .then(snapped => {
          if (geocodeController.signal.aborted || snapped.length === 0) return;

          const enriched = tripDays.map(d => ({ ...d }));
          let changed = false;

          for (const snap of snapped) {
            const idx = enriched.findIndex(d => d.dayNumber === snap.dayNumber);
            if (idx < 0) continue;

            const day = enriched[idx];
            const firstFrom = day.segments[0]?.from.name ?? '';
            const clonedSegments = [...day.segments];

            if (clonedSegments.length > 0) {
              const lastSegIdx = clonedSegments.length - 1;
              clonedSegments[lastSegIdx] = {
                ...clonedSegments[lastSegIdx],
                to: {
                  ...clonedSegments[lastSegIdx].to,
                  lat: snap.lat,
                  lng: snap.lng,
                  name: snap.name,
                },
              };
            }

            enriched[idx] = {
              ...day,
              route: `${firstFrom} \u2192 ${snap.name}`,
              segments: clonedSegments,
              overnight: {
                ...day.overnight!,
                location: {
                  ...day.overnight!.location,
                  lat: snap.lat,
                  lng: snap.lng,
                  name: snap.name,
                },
              },
            };

            // Propagate to next day's departure point
            if (idx + 1 < enriched.length) {
              const nextDay = enriched[idx + 1];
              const nextCloned = [...nextDay.segments];
              if (nextCloned.length > 0 && nextCloned[0].from.name === 'Overnight Stop') {
                nextCloned[0] = {
                  ...nextCloned[0],
                  from: {
                    ...nextCloned[0].from,
                    lat: snap.lat,
                    lng: snap.lng,
                    name: snap.name,
                  },
                };
                const nextLastTo = nextCloned[nextCloned.length - 1]?.to.name ?? 'Destination';
                enriched[idx + 1] = {
                  ...nextDay,
                  route: `${snap.name} \u2192 ${nextLastTo}`,
                  segments: nextCloned,
                };
              }
            }

            changed = true;
          }

          if (changed) {
            const updatedSummary = { ...tripSummary, days: enriched };
            setLocalSummary(updatedSummary);
            onSummaryChange(updatedSummary);
          }
        })
        .catch(() => {
          // Silently keep interpolated positions if Overpass is unavailable
        });
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

      // Recalculate costs from the strategy's one-way segments
      const newSummary = calculateTripCosts(strategy.segments, vehicle, settings);

      // For round trips, mirror the full outbound+return structure that calculateTrip
      // builds — without this, summary.segments is one-way and any code that iterates
      // segments (stop-type editor, print views) only sees half the trip.
      let allSegments = newSummary.segments;
      if (settings.isRoundTrip) {
        const outbound = newSummary.segments;
        const returnLegs = [...outbound].reverse().map(seg => ({
          ...seg,
          from: seg.to,
          to: seg.from,
          departureTime: undefined,
          arrivalTime: undefined,
          stopDuration: undefined,
          stopType: 'drive' as const,
        }));
        allSegments = calculateArrivalTimes(
          [...outbound, ...returnLegs],
          settings.departureDate,
          settings.departureTime,
          outbound.length, // roundTripMidpoint
        );
        // Recalculate totals from the full round trip
        newSummary.totalDistanceKm = allSegments.reduce((s, seg) => s + seg.distanceKm, 0);
        newSummary.totalDurationMinutes = allSegments.reduce((s, seg) => s + seg.durationMinutes, 0);
        newSummary.totalFuelLitres = allSegments.reduce((s, seg) => s + seg.fuelNeededLitres, 0);
        newSummary.totalFuelCost = allSegments.reduce((s, seg) => s + seg.fuelCost, 0);
        const tankSizeLitres = getTankSizeLitres(vehicle, settings.units);
        newSummary.gasStops = estimateGasStops(newSummary.totalFuelLitres, tankSizeLitres);
        newSummary.costPerPerson = settings.numTravelers > 0
          ? newSummary.totalFuelCost / settings.numTravelers
          : newSummary.totalFuelCost;
      }

      const updatedSummary: TripSummary = {
        ...localSummary,
        totalDistanceKm: newSummary.totalDistanceKm,
        totalDurationMinutes: newSummary.totalDurationMinutes,
        totalFuelLitres: newSummary.totalFuelLitres,
        totalFuelCost: newSummary.totalFuelCost,
        costPerPerson: newSummary.costPerPerson,
        gasStops: newSummary.gasStops,
        fullGeometry: strategy.geometry,
        segments: allSegments,
      };

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
    },
    [localSummary, settings, onSummaryChange]
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
