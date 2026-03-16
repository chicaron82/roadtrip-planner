import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { TripSettings, Vehicle, StopType, TripDay, DayType, Activity, DayOption, OvernightStop, POISuggestion } from '../../../types';
import { SmartSuggestions } from './SmartSuggestions';
import { SuggestedStopCard } from './SuggestedStopCard';
import { DriverStatsPanel } from './DriverStatsPanel';
import { useTimelineData, type StopOverrides, type UseTimelineDataResult } from './useTimelineData';
import { TripHeaderSummary } from './TripHeaderSummary';
import { DestinationDiscovery } from '../Discovery/DestinationDiscovery';
import { TimelineDialogs, type EditingDayActivity } from './TimelineDialogs';
import type { SuggestedStop } from '../../../lib/stop-suggestions';
import { ItineraryTimelineBody } from './ItineraryTimelineBody';
import { computeSwapAssignments, getDriverName } from '../../../lib/driver-rotation';
import type { CanonicalTripDay } from '../../../lib/canonical-trip';
import type { ViewerRouteSummary } from '../../../lib/trip-summary-slices';

interface ItineraryTimelineProps {
  summary: ViewerRouteSummary;
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
  poiSuggestions?: POISuggestion[];
  isLoadingPOIs?: boolean;
  poiPartialResults?: boolean;
  poiFetchFailed?: boolean;
  onAddPOI?: (poiId: string, segmentIndex?: number) => void;
  onDismissPOI?: (poiId: string) => void;
  externalStops?: SuggestedStop[];
  initialStopOverrides?: StopOverrides;
  onStopOverridesChange?: (overrides: StopOverrides) => void;
}

interface ItineraryTimelineContentProps extends Omit<ItineraryTimelineProps, 'initialStopOverrides' | 'onStopOverridesChange' | 'externalStops'> {
  timelineData: UseTimelineDataResult;
}

export function ItineraryTimelineContent({
  summary,
  settings,
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
  poiFetchFailed,
  onAddPOI,
  onDismissPOI,
  timelineData,
}: ItineraryTimelineContentProps) {
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
  } = timelineData;

  const itineraryDays: TripDay[] = acceptedItinerary.days.map((day: CanonicalTripDay) => day.meta);

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

  const drivingDays = itineraryDays.filter(day => day.segmentIndices.length > 0).length || 1;
  const freeDays = itineraryDays.filter(day => day.segmentIndices.length === 0).length;
  const totalDays = drivingDays + freeDays;

  const [editingDayActivity, setEditingDayActivity] = useState<EditingDayActivity | null>(null);

  const lastStopFlatIndex = useMemo(() => {
    for (let index = acceptedItinerary.events.length - 1; index >= 0; index--) {
      const event = acceptedItinerary.events[index];
      if ((event.type === 'waypoint' || event.type === 'arrival') && event.flatIndex !== undefined) {
        return event.flatIndex;
      }
    }
    return -1;
  }, [acceptedItinerary.events]);

  const swapSuggestions = useMemo((): Record<string, number> => {
    if (!driverRotation || settings.numDrivers <= 1) return {};
    const allFuelStops: SuggestedStop[] = [];
    pendingSuggestionsByDay.forEach(stops =>
      stops.filter(stop => stop.type === 'fuel').forEach(stop => allFuelStops.push(stop)),
    );
    pendingSuggestions.filter(stop => stop.type === 'fuel').forEach(stop => allFuelStops.push(stop));
    allFuelStops.sort((left, right) => left.estimatedTime.getTime() - right.estimatedTime.getTime());
    return computeSwapAssignments(
      allFuelStops.map(s => ({ id: s.id, segmentIndex: Math.floor(s.afterSegmentIndex) })),
      driverRotation,
      settings.numDrivers,
    );
  }, [driverRotation, pendingSuggestionsByDay, pendingSuggestions, settings.numDrivers]);

  return (
    <div className="space-y-6">
      <TripHeaderSummary
        summary={summary}
        drivingDays={drivingDays}
        freeDays={freeDays}
      />

      {!days && <SmartSuggestions suggestions={pacingSuggestions} />}

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
                swapDriver={swapSuggestions[stop.id] != null ? {
                  number: swapSuggestions[stop.id],
                  name: getDriverName(swapSuggestions[stop.id], settings.driverNames),
                } : undefined}
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
        lastStopFlatIndex={lastStopFlatIndex}
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
        swapSuggestions={swapSuggestions}
      />

      {driverRotation && driverRotation.stats.length > 1 && (
        <DriverStatsPanel stats={driverRotation.stats} driverNames={settings.driverNames} />
      )}

      {onAddPOI && onDismissPOI && (poiSuggestions?.length || isLoadingPOIs || poiFetchFailed) && (
        <DestinationDiscovery
          summary={summary}
          poiSuggestions={poiSuggestions}
          isLoadingPOIs={isLoadingPOIs}
          poiPartialResults={poiPartialResults}
          poiFetchFailed={poiFetchFailed}
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
  poiFetchFailed,
  onAddPOI,
  onDismissPOI,
  externalStops,
  initialStopOverrides,
  onStopOverridesChange,
}: ItineraryTimelineProps) {
  const timelineData = useTimelineData({
    summary,
    settings,
    vehicle,
    days,
    externalStops,
    initialOverrides: initialStopOverrides,
    onStopOverridesChange,
  });

  return (
    <ItineraryTimelineContent
      summary={summary}
      settings={settings}
      vehicle={vehicle}
      days={days}
      onUpdateStopType={onUpdateStopType}
      onUpdateActivity={onUpdateActivity}
      onUpdateDayType={onUpdateDayType}
      onAddDayActivity={onAddDayActivity}
      onUpdateDayActivity={onUpdateDayActivity}
      onRemoveDayActivity={onRemoveDayActivity}
      onUpdateDayNotes={onUpdateDayNotes}
      onUpdateDayTitle={onUpdateDayTitle}
      onAddDayOption={onAddDayOption}
      onRemoveDayOption={onRemoveDayOption}
      onSelectDayOption={onSelectDayOption}
      onUpdateOvernight={onUpdateOvernight}
      poiSuggestions={poiSuggestions}
      isLoadingPOIs={isLoadingPOIs}
      poiPartialResults={poiPartialResults}
      poiFetchFailed={poiFetchFailed}
      onAddPOI={onAddPOI}
      onDismissPOI={onDismissPOI}
      timelineData={timelineData}
    />
  );
}
