import { useState, useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import type { TripSummary, TripSettings, Vehicle, StopType, TripDay, DayType, Activity, DayOption, OvernightStop, POISuggestion } from '../../../types';
import { SmartSuggestions } from './SmartSuggestions';
import { SuggestedStopCard } from './SuggestedStopCard';
import { DriverStatsPanel } from './DriverStatsPanel';
import { useTimelineData, type StopOverrides } from './useTimelineData';
import { TripHeaderSummary } from './TripHeaderSummary';
import { DestinationDiscovery } from '../Discovery/DestinationDiscovery';
import { TimelineDialogs, type EditingDayActivity } from './TimelineDialogs';
import type { SuggestedStop } from '../../../lib/stop-suggestions';
import { ItineraryTimelineBody } from './ItineraryTimelineBody';

// ==================== PROPS ====================

interface ItineraryTimelineProps {
  summary: TripSummary;
  settings: TripSettings;
  vehicle?: Vehicle;
  days?: TripDay[];
  onUpdateStopType?: (segmentIndex: number, newStopType: StopType) => void;
  onUpdateActivity?: (segmentIndex: number, activity: Activity | undefined) => void;
  onUpdateDayType?: (dayNumber: number, dayType: DayType) => void;
  onAddDayActivity?: (dayNumber: number, activity: Activity) => void;
  onUpdateDayActivity?: (dayNumber: number, activityIndex: number, activity: Activity) => void;
  onRemoveDayActivity?: (dayNumber: number, activityIndex: number) => void;
  onUpdateDayNotes?: (dayNumber: number, notes: string) => void;
  onUpdateDayTitle?: (dayNumber: number, title: string) => void;
  onAddDayOption?: (dayNumber: number, option: DayOption) => void;
  onRemoveDayOption?: (dayNumber: number, optionIndex: number) => void;
  onSelectDayOption?: (dayNumber: number, optionIndex: number) => void;
  onUpdateOvernight?: (dayNumber: number, overnight: OvernightStop) => void;
  // Destination discovery
  poiSuggestions?: POISuggestion[];
  isLoadingPOIs?: boolean;
  poiPartialResults?: boolean;
  onAddPOI?: (poiId: string, segmentIndex?: number) => void;
  onDismissPOI?: (poiId: string) => void;
  // Map-added stops (pre-accepted SuggestedStops from useAddedStops)
  externalStops?: SuggestedStop[];
  /** Seed from journal — hydrates accept/dismiss/duration state on load. */
  initialStopOverrides?: StopOverrides;
  /** Called whenever accept/dismiss/duration changes — caller persists to journal. */
  onStopOverridesChange?: (overrides: StopOverrides) => void;
}

export function ItineraryTimeline({
  summary,
  settings,
  vehicle,
  days,
  onUpdateStopType,
  onUpdateActivity,
  onUpdateDayType,
  onAddDayActivity,
  onUpdateDayActivity,
  onRemoveDayActivity,
  onUpdateDayNotes,
  onUpdateDayTitle,
  onAddDayOption,
  onRemoveDayOption,
  onSelectDayOption,
  onUpdateOvernight,
  poiSuggestions,
  isLoadingPOIs,
  poiPartialResults,
  onAddPOI,
  onDismissPOI,
  externalStops,
  initialStopOverrides,
  onStopOverridesChange,
}: ItineraryTimelineProps) {
  const {
    acceptedItinerary,
    startTime,
    originTimezone,
    pacingSuggestions,
    pacingSuggestionsByDay,
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
  } = useTimelineData({ summary, settings, vehicle, days, externalStops, initialOverrides: initialStopOverrides, onStopOverridesChange });

  const itineraryDays = acceptedItinerary.days.map(day => day.meta);

  // Collapsible days state — for trips with 5+ days, allow collapse/expand
  const [collapsedDays, setCollapsedDays] = useState<Set<number>>(new Set());
  const toggleDayCollapse = (dayNumber: number) => {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayNumber)) {
        next.delete(dayNumber);
      } else {
        next.add(dayNumber);
      }
      return next;
    });
  };

  // Calculate day counts for header
  const drivingDays = itineraryDays.filter(d => d.segmentIndices.length > 0).length || 1;
  const freeDays = itineraryDays.filter(d => d.segmentIndices.length === 0).length;
  const totalDays = drivingDays + freeDays;

  // Track the standalone activity currently being edited on a Free Day
  const [editingDayActivity, setEditingDayActivity] = useState<EditingDayActivity | null>(null);

  // Last stop's flat index — used for destination detection
  const lastStopFlatIndex = useMemo(() => {
    for (let i = acceptedItinerary.events.length - 1; i >= 0; i--) {
      const event = acceptedItinerary.events[i];
      if ((event.type === 'waypoint' || event.type === 'arrival') && event.flatIndex !== undefined) {
        return event.flatIndex;
      }
    }
    return -1;
  }, [acceptedItinerary.events]);

  return (
    <div className="space-y-6">
      {/* Trip Header Summary */}
      <TripHeaderSummary
        summary={summary}
        drivingDays={drivingDays}
        freeDays={freeDays}
      />

      {/* Smart Suggestions — global fallback when no day structure exists */}
      {!days && <SmartSuggestions suggestions={pacingSuggestions} />}

      {/* Smart Stop Suggestions: inline per-day when days exist, global fallback otherwise */}
      {!days && pendingSuggestions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <h3 className="text-sm font-semibold">Smart Stop Suggestions</h3>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
              {pendingSuggestions.length} suggestion{pendingSuggestions.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-3">
            {pendingSuggestions.map(stop => (
              <SuggestedStopCard
                key={stop.id}
                stop={stop}
                onAccept={handleAccept}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        </div>
      )}

      <ItineraryTimelineBody
        summary={summary}
        settings={settings}
        days={itineraryDays}
        startTime={startTime}
        originTimezone={originTimezone}
        simulationItems={simulationItems}
        lastStopFlatIndex={lastStopFlatIndex ?? -1}
        dayStartMap={dayStartMap}
        freeDaysAfterSegment={freeDaysAfterSegment}
        pacingSuggestionsByDay={pacingSuggestionsByDay}
        pendingSuggestionsByDay={pendingSuggestionsByDay}
        overnightNightsByDay={overnightNightsByDay}
        driverBySegment={driverBySegment}
        totalDays={totalDays}
        collapsedDays={collapsedDays}
        toggleDayCollapse={toggleDayCollapse}
        handleAccept={handleAccept}
        handleDismiss={handleDismiss}
        setEditingActivity={setEditingActivity}
        setEditingOvernight={setEditingOvernight}
        setEditingDayActivity={setEditingDayActivity}
        onUpdateStopType={onUpdateStopType}
        onUpdateActivity={onUpdateActivity}
        onUpdateDayType={onUpdateDayType}
        onAddDayActivity={onAddDayActivity}
        onUpdateDayActivity={onUpdateDayActivity}
        onUpdateDayNotes={onUpdateDayNotes}
        onUpdateDayTitle={onUpdateDayTitle}
        onAddDayOption={onAddDayOption}
        onRemoveDayOption={onRemoveDayOption}
        onSelectDayOption={onSelectDayOption}
        onUpdateOvernight={onUpdateOvernight}
      />

      {/* Driver Stats (when multiple drivers) */}
      {driverRotation && driverRotation.stats.length > 1 && (
        <DriverStatsPanel stats={driverRotation.stats} />
      )}

      {/* Destination Discovery */}
      {onAddPOI && onDismissPOI && (poiSuggestions?.length || isLoadingPOIs) && (
        <DestinationDiscovery
          summary={summary}
          poiSuggestions={poiSuggestions}
          isLoadingPOIs={isLoadingPOIs}
          poiPartialResults={poiPartialResults}
          onAddPOI={onAddPOI}
          onDismissPOI={onDismissPOI}
        />
      )}

      <TimelineDialogs
        editingActivity={editingActivity}
        onUpdateActivity={onUpdateActivity}
        setEditingActivity={setEditingActivity}
        editingOvernight={editingOvernight}
        onUpdateOvernight={onUpdateOvernight}
        setEditingOvernight={setEditingOvernight}
        editingDayActivity={editingDayActivity}
        onAddDayActivity={onAddDayActivity}
        onUpdateDayActivity={onUpdateDayActivity}
        onRemoveDayActivity={onRemoveDayActivity}
        setEditingDayActivity={setEditingDayActivity}
      />
    </div>
  );
}
