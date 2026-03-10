import { useState, useMemo } from 'react';
import type { TripSettings, Vehicle, TripDay } from '../../../types';
import { generateSmartStops, createStopConfig, type SuggestedStop } from '../../../lib/stop-suggestions';
import { buildPacingSuggestions } from '../../../lib/pacing-suggestions-builder';
import { getTripStartTime, lngToIANA } from '../../../lib/trip-timezone';
import type { RoutePlanningSummary } from '../../../lib/trip-summary-slices';
import type { StopOverrides } from '../timeline-data-types';

interface UseTimelineStopSuggestionsParams {
  routeSummary: RoutePlanningSummary;
  settings: TripSettings;
  vehicle?: Vehicle;
  days?: TripDay[];
  externalStops?: SuggestedStop[];
  initialOverrides?: StopOverrides;
  onStopOverridesChange?: (overrides: StopOverrides) => void;
}

export function useTimelineStopSuggestions({
  routeSummary,
  settings,
  vehicle,
  days,
  externalStops,
  initialOverrides,
  onStopOverridesChange,
}: UseTimelineStopSuggestionsParams) {
  const originTimezone = useMemo(() => {
    const originLng = routeSummary.segments[0]?.from.lng;
    return originLng !== undefined ? lngToIANA(originLng) : undefined;
  }, [routeSummary.segments]);

  const startTime = useMemo(() => {
    return getTripStartTime(settings.departureDate, settings.departureTime, routeSummary.segments[0]?.from.lng);
  }, [settings.departureDate, settings.departureTime, routeSummary.segments]);

  const drivingDays = useMemo(
    () => days?.filter(day => day.segmentIndices.length > 0) ?? [],
    [days],
  );
  const isAlreadySplit = drivingDays.length > 1;
  const maxDayMinutes = isAlreadySplit
    ? Math.max(...drivingDays.map(day => day.totals?.driveTimeMinutes ?? 0))
    : routeSummary.totalDurationMinutes;

  const pacingSuggestions = useMemo(() => buildPacingSuggestions({
    maxDayMinutes,
    settings,
    isAlreadySplit,
    routeSummary,
    vehicle,
    startTime,
  }), [maxDayMinutes, settings, isAlreadySplit, routeSummary, vehicle, startTime]);

  const pacingSuggestionsByDay = useMemo(() => {
    const map = new Map<number, string[]>();
    if (!days || pacingSuggestions.length === 0) return map;

    let returnDayNumber: number | null = null;
    const roundTripMidpoint = routeSummary.roundTripMidpoint;
    if (roundTripMidpoint != null && roundTripMidpoint > 0) {
      const returnDay = days.find(day => day.segmentIndices.includes(roundTripMidpoint));
      if (returnDay) returnDayNumber = returnDay.dayNumber;
    }

    const firstDrivingDay = drivingDays[0];
    pacingSuggestions.forEach(suggestion => {
      if (suggestion.includes('Return trip tip') && returnDayNumber) {
        const existing = map.get(returnDayNumber) ?? [];
        map.set(returnDayNumber, [...existing, suggestion]);
        return;
      }
      if (firstDrivingDay) {
        const existing = map.get(firstDrivingDay.dayNumber) ?? [];
        map.set(firstDrivingDay.dayNumber, [...existing, suggestion]);
      }
    });

    return map;
  }, [days, drivingDays, pacingSuggestions, routeSummary.roundTripMidpoint]);

  const baseSuggestions = useMemo(() => {
    if (!vehicle) return [];
    const config = createStopConfig(vehicle, settings, routeSummary.fullGeometry, routeSummary.segments[0]?.from.lng);
    return generateSmartStops(routeSummary.segments, config, days);
  }, [routeSummary.segments, routeSummary.fullGeometry, vehicle, settings, days]);

  // Lazy init so the prop value is consumed once on mount, matching the original
  // one-shot hydration guard without needing an effect.
  const [userOverrides, setUserOverrides] = useState<StopOverrides>(
    () => (initialOverrides && Object.keys(initialOverrides).length > 0) ? initialOverrides : {},
  );

  const stopSuggestions = useMemo(() =>
    baseSuggestions.map(suggestion => {
      const override = userOverrides[suggestion.id];
      if (!override) return suggestion;
      return {
        ...suggestion,
        accepted: override.accepted ?? suggestion.accepted,
        dismissed: override.dismissed ?? suggestion.dismissed,
        duration: override.duration ?? suggestion.duration,
      };
    }),
  [baseSuggestions, userOverrides]);

  const handleAccept = (stopId: string, customDuration?: number) => {
    setUserOverrides(prev => {
      const next = {
        ...prev,
        [stopId]: { ...prev[stopId], accepted: true, ...(customDuration !== undefined ? { duration: customDuration } : {}) },
      };
      onStopOverridesChange?.(next);
      return next;
    });
  };

  const handleDismiss = (stopId: string) => {
    setUserOverrides(prev => {
      const next = { ...prev, [stopId]: { ...prev[stopId], dismissed: true } };
      onStopOverridesChange?.(next);
      return next;
    });
  };

  const activeSuggestions = useMemo(() => [
    ...stopSuggestions.filter(suggestion => !suggestion.dismissed),
    ...(externalStops || []),
  ], [stopSuggestions, externalStops]);

  const pendingSuggestions = activeSuggestions.filter(suggestion => !suggestion.accepted);

  const pendingSuggestionsByDay = useMemo(() => {
    const map = new Map<number, SuggestedStop[]>();
    if (!days) return map;

    pendingSuggestions.forEach(stop => {
      if (stop.dayNumber) {
        const targetDay = days.find(day => day.dayNumber === stop.dayNumber);
        if (targetDay) {
          const existing = map.get(targetDay.dayNumber) ?? [];
          map.set(targetDay.dayNumber, [...existing, stop]);
          return;
        }
      }

      if (stop.afterSegmentIndex === -1) {
        const firstDrivingDay = days.find(day => day.segmentIndices.length > 0);
        if (firstDrivingDay) {
          const existing = map.get(firstDrivingDay.dayNumber) ?? [];
          map.set(firstDrivingDay.dayNumber, [...existing, stop]);
        }
        return;
      }

      const segmentIndex = Math.floor(stop.afterSegmentIndex);
      const ownerDay = days.find(day => day.segmentIndices.includes(segmentIndex));
      if (ownerDay) {
        const existing = map.get(ownerDay.dayNumber) ?? [];
        map.set(ownerDay.dayNumber, [...existing, stop]);
      }
    });

    return map;
  }, [days, pendingSuggestions]);

  return {
    userOverrides,
    originTimezone,
    startTime,
    pacingSuggestions,
    pacingSuggestionsByDay,
    activeSuggestions,
    pendingSuggestions,
    pendingSuggestionsByDay,
    handleAccept,
    handleDismiss,
  };
}