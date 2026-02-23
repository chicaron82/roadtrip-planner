import { Sparkles } from 'lucide-react';
import type { TripSummary, TripSettings, Vehicle, StopType, TripDay, DayType, Activity, DayOption, OvernightStop, POISuggestion } from '../../types';
import { SmartSuggestions } from './SmartSuggestions';
import { SuggestedStopCard } from './SuggestedStopCard';
import { DiscoveryPanel } from './DiscoveryPanel';
import { ActivityEditor } from './ActivityEditor';
import { StartNode, GasStopNode, SuggestedStopNode, WaypointNode } from './TimelineNode';
import { DaySection } from './DaySection';
import { DriverStatsPanel } from './DriverStatsPanel';
import { OvernightEditor } from './OvernightEditor';
import { useTimelineData } from './useTimelineData';
import type { SuggestedStop } from '../../lib/stop-suggestions';

interface ItineraryTimelineProps {
  summary: TripSummary;
  settings: TripSettings;
  vehicle?: Vehicle;
  days?: TripDay[];
  onUpdateStopType?: (segmentIndex: number, newStopType: StopType) => void;
  onUpdateActivity?: (segmentIndex: number, activity: Activity | undefined) => void;
  onUpdateDayType?: (dayNumber: number, dayType: DayType) => void;
  onUpdateDayNotes?: (dayNumber: number, notes: string) => void;
  onUpdateDayTitle?: (dayNumber: number, title: string) => void;
  onAddDayOption?: (dayNumber: number, option: DayOption) => void;
  onRemoveDayOption?: (dayNumber: number, optionIndex: number) => void;
  onSelectDayOption?: (dayNumber: number, optionIndex: number) => void;
  onUpdateOvernight?: (dayNumber: number, overnight: OvernightStop) => void;
  // Destination discovery
  poiSuggestions?: POISuggestion[];
  isLoadingPOIs?: boolean;
  onAddPOI?: (poiId: string) => void;
  onDismissPOI?: (poiId: string) => void;
  // Map-added stops (pre-accepted SuggestedStops from useAddedStops)
  externalStops?: SuggestedStop[];
}

export function ItineraryTimeline({
  summary,
  settings,
  vehicle,
  days,
  onUpdateStopType,
  onUpdateActivity,
  onUpdateDayType,
  onUpdateDayNotes,
  onUpdateDayTitle,
  onAddDayOption,
  onRemoveDayOption,
  onSelectDayOption,
  onUpdateOvernight,
  poiSuggestions,
  isLoadingPOIs,
  onAddPOI,
  onDismissPOI,
  externalStops,
}: ItineraryTimelineProps) {
  const {
    startTime,
    pacingSuggestions,
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
  } = useTimelineData({ summary, settings, vehicle, days, externalStops });

  return (
    <div className="space-y-6">
      {/* Smart Suggestions */}
      <SmartSuggestions suggestions={pacingSuggestions} />

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

      {/* Timeline */}
      <div className="space-y-0 pt-2 relative pb-12">
        {/* Timeline Line (Background) */}
        <div className="absolute left-[19px] top-4 bottom-0 w-0.5 bg-border -z-10"></div>

        {/* Start Node */}
        <StartNode
          locationName={summary.segments[0]?.from.name || 'Origin'}
          startTime={startTime}
          isCalculatedDeparture={settings.useArrivalTime}
        />

        {/* Simulation Items */}
        {simulationItems.map((item, idx) => {
          if (item.type === 'gas') {
            return (
              <GasStopNode
                key={`gas-${idx}`}
                arrivalTime={item.arrivalTime}
                cost={item.cost}
                litres={item.litres}
                priority={item.fuelPriority}
              />
            );
          }

          if (item.type === 'suggested' && item.suggestedStop) {
            return (
              <SuggestedStopNode
                key={`suggested-${idx}`}
                arrivalTime={item.arrivalTime}
                stop={item.suggestedStop}
              />
            );
          }

          if (item.segment && typeof item.index === 'number') {
            const freeDaysAfter = freeDaysAfterSegment.get(item.index) ?? [];
            const dayEntries = typeof item.index === 'number' ? (dayStartMap.get(item.index) ?? []) : [];
            return (
              <div key={`stop-${item.index}`}>
                {dayEntries.map(({ day: entryDay, isFirst }) => (
                  <div key={`day-${entryDay.dayNumber}`} className="mb-4">
                    <DaySection
                      day={entryDay}
                      isFirst={isFirst}
                      editable={!!onUpdateDayType}
                      budgetMode={settings.budgetMode}
                      onDayTypeChange={onUpdateDayType}
                      onTitleChange={onUpdateDayTitle}
                      onNotesChange={onUpdateDayNotes}
                      onAddDayOption={onAddDayOption}
                      onRemoveDayOption={onRemoveDayOption}
                      onSelectDayOption={onSelectDayOption}
                      overnightNights={overnightNightsByDay.get(entryDay.dayNumber)}
                      onEditOvernight={onUpdateOvernight && entryDay.overnight ? (dayNum) => {
                        const target = days?.find(d => d.dayNumber === dayNum);
                        if (target?.overnight) {
                          setEditingOvernight({ dayNumber: dayNum, overnight: target.overnight });
                        }
                      } : undefined}
                    />
                    {/* Inline suggestions for this day */}
                    {(pendingSuggestionsByDay.get(entryDay.dayNumber) ?? []).map(stop => (
                      <div key={stop.id} className="mt-2 ml-10">
                        <SuggestedStopCard
                          stop={stop}
                          onAccept={handleAccept}
                          onDismiss={handleDismiss}
                        />
                      </div>
                    ))}
                  </div>
                ))}
                <WaypointNode
                  segment={item.segment}
                  arrivalTime={item.arrivalTime}
                  index={item.index}
                  isDestination={item.index === summary.segments.length - 1}
                  onUpdateStopType={onUpdateStopType}
                  onEditActivity={onUpdateActivity ? (segIdx, activity, locName) => {
                    setEditingActivity({ segmentIndex: segIdx, activity, locationName: locName });
                  } : undefined}
                  activity={item.segment.activity}
                  assignedDriver={driverBySegment.get(item.index)}
                />
                {freeDaysAfter.map(freeDay => (
                  <div key={`free-day-${freeDay.dayNumber}`} className="mt-4">
                    <DaySection
                      day={freeDay}
                      isFirst={false}
                      editable={!!onUpdateDayType}
                      budgetMode={settings.budgetMode}
                      onDayTypeChange={onUpdateDayType}
                      onTitleChange={onUpdateDayTitle}
                      onNotesChange={onUpdateDayNotes}
                      onAddDayOption={onAddDayOption}
                      onRemoveDayOption={onRemoveDayOption}
                      onSelectDayOption={onSelectDayOption}
                    />
                  </div>
                ))}
              </div>
            );
          }

          return null;
        })}
      </div>

      {/* Driver Stats (when multiple drivers) */}
      {driverRotation && driverRotation.stats.length > 1 && (
        <DriverStatsPanel stats={driverRotation.stats} />
      )}

      {/* Destination Discovery */}
      {onAddPOI && onDismissPOI && (poiSuggestions?.length || isLoadingPOIs) && (() => {
        const segs = summary.segments;
        const originName = segs[0]?.from.name;
        const lastSegTo = segs[segs.length - 1]?.to.name;
        const isRoundTrip = originName && lastSegTo && originName === lastSegTo;
        const destinationName = isRoundTrip
          ? segs[Math.ceil(segs.length / 2) - 1]?.to.name || 'Destination'
          : lastSegTo || 'Destination';
        const destinationSuggestions = (poiSuggestions || []).filter(
          p => p.bucket === 'destination' && p.category !== 'gas'
        );
        return (
          <DiscoveryPanel
            title={`Things to Do in ${destinationName}`}
            suggestions={destinationSuggestions}
            isLoading={!!isLoadingPOIs}
            onAdd={onAddPOI}
            onDismiss={onDismissPOI}
            className="mt-4"
          />
        );
      })()}

      {/* Activity Editor Dialog */}
      {editingActivity && onUpdateActivity && (
        <ActivityEditor
          open={true}
          onOpenChange={(open) => !open && setEditingActivity(null)}
          activity={editingActivity.activity}
          locationName={editingActivity.locationName}
          onSave={(activity) => {
            onUpdateActivity(editingActivity.segmentIndex, activity);
            setEditingActivity(null);
          }}
          onRemove={editingActivity.activity ? () => {
            onUpdateActivity(editingActivity.segmentIndex, undefined);
            setEditingActivity(null);
          } : undefined}
        />
      )}

      {/* Overnight Hotel Editor Dialog */}
      {editingOvernight && onUpdateOvernight && (
        <OvernightEditor
          open={true}
          onOpenChange={(open) => !open && setEditingOvernight(null)}
          overnight={editingOvernight.overnight}
          onSave={(overnight) => {
            onUpdateOvernight(editingOvernight.dayNumber, overnight);
            setEditingOvernight(null);
          }}
        />
      )}
    </div>
  );
}
