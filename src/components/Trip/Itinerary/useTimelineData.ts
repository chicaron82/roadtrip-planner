import { useState } from 'react';
import type { TripSummary, TripSettings, Vehicle, TripDay, Activity, OvernightStop } from '../../../types';
import type { SuggestedStop } from '../../../lib/stop-suggestions';
import type { SimulationItem } from '../../../lib/timeline-simulation';
import { useTimelineStopSuggestions } from './useTimelineStopSuggestions';
import { useTimelineDerivedMaps } from './useTimelineDerivedMaps';
import type { StopOverrides } from '../timeline-data-types';

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

export interface UseTimelineDataResult {
  userOverrides: StopOverrides;
  startTime: Date;
  originTimezone?: string;
  pacingSuggestions: string[];
  pacingSuggestionsByDay: Map<number, string[]>;
  activeSuggestions: SuggestedStop[];
  acceptedItinerary: AcceptedItineraryInput;
  simulationItems: SimulationItem[];
  pendingSuggestions: SuggestedStop[];
  pendingSuggestionsByDay: Map<number, SuggestedStop[]>;
  overnightNightsByDay: Map<number, number>;
  driverRotation: ReturnType<typeof useTimelineDerivedMaps>['driverRotation'];
  driverBySegment: Map<number, number>;
  dayStartMap: ReturnType<typeof useTimelineDerivedMaps>['dayStartMap'];
  freeDaysAfterSegment: Map<number, TripDay[]>;
  handleAccept: (stopId: string, customDuration?: number) => void;
  handleDismiss: (stopId: string) => void;
  editingActivity: {
    segmentIndex: number;
    activity?: Activity;
    locationName?: string;
  } | null;
  setEditingActivity: React.Dispatch<React.SetStateAction<{
    segmentIndex: number;
    activity?: Activity;
    locationName?: string;
  } | null>>;
  editingOvernight: {
    dayNumber: number;
    overnight: OvernightStop;
  } | null;
  setEditingOvernight: React.Dispatch<React.SetStateAction<{
    dayNumber: number;
    overnight: OvernightStop;
  } | null>>;
}

// ---------------------------------------------------------------------------

export function useTimelineData({ summary, settings, vehicle, days, externalStops, initialOverrides, onStopOverridesChange }: UseTimelineDataParams): UseTimelineDataResult {
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
