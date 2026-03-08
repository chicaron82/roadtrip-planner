import { useState } from 'react';
import type { TripSummary, TripSettings, Vehicle, TripDay, Activity, OvernightStop } from '../../types';
import type { SuggestedStop } from '../../lib/stop-suggestions';
import type { SimulationItem } from '../../lib/timeline-simulation';
import { useTimelineStopSuggestions } from './useTimelineStopSuggestions';
import { useTimelineDerivedMaps } from './useTimelineDerivedMaps';
import type { StopOverrides } from './timeline-data-types';

export type { SimulationItem };
export type { StopOverrides };

interface UseTimelineDataParams {
  summary: TripSummary;
  settings: TripSettings;
  vehicle?: Vehicle;
  days?: TripDay[];
  externalStops?: SuggestedStop[];
  /** Pre-load override state from a saved journal (hydrates once on mount/journal-load). */
  initialOverrides?: StopOverrides;
  /** Called on every accept/dismiss/duration change so the caller can persist to journal. */
  onStopOverridesChange?: (overrides: StopOverrides) => void;
}

// ---------------------------------------------------------------------------

export function useTimelineData({ summary, settings, vehicle, days, externalStops, initialOverrides, onStopOverridesChange }: UseTimelineDataParams) {
  const [editingActivity, setEditingActivity] = useState<{
    segmentIndex: number;
    activity?: Activity;
    locationName?: string;
  } | null>(null);

  const [editingOvernight, setEditingOvernight] = useState<{
    dayNumber: number;
    overnight: OvernightStop;
  } | null>(null);
  const {
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
  } = useTimelineStopSuggestions({
    summary,
    settings,
    vehicle,
    days,
    externalStops,
    initialOverrides,
    onStopOverridesChange,
  });

  const {
    acceptedItinerary,
    simulationItems,
    overnightNightsByDay,
    driverRotation,
    driverBySegment,
    dayStartMap,
    freeDaysAfterSegment,
  } = useTimelineDerivedMaps({
    summary,
    settings,
    vehicle,
    days,
    startTime,
    activeSuggestions,
  });

  return {
    userOverrides,
    startTime,
    originTimezone,
    pacingSuggestions,
    pacingSuggestionsByDay,
    activeSuggestions,
    acceptedItinerary,
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
