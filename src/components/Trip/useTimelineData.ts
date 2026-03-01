import { useState, useMemo } from 'react';
import type { TripSummary, TripSettings, Vehicle, TripDay, Activity, OvernightStop } from '../../types';
import { generateSmartStops, createStopConfig, type SuggestedStop } from '../../lib/stop-suggestions';
import { assignDrivers, extractFuelStopIndices } from '../../lib/driver-rotation';
import { buildSimulationItems, type SimulationItem } from '../../lib/timeline-simulation';
import { buildPacingSuggestions } from '../../lib/pacing-suggestions-builder';

// ---------------------------------------------------------------------------
export type { SimulationItem };

interface UseTimelineDataParams {
  summary: TripSummary;
  settings: TripSettings;
  vehicle?: Vehicle;
  days?: TripDay[];
  externalStops?: SuggestedStop[];
}

// ---------------------------------------------------------------------------

export function useTimelineData({ summary, settings, vehicle, days, externalStops }: UseTimelineDataParams) {
  const startTime = useMemo(
    () => new Date(`${settings.departureDate}T${settings.departureTime}`),
    [settings.departureDate, settings.departureTime],
  );

  // Activity editor state
  const [editingActivity, setEditingActivity] = useState<{
    segmentIndex: number;
    activity?: Activity;
    locationName?: string;
  } | null>(null);

  // Overnight editor state
  const [editingOvernight, setEditingOvernight] = useState<{
    dayNumber: number;
    overnight: OvernightStop;
  } | null>(null);

  // Generate smart suggestions — use per-driving-day duration, not total trip time
  const drivingDays = useMemo(
    () => days?.filter(d => d.segmentIndices.length > 0) ?? [],
    [days]
  );
  const isAlreadySplit = drivingDays.length > 1;
  const maxDayMinutes = isAlreadySplit
    ? Math.max(...drivingDays.map(d => d.totals?.driveTimeMinutes ?? 0))
    : summary.totalDurationMinutes;
  const pacingSuggestions = useMemo(() => buildPacingSuggestions({
    maxDayMinutes,
    settings,
    isAlreadySplit,
    summary,
    vehicle,
    startTime,
  }), [maxDayMinutes, settings, isAlreadySplit, summary, vehicle, startTime]);

  // Map pacing suggestions to specific days for inline rendering.
  // Return trip tips → day that starts the return leg; general tips → first driving day.
  const pacingSuggestionsByDay = useMemo(() => {
    const map = new Map<number, string[]>();
    if (!days || pacingSuggestions.length === 0) return map;

    // Find the return leg start day (if round trip)
    let returnDayNumber: number | null = null;
    if (summary.roundTripMidpoint != null && summary.roundTripMidpoint > 0) {
      const returnDay = days.find(d =>
        d.segmentIndices.includes(summary.roundTripMidpoint!)
      );
      if (returnDay) returnDayNumber = returnDay.dayNumber;
    }

    // First driving day for general suggestions
    const firstDrivingDay = drivingDays[0];

    pacingSuggestions.forEach(suggestion => {
      // Return trip tip goes to the return day
      if (suggestion.includes('Return trip tip') && returnDayNumber) {
        const existing = map.get(returnDayNumber) ?? [];
        map.set(returnDayNumber, [...existing, suggestion]);
      } else if (firstDrivingDay) {
        // General tips go to first driving day
        const existing = map.get(firstDrivingDay.dayNumber) ?? [];
        map.set(firstDrivingDay.dayNumber, [...existing, suggestion]);
      }
    });

    return map;
  }, [days, drivingDays, pacingSuggestions, summary.roundTripMidpoint]);

  // Base suggestions — pure computation, regenerates whenever the trip/vehicle/settings change.
  const baseSuggestions = useMemo(() => {
    if (!vehicle) return [];
    const config = createStopConfig(vehicle, settings, summary.fullGeometry);
    return generateSmartStops(summary.segments, config, days);
  }, [summary.segments, summary.fullGeometry, vehicle, settings, days]);

  // Per-stop user overrides — kept separate so baseSuggestions can regenerate without wiping
  // decisions the user already made (accept, dismiss, custom duration).
  const [userOverrides, setUserOverrides] = useState<Record<string, { accepted?: boolean; dismissed?: boolean; duration?: number }>>({});

  // Merged: base suggestions with any user overrides applied on top
  const stopSuggestions = useMemo(() =>
    baseSuggestions.map(s => {
      const o = userOverrides[s.id];
      if (!o) return s;
      return {
        ...s,
        accepted: o.accepted ?? s.accepted,
        dismissed: o.dismissed ?? s.dismissed,
        duration: o.duration ?? s.duration,
      };
    }),
    [baseSuggestions, userOverrides],
  );

  const handleAccept = (stopId: string, customDuration?: number) => {
    setUserOverrides(prev => ({
      ...prev,
      [stopId]: { ...prev[stopId], accepted: true, ...(customDuration !== undefined ? { duration: customDuration } : {}) },
    }));
  };

  const handleDismiss = (stopId: string) => {
    setUserOverrides(prev => ({
      ...prev,
      [stopId]: { ...prev[stopId], dismissed: true },
    }));
  };

  // Filter active suggestions (not dismissed) + merge map-added stops
  const activeSuggestions = useMemo(() => [
    ...stopSuggestions.filter(s => !s.dismissed),
    ...(externalStops || []),
  ], [stopSuggestions, externalStops]);

  // Build simulation items including accepted stops
  const simulationItems = useMemo(() => buildSimulationItems({
    summary,
    settings,
    vehicle,
    days,
    startTime,
    activeSuggestions,
  }), [summary, settings, vehicle, days, startTime, activeSuggestions]);

  // Pending suggestions (not yet accepted or dismissed)
  const pendingSuggestions = activeSuggestions.filter(s => !s.accepted);

  // Map dayNumber → pending suggestions for that day (inline rendering)
  const pendingSuggestionsByDay = useMemo(() => {
    const map = new Map<number, SuggestedStop[]>();
    if (!days) return map;
    pendingSuggestions.forEach(stop => {
      // Prefer the stop's explicit dayNumber when set. En-route fuel stops
      // use afterSegmentIndex = index - 1 (by convention), which maps to the
      // PREVIOUS segment's day — wrong for return-leg stops. dayNumber is
      // set correctly by the generator and avoids this mismatch.
      if (stop.dayNumber) {
        const targetDay = days.find(d => d.dayNumber === stop.dayNumber);
        if (targetDay) {
          const existing = map.get(targetDay.dayNumber) ?? [];
          map.set(targetDay.dayNumber, [...existing, stop]);
          return;
        }
      }
      if (stop.afterSegmentIndex === -1) {
        const firstDrivingDay = days.find(d => d.segmentIndices.length > 0);
        if (firstDrivingDay) {
          const existing = map.get(firstDrivingDay.dayNumber) ?? [];
          map.set(firstDrivingDay.dayNumber, [...existing, stop]);
        }
        return;
      }
      // Use Math.floor to handle fractional afterSegmentIndex values from getEnRouteFuelStops
      // (e.g., 49.01, 49.02 for multiple en-route stops on the same segment)
      const segIdx = Math.floor(stop.afterSegmentIndex);
      const ownerDay = days.find(d => d.segmentIndices.includes(segIdx));
      if (ownerDay) {
        const existing = map.get(ownerDay.dayNumber) ?? [];
        map.set(ownerDay.dayNumber, [...existing, stop]);
      }
    });
    return map;
  }, [days, pendingSuggestions]);

  // Map dayNumber → nights at overnight stop
  const overnightNightsByDay = useMemo(() => {
    const map = new Map<number, number>();
    if (!days) return map;
    days.forEach((day, idx) => {
      if (!day.overnight) return;
      const nextDriving = days.slice(idx + 1).find(d => d.segmentIndices.length > 0);
      if (nextDriving) {
        const nights = Math.round(
          (new Date(nextDriving.date + 'T00:00:00').getTime() - new Date(day.date + 'T00:00:00').getTime())
          / (1000 * 60 * 60 * 24)
        );
        if (nights > 0) map.set(day.dayNumber, nights);
      }
    });
    return map;
  }, [days]);

  // Driver rotation overlay (computed, never mutates segment data)
  const driverRotation = useMemo(() => {
    if (settings.numDrivers <= 1) return null;
    const fuelIndices = extractFuelStopIndices(simulationItems);
    return assignDrivers(summary.segments, settings.numDrivers, fuelIndices);
  }, [summary.segments, settings.numDrivers, simulationItems]);

  // Quick lookup: segment index → driver number
  const driverBySegment = useMemo(() => {
    if (!driverRotation) return new Map<number, number>();
    return new Map(driverRotation.assignments.map(a => [a.segmentIndex, a.driver]));
  }, [driverRotation]);

  // Map: segment index → TripDay[], keyed on the day's first segment.
  // Multiple days can share the same segmentIndices[0] when a long segment was
  // split by splitLongSegments (e.g. Winnipeg→Montreal split across Day 1 + Day 2 —
  // both reference original segment index 0). Accumulating into an array prevents
  // the later day from silently overwriting the earlier one.
  const dayStartMap = useMemo(() => {
    const map = new Map<number, { day: TripDay; isFirst: boolean }[]>();
    if (days) {
      days.forEach((day, idx) => {
        if (day.segmentIndices.length > 0) {
          const key = day.segmentIndices[0];
          const existing = map.get(key) ?? [];
          map.set(key, [...existing, { day, isFirst: idx === 0 }]);
        }
      });
    }
    return map;
  }, [days]);

  // Map: last-segment-index-of-a-driving-day → free TripDay[] that follow it
  const freeDaysAfterSegment = useMemo(() => {
    const map = new Map<number, TripDay[]>();
    if (!days) return map;
    days.forEach(day => {
      if (day.segmentIndices.length > 0) return;
      const dayIdx = days.indexOf(day);
      for (let i = dayIdx - 1; i >= 0; i--) {
        if (days[i].segmentIndices.length > 0) {
          const lastSeg = days[i].segmentIndices[days[i].segmentIndices.length - 1];
          const existing = map.get(lastSeg) ?? [];
          map.set(lastSeg, [...existing, day]);
          break;
        }
      }
    });
    return map;
  }, [days]);

  return {
    startTime,
    pacingSuggestions,
    pacingSuggestionsByDay,
    activeSuggestions,
    simulationItems,
    pendingSuggestions,
    pendingSuggestionsByDay,
    overnightNightsByDay,
    driverRotation,
    driverBySegment,
    dayStartMap,
    freeDaysAfterSegment,
    handleAccept,
    handleDismiss,
    editingActivity,
    setEditingActivity,
    editingOvernight,
    setEditingOvernight,
  };
}
