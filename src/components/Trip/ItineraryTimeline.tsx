import { useState, useMemo } from 'react';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import type { TripSummary, TripSettings, Vehicle, StopType, TripDay, DayType, Activity, DayOption, OvernightStop, POISuggestion } from '../../types';
import { SmartSuggestions } from './SmartSuggestions';
import { SuggestedStopCard } from './SuggestedStopCard';
import { DiscoveryPanel } from './DiscoveryPanel';
import { ActivityEditor, ActivityBadge } from './ActivityEditor';
import { StartNode, GasStopNode, SuggestedStopNode, WaypointNode } from './TimelineNode';
import { DaySection } from './DaySection';
import { DriverStatsPanel } from './DriverStatsPanel';
import { OvernightEditor } from './OvernightEditor';
import { useTimelineData } from './useTimelineData';
import { TripHeaderSummary } from './TripHeaderSummary';
import type { SuggestedStop } from '../../lib/stop-suggestions';

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
}: ItineraryTimelineProps) {
  const {
    startTime,
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
  } = useTimelineData({ summary, settings, vehicle, days, externalStops });

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
  const drivingDays = days?.filter(d => d.segmentIndices.length > 0).length ?? 1;
  const freeDays = days?.filter(d => d.segmentIndices.length === 0).length ?? 0;
  const totalDays = drivingDays + freeDays;

  // Track the standalone activity currently being edited on a Free Day
  const [editingDayActivity, setEditingDayActivity] = useState<{
    dayNumber: number;
    activityIndex: number;
    activity?: Activity;
  } | null>(null);

  // Last stop's flat index — used for destination detection
  const lastStopFlatIndex = useMemo(() => {
    for (let i = simulationItems.length - 1; i >= 0; i--) {
      if (simulationItems[i].type === 'stop' && simulationItems[i].index !== undefined) {
        return simulationItems[i].index;
      }
    }
    return -1;
  }, [simulationItems]);

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
                {dayEntries.map(({ day: entryDay, isFirst }) => {
                  const isCollapsed = collapsedDays.has(entryDay.dayNumber);
                  const dayTips = pacingSuggestionsByDay.get(entryDay.dayNumber) ?? [];
                  const dayStops = pendingSuggestionsByDay.get(entryDay.dayNumber) ?? [];
                  const hasCollapsibleContent = dayTips.length > 0 || dayStops.length > 0;

                  return (
                    <div key={`day-${entryDay.dayNumber}`} className="mb-4">
                      <DaySection
                        day={entryDay}
                        isFirst={isFirst}
                        editable={!!onUpdateDayType}
                        budgetMode={settings.budgetMode}
                        onDayTypeChange={onUpdateDayType}
                        onAddDayActivity={
                          onAddDayActivity ? () => {
                            setEditingDayActivity({
                              dayNumber: entryDay.dayNumber,
                              activityIndex: -1, // -1 means new activity
                            });
                          } : undefined
                        }
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

                      {/* Collapse toggle for trips with 5+ days */}
                      {totalDays >= 5 && hasCollapsibleContent && (
                        <button
                          type="button"
                          onClick={() => toggleDayCollapse(entryDay.dayNumber)}
                          className="ml-10 mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isCollapsed ? (
                            <>
                              <ChevronDown className="h-3 w-3" />
                              <span>Show {dayTips.length + dayStops.length} suggestion{dayTips.length + dayStops.length !== 1 ? 's' : ''}</span>
                            </>
                          ) : (
                            <>
                              <ChevronUp className="h-3 w-3" />
                              <span>Hide suggestions</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Standalone Activities for this day */}
                      {entryDay.plannedActivities && entryDay.plannedActivities.length > 0 && (
                        <div className="ml-10 mt-4 flex flex-col gap-2">
                          {entryDay.plannedActivities.map((act, idx) => (
                            <ActivityBadge
                              key={`standalone-act-${entryDay.dayNumber}-${idx}`}
                              activity={act}
                              onClick={onUpdateDayActivity ? () => {
                                setEditingDayActivity({
                                  dayNumber: entryDay.dayNumber,
                                  activityIndex: idx,
                                  activity: act,
                                });
                              } : undefined}
                              className={onUpdateDayActivity ? 'cursor-pointer' : 'cursor-default'}
                            />
                          ))}
                        </div>
                      )}

                      {/* Collapsible content */}
                      {!isCollapsed && (
                        <>
                          {/* Inline pacing tips for this day */}
                          {dayTips.map((tip, tipIdx) => (
                            <div
                              key={`tip-${entryDay.dayNumber}-${tipIdx}`}
                              className="ml-10 mt-2 flex items-start gap-2 p-2.5 rounded-lg border bg-gradient-to-r from-yellow-50 to-transparent text-sm"
                            >
                              <span className="text-yellow-500 mt-0.5">💡</span>
                              <span className="text-muted-foreground">{tip}</span>
                            </div>
                          ))}
                          {/* Inline stop suggestions for this day */}
                          {dayStops.map(stop => (
                            <div key={stop.id} className="mt-2 ml-10">
                              <SuggestedStopCard
                                stop={stop}
                                onAccept={handleAccept}
                                onDismiss={handleDismiss}
                              />
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  );
                })}
                <WaypointNode
                  segment={item.segment}
                  arrivalTime={item.arrivalTime}
                  index={item.originalIndex ?? item.index}
                  isDestination={item.index === lastStopFlatIndex}
                  onUpdateStopType={onUpdateStopType}
                  onEditActivity={onUpdateActivity ? (segIdx, activity, locName) => {
                    setEditingActivity({ segmentIndex: segIdx, activity, locationName: locName });
                  } : undefined}
                  activity={item.segment.activity}
                  assignedDriver={driverBySegment.get(item.originalIndex ?? item.index!)}
                />
                {freeDaysAfter.map(freeDay => (
                  <div key={`free-day-${freeDay.dayNumber}`} className="mt-4">
                    <DaySection
                      day={freeDay}
                      isFirst={false}
                      editable={!!onUpdateDayType}
                      budgetMode={settings.budgetMode}
                      onDayTypeChange={onUpdateDayType}
                      onAddDayActivity={
                        onAddDayActivity ? () => {
                          setEditingDayActivity({
                            dayNumber: freeDay.dayNumber,
                            activityIndex: -1, // -1 means new activity
                          });
                        } : undefined
                      }
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
        const isRoundTrip = !!(originName && lastSegTo && originName === lastSegTo);
        const roundTripMidpoint = summary.roundTripMidpoint;
        const destinationName = isRoundTrip
          ? segs[Math.ceil(segs.length / 2) - 1]?.to.name || 'Destination'
          : lastSegTo || 'Destination';

        const alongWaySuggestions = (poiSuggestions || []).filter(
          p => p.bucket === 'along-way'
        );
        const destinationSuggestions = (poiSuggestions || []).filter(
          p => p.bucket === 'destination' && p.category !== 'gas'
        );
        return (
          <>
            {(alongWaySuggestions.length > 0 || isLoadingPOIs) && (
              <DiscoveryPanel
                title="Cool Stops Along the Way"
                suggestions={alongWaySuggestions}
                isLoading={!!isLoadingPOIs}
                onAdd={onAddPOI}
                onDismiss={onDismissPOI}
                partialResults={poiPartialResults}
                roundTripMidpoint={roundTripMidpoint}
                className="mt-4"
              />
            )}
            {(destinationSuggestions.length > 0 || isLoadingPOIs) && (
              <DiscoveryPanel
                title={`Things to Do in ${destinationName}`}
                suggestions={destinationSuggestions}
                isLoading={!!isLoadingPOIs}
                onAdd={onAddPOI}
                onDismiss={onDismissPOI}
                partialResults={poiPartialResults}
                className="mt-4"
              />
            )}
          </>
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

      {/* Standalone Activity Editor Dialog (for Free Days) */}
      {editingDayActivity && onAddDayActivity && onUpdateDayActivity && (
        <ActivityEditor
          open={true}
          onOpenChange={(open) => !open && setEditingDayActivity(null)}
          activity={editingDayActivity.activity}
          locationName={`Day ${editingDayActivity.dayNumber} Activity`}
          isStandalone={true}
          onSave={(activity) => {
            if (editingDayActivity.activityIndex === -1) {
              // -1 means it's a new activity
              if (onAddDayActivity) {
                // To support adding, we actually need an onAdd... function that accepts an Activity
                // Currently onAddDayActivity only accepts a dayNumber.
                // We'll fix this in the next pass if necessary, but for now we expect a 2nd arg.
                // Wait, our context *does* expect 2 args: `addDayActivity: (dayNumber: number, activity: Activity) => void`
                // We need to ensure the prop passed down to ItineraryTimeline allows this.
                // The current prop signature is `onAddDayActivity?: (dayNumber: number) => void;` which is wrong.
                // We'll type-cast it for a second until we fix the interface in a subsequent tool call.
                onAddDayActivity(editingDayActivity.dayNumber, activity);
              }
            } else {
              onUpdateDayActivity(editingDayActivity.dayNumber, editingDayActivity.activityIndex, activity);
            }
            setEditingDayActivity(null);
          }}
          onRemove={editingDayActivity.activity && onRemoveDayActivity ? () => {
            onRemoveDayActivity(editingDayActivity.dayNumber, editingDayActivity.activityIndex);
            setEditingDayActivity(null);
          } : undefined}
        />
      )}
    </div>
  );
}
