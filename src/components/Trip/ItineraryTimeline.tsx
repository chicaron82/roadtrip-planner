import { useState, useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import type { TripSummary, TripSettings, Vehicle, StopType, TripDay, DayType, Activity, DayOption, RouteSegment, OvernightStop, POISuggestion } from '../../types';
import { SmartSuggestions } from './SmartSuggestions';
import { SuggestedStopCard } from './SuggestedStopCard';
import { DiscoveryPanel } from './DiscoveryPanel';
import { generatePacingSuggestions } from '../../lib/segment-analyzer';
import { generateSmartStops, createStopConfig, type SuggestedStop } from '../../lib/stop-suggestions';
import { getTankSizeLitres } from '../../lib/unit-conversions';
import { assignDrivers, extractFuelStopIndices } from '../../lib/driver-rotation';
import { Button } from '../UI/Button';
import { ActivityEditor } from './ActivityEditor';
import { StartNode, GasStopNode, SuggestedStopNode, WaypointNode } from './TimelineNode';
import { DaySection } from './DaySection';
import { DriverStatsPanel } from './DriverStatsPanel';
import { OvernightEditor } from './OvernightEditor';

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
  const startTime = useMemo(
    () => new Date(`${settings.departureDate}T${settings.departureTime}`),
    [settings.departureDate, settings.departureTime]
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
  const drivingDays = days?.filter(d => d.segmentIndices.length > 0) ?? [];
  const isAlreadySplit = drivingDays.length > 1;
  const maxDayMinutes = isAlreadySplit
    ? Math.max(...drivingDays.map(d => d.totals?.driveTimeMinutes ?? 0))
    : summary.totalDurationMinutes;
  const pacingSuggestions = generatePacingSuggestions(maxDayMinutes, settings, isAlreadySplit);

  // Base suggestions — pure computation, regenerates whenever the trip/vehicle/settings change.
  // useMemo ensures fresh suggestions after every recalculate (useState initializer only runs once).
  const baseSuggestions = useMemo(() => {
    if (!vehicle) return [];
    const config = createStopConfig(vehicle, settings);
    return generateSmartStops(summary.segments, config, days);
  }, [summary.segments, vehicle, settings, days]);

  // Per-stop user overrides — kept separate so baseSuggestions can regenerate without wiping
  // decisions the user already made (accept, dismiss, custom duration).
  const [userOverrides, setUserOverrides] = useState<Record<string, { accepted?: boolean; dismissed?: boolean; duration?: number }>>({});

  // Show/hide suggestions panel
  const [showSuggestions, setShowSuggestions] = useState(true);

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
    [baseSuggestions, userOverrides]
  );

  // Handle accept/dismiss — writes to overrides, leaves base suggestions intact
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
  const simulationItems = useMemo(() => {
    interface SimulationItem {
      type: 'gas' | 'stop' | 'suggested';
      arrivalTime: Date;
      cost?: number;
      litres?: number;
      segment?: RouteSegment;
      index?: number;
      suggestedStop?: SuggestedStop;
      fuelPriority?: 'critical' | 'recommended' | 'optional';
    }

    const items: SimulationItem[] = [];
    let currentTime = new Date(startTime);

    // Tank capacity in litres. Default 55 L when vehicle is null.
    const VIRTUAL_TANK_CAPACITY = vehicle
      ? getTankSizeLitres(vehicle, settings.units)
      : 55;
    let currentFuel = VIRTUAL_TANK_CAPACITY;

    // Get accepted stops grouped by afterSegmentIndex
    const acceptedBySegment = new Map<number, SuggestedStop[]>();
    activeSuggestions.filter(s => s.accepted).forEach(stop => {
      const existing = acceptedBySegment.get(stop.afterSegmentIndex) || [];
      acceptedBySegment.set(stop.afterSegmentIndex, [...existing, stop]);
    });

    // Returns the next driving day only when free days exist between segIdx and it.
    // Used to jump currentTime across free-day gaps (e.g. Day 1 → Day 2 free → Day 3).
    const nextDrivingDayAfterGap = (segIdx: number): TripDay | undefined => {
      if (!days) return undefined;
      const curDay = days.find(
        d => d.segmentIndices.length > 0 && d.segmentIndices[d.segmentIndices.length - 1] === segIdx
      );
      if (!curDay) return undefined;
      const curDayIdx = days.indexOf(curDay);
      const nextDriving = days.slice(curDayIdx + 1).find(d => d.segmentIndices.length > 0);
      if (!nextDriving) return undefined;
      const nextDrivingIdx = days.indexOf(nextDriving);
      // Only jump when there is at least one free day in between
      if (nextDrivingIdx <= curDayIdx + 1) return undefined;
      return nextDriving;
    };

    // Initial stops at the origin (afterSegmentIndex: -1) — shown before the first segment
    const initialStops = acceptedBySegment.get(-1) || [];
    initialStops.forEach(stop => {
      items.push({ type: 'suggested', arrivalTime: new Date(currentTime), suggestedStop: stop });
      currentTime = new Date(currentTime.getTime() + (stop.duration * 60 * 1000));
      if (stop.type === 'fuel') currentFuel = VIRTUAL_TANK_CAPACITY;
    });

    for (let i = 0; i < summary.segments.length; i++) {
      const segment = summary.segments[i];
      const fuelNeeded = segment.fuelNeededLitres;

      // Safety-net fuel check — fires only when there is no accepted fuel stop before segment i.
      // Handles: (a) user dismissed a required fuel suggestion, (b) vehicle is null so
      // generateSmartStops never ran. Prevents the display timeline showing impossible fuel levels.
      if (currentFuel - fuelNeeded < (VIRTUAL_TANK_CAPACITY * 0.15)) {
        const hasAcceptedFuelStop = acceptedBySegment.get(i - 1)?.some(s => s.type === 'fuel');
        if (!hasAcceptedFuelStop) {
          const refillAmount = VIRTUAL_TANK_CAPACITY - currentFuel;
          const refillCost = refillAmount * settings.gasPrice;
          const fuelPercent = currentFuel / VIRTUAL_TANK_CAPACITY;
          const fuelPriority: 'critical' | 'recommended' | 'optional' =
            fuelPercent < 0.10 ? 'critical' :
            fuelPercent < 0.25 ? 'recommended' : 'optional';

          const stopTime = new Date(currentTime);
          currentTime = new Date(currentTime.getTime() + (15 * 60 * 1000));
          currentFuel = VIRTUAL_TANK_CAPACITY;
          items.push({ type: 'gas', arrivalTime: stopTime, cost: refillCost, litres: refillAmount, fuelPriority });
        }
      }

      // Drive the segment
      const durationMs = (segment.durationMinutes || 0) * 60 * 1000;
      currentTime = new Date(currentTime.getTime() + durationMs);
      currentFuel -= fuelNeeded;

      // Arrive at waypoint
      items.push({ type: 'stop', segment, arrivalTime: new Date(currentTime), index: i });

      // Jump currentTime across free-day gaps before rendering post-arrival stops.
      // This ensures Day 3 fuel/rest stops show the correct morning departure time.
      const nextDay = nextDrivingDayAfterGap(i);
      if (nextDay) {
        const [dh, dm] = settings.departureTime.split(':').map(Number);
        const dayStart = new Date(nextDay.date + 'T00:00:00');
        dayStart.setHours(dh, dm, 0, 0);
        if (dayStart > currentTime) currentTime = dayStart;
      }

      // Accepted stops after this segment (afterSegmentIndex === i).
      // NOTE: stopsBeforeSegment (get(i-1)) is intentionally NOT rendered here —
      // those stops are already shown in this iteration as stopsAfterSegment for i-1,
      // preventing double-rendering of the same accepted stop.
      const stopsAfterSegment = acceptedBySegment.get(i) || [];
      stopsAfterSegment.forEach(stop => {
        items.push({ type: 'suggested', arrivalTime: new Date(currentTime), suggestedStop: stop });
        currentTime = new Date(currentTime.getTime() + (stop.duration * 60 * 1000));
        if (stop.type === 'fuel') currentFuel = VIRTUAL_TANK_CAPACITY;
      });
    }

    return items;
  }, [summary.segments, startTime, settings.gasPrice, settings.departureTime, settings.units, activeSuggestions, vehicle?.tankSize, days]);

  // Pending suggestions (not yet accepted or dismissed)
  const pendingSuggestions = activeSuggestions.filter(s => !s.accepted);

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

  // Build map: segment index → TripDay, keyed on the day's first segment
  const dayStartMap = useMemo(() => {
    const map = new Map<number, { day: TripDay; isFirst: boolean }>();
    if (days) {
      days.forEach((day, idx) => {
        if (day.segmentIndices.length > 0) {
          map.set(day.segmentIndices[0], { day, isFirst: idx === 0 });
        }
      });
    }
    return map;
  }, [days]);

  // Build map: last-segment-index-of-a-driving-day → free TripDay[] that follow it.
  // Free days (segmentIndices: []) have no entry in dayStartMap, so we render their
  // DaySection after the last stop of the preceding driving day instead.
  const freeDaysAfterSegment = useMemo(() => {
    const map = new Map<number, TripDay[]>();
    if (!days) return map;
    days.forEach(day => {
      if (day.segmentIndices.length > 0) return; // skip driving days
      // Find the nearest preceding driving day
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

  return (
    <div className="space-y-6">
      {/* Smart Suggestions */}
      <SmartSuggestions suggestions={pacingSuggestions} />

      {/* Smart Stop Suggestions Panel */}
      {pendingSuggestions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <h3 className="text-sm font-semibold">Smart Stop Suggestions</h3>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                {pendingSuggestions.length} suggestion{pendingSuggestions.length !== 1 ? 's' : ''}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="text-xs"
            >
              {showSuggestions ? 'Hide' : 'Show'}
            </Button>
          </div>

          {showSuggestions && (
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
          )}
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
          // Interleave day section header before the first stop of each day
          const dayEntry = typeof item.index === 'number' ? dayStartMap.get(item.index) : undefined;

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
            return (
              <div key={`stop-${item.index}`}>
                {dayEntry && (
                  <div className="mb-4">
                    <DaySection
                      day={dayEntry.day}
                      isFirst={dayEntry.isFirst}
                      editable={!!onUpdateDayType}
                      budgetMode={settings.budgetMode}
                      onDayTypeChange={onUpdateDayType}
                      onTitleChange={onUpdateDayTitle}
                      onNotesChange={onUpdateDayNotes}
                      onAddDayOption={onAddDayOption}
                      onRemoveDayOption={onRemoveDayOption}
                      onSelectDayOption={onSelectDayOption}
                      onEditOvernight={onUpdateOvernight && dayEntry.day.overnight ? (dayNum) => {
                        const target = days?.find(d => d.dayNumber === dayNum);
                        if (target?.overnight) {
                          setEditingOvernight({ dayNumber: dayNum, overnight: target.overnight });
                        }
                      } : undefined}
                    />
                  </div>
                )}
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

      {/* Destination Discovery — "Things to Do" at final stop */}
      {onAddPOI && onDismissPOI && (poiSuggestions?.length || isLoadingPOIs) && (() => {
        // For round trips, the last segment returns to origin — find the actual destination
        // by looking at the midpoint segment's to.name (the turnaround point)
        const segs = summary.segments;
        const originName = segs[0]?.from.name;
        const lastSegTo = segs[segs.length - 1]?.to.name;
        const isRoundTrip = originName && lastSegTo && originName === lastSegTo;
        // For a round trip with N segments, the first N/2 are outbound.
        // The last outbound segment's `to` is the actual destination.
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
