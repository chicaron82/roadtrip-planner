import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Activity, DayOption, DayType, OvernightStop, StopType, TripDay, TripSettings, TripSummary } from '../../types';
import { ActivityBadge } from './ActivityEditor';
import { DaySection } from './DaySection';
import { SuggestedStopCard } from './SuggestedStopCard';
import { GasStopNode, StartNode, SuggestedStopNode, WaypointNode } from './Timeline/TimelineNode';
import type { SuggestedStop } from '../../lib/stop-suggestions';
import type { EditingDayActivity } from './TimelineDialogs';
import type { SimulationItem } from './useTimelineData';

interface ItineraryTimelineBodyProps {
  summary: TripSummary;
  settings: TripSettings;
  days?: TripDay[];
  startTime: Date;
  originTimezone?: string;
  simulationItems: SimulationItem[];
  lastStopFlatIndex: number;
  dayStartMap: Map<number, { day: TripDay; isFirst: boolean }[]>;
  freeDaysAfterSegment: Map<number, TripDay[]>;
  pacingSuggestionsByDay: Map<number, string[]>;
  pendingSuggestionsByDay: Map<number, SuggestedStop[]>;
  overnightNightsByDay: Map<number, number>;
  driverBySegment: Map<number, number>;
  totalDays: number;
  collapsedDays: Set<number>;
  toggleDayCollapse: (dayNumber: number) => void;
  handleAccept: (stopId: string, customDuration?: number) => void;
  handleDismiss: (stopId: string) => void;
  setEditingActivity: (value: { segmentIndex: number; activity?: Activity; locationName?: string } | null) => void;
  setEditingOvernight: (value: { dayNumber: number; overnight: OvernightStop } | null) => void;
  setEditingDayActivity: (value: EditingDayActivity | null) => void;
  onUpdateStopType?: (segmentIndex: number, newStopType: StopType) => void;
  onUpdateActivity?: (segmentIndex: number, activity: Activity | undefined) => void;
  onUpdateDayType?: (dayNumber: number, dayType: DayType) => void;
  onAddDayActivity?: (dayNumber: number, activity: Activity) => void;
  onUpdateDayActivity?: (dayNumber: number, activityIndex: number, activity: Activity) => void;
  onUpdateDayNotes?: (dayNumber: number, notes: string) => void;
  onUpdateDayTitle?: (dayNumber: number, title: string) => void;
  onAddDayOption?: (dayNumber: number, option: DayOption) => void;
  onRemoveDayOption?: (dayNumber: number, optionIndex: number) => void;
  onSelectDayOption?: (dayNumber: number, optionIndex: number) => void;
  onUpdateOvernight?: (dayNumber: number, overnight: OvernightStop) => void;
}

export function ItineraryTimelineBody({
  summary,
  settings,
  days,
  startTime,
  originTimezone,
  simulationItems,
  lastStopFlatIndex,
  dayStartMap,
  freeDaysAfterSegment,
  pacingSuggestionsByDay,
  pendingSuggestionsByDay,
  overnightNightsByDay,
  driverBySegment,
  totalDays,
  collapsedDays,
  toggleDayCollapse,
  handleAccept,
  handleDismiss,
  setEditingActivity,
  setEditingOvernight,
  setEditingDayActivity,
  onUpdateStopType,
  onUpdateActivity,
  onUpdateDayType,
  onAddDayActivity,
  onUpdateDayActivity,
  onUpdateDayNotes,
  onUpdateDayTitle,
  onAddDayOption,
  onRemoveDayOption,
  onSelectDayOption,
  onUpdateOvernight,
}: ItineraryTimelineBodyProps) {
  return (
    <div className="space-y-0 pt-2 relative pb-12">
      <div className="absolute left-[19px] top-4 bottom-0 w-0.5 bg-border -z-10"></div>

      <StartNode
        locationName={summary.segments[0]?.from.name || 'Origin'}
        startTime={startTime}
        timezone={originTimezone}
        isCalculatedDeparture={settings.useArrivalTime}
      />

      {simulationItems.map((item, idx) => {
        if (item.type === 'gas') {
          return (
            <GasStopNode
              key={`gas-${idx}`}
              arrivalTime={item.arrivalTime}
              timezone={item.timezone}
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
              timezone={item.timezone}
              stop={item.suggestedStop}
            />
          );
        }

        if (item.segment && typeof item.index === 'number') {
          const freeDaysAfter = freeDaysAfterSegment.get(item.index) ?? [];
          const dayEntries = dayStartMap.get(item.index) ?? [];

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
                      onAddDayActivity={onAddDayActivity ? () => {
                        setEditingDayActivity({ dayNumber: entryDay.dayNumber, activityIndex: -1 });
                      } : undefined}
                      onTitleChange={onUpdateDayTitle}
                      onNotesChange={onUpdateDayNotes}
                      onAddDayOption={onAddDayOption}
                      onRemoveDayOption={onRemoveDayOption}
                      onSelectDayOption={onSelectDayOption}
                      overnightNights={overnightNightsByDay.get(entryDay.dayNumber)}
                      onEditOvernight={onUpdateOvernight && entryDay.overnight ? (dayNumber) => {
                        const target = days?.find(day => day.dayNumber === dayNumber);
                        if (target?.overnight) {
                          setEditingOvernight({ dayNumber, overnight: target.overnight });
                        }
                      } : undefined}
                    />

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

                    {entryDay.plannedActivities && entryDay.plannedActivities.length > 0 && (
                      <div className="ml-10 mt-4 flex flex-col gap-2">
                        {entryDay.plannedActivities.map((activity, activityIndex) => (
                          <ActivityBadge
                            key={`standalone-act-${entryDay.dayNumber}-${activityIndex}`}
                            activity={activity}
                            onClick={onUpdateDayActivity ? () => {
                              setEditingDayActivity({
                                dayNumber: entryDay.dayNumber,
                                activityIndex,
                                activity,
                              });
                            } : undefined}
                            className={onUpdateDayActivity ? 'cursor-pointer' : 'cursor-default'}
                          />
                        ))}
                      </div>
                    )}

                    {!isCollapsed && (
                      <>
                        {dayTips.map((tip, tipIndex) => (
                          <div
                            key={`tip-${entryDay.dayNumber}-${tipIndex}`}
                            className="ml-10 mt-2 flex items-start gap-2 p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 text-sm"
                          >
                            <span className="text-amber-500 mt-0.5">💡</span>
                            <span className="text-muted-foreground">{tip}</span>
                          </div>
                        ))}
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
                onEditActivity={onUpdateActivity ? (segmentIndex, activity, locationName) => {
                  setEditingActivity({ segmentIndex, activity, locationName });
                } : undefined}
                activity={item.segment.activity}
                assignedDriver={driverBySegment.get(item.originalIndex ?? item.index)}
              />

              {freeDaysAfter.map(freeDay => (
                <div key={`free-day-${freeDay.dayNumber}`} className="mt-4">
                  <DaySection
                    day={freeDay}
                    isFirst={false}
                    editable={!!onUpdateDayType}
                    budgetMode={settings.budgetMode}
                    onDayTypeChange={onUpdateDayType}
                    onAddDayActivity={onAddDayActivity ? () => {
                      setEditingDayActivity({ dayNumber: freeDay.dayNumber, activityIndex: -1 });
                    } : undefined}
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
  );
}