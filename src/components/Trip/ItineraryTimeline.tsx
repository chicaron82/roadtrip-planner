import { useState, useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import type { TripSummary, TripSettings, Vehicle, StopType, TripDay, DayType, Activity, DayOption, RouteSegment, OvernightStop, POISuggestion } from '../../types';
import { SmartSuggestions } from './SmartSuggestions';
import { SuggestedStopCard } from './SuggestedStopCard';
import { DiscoveryPanel } from './DiscoveryPanel';
import { generatePacingSuggestions } from '../../lib/segment-analyzer';
import { generateSmartStops, createStopConfig, type SuggestedStop } from '../../lib/stop-suggestions';
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

  // Generate smart suggestions
  const pacingSuggestions = generatePacingSuggestions(
    summary.totalDurationMinutes,
    settings
  );

  // Generate smart stop suggestions
  const [stopSuggestions, setStopSuggestions] = useState<SuggestedStop[]>(() => {
    if (!vehicle) return [];
    const config = createStopConfig(vehicle, settings);
    return generateSmartStops(summary.segments, config);
  });

  // Show/hide suggestions panel
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Handle accept/dismiss
  const handleAccept = (stopId: string, customDuration?: number) => {
    setStopSuggestions(prev =>
      prev.map(s => s.id === stopId
        ? { ...s, accepted: true, duration: customDuration ?? s.duration }
        : s
      )
    );
  };

  const handleDismiss = (stopId: string) => {
    setStopSuggestions(prev =>
      prev.map(s => s.id === stopId ? { ...s, dismissed: true } : s)
    );
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

    const VIRTUAL_TANK_CAPACITY = vehicle?.tankSize || 55;
    let currentFuel = VIRTUAL_TANK_CAPACITY;

    // Get accepted stops grouped by segment index
    const acceptedBySegment = new Map<number, SuggestedStop[]>();
    activeSuggestions.filter(s => s.accepted).forEach(stop => {
      const existing = acceptedBySegment.get(stop.afterSegmentIndex) || [];
      acceptedBySegment.set(stop.afterSegmentIndex, [...existing, stop]);
    });

    for (let i = 0; i < summary.segments.length; i++) {
      const segment = summary.segments[i];
      const fuelNeeded = segment.fuelNeededLitres;

      // Check for fuel stop (legacy inline calculation for non-accepted suggestions)
      if (currentFuel - fuelNeeded < (VIRTUAL_TANK_CAPACITY * 0.15)) {
        // Only show if not already accepted
        const hasAcceptedFuelStop = acceptedBySegment.get(i - 1)?.some(s => s.type === 'fuel');
        if (!hasAcceptedFuelStop) {
          const refillAmount = VIRTUAL_TANK_CAPACITY - currentFuel;
          const refillCost = refillAmount * settings.gasPrice;
          const stopDurationMinutes = 15;

          // Determine fuel priority based on remaining tank level
          const fuelPercent = currentFuel / VIRTUAL_TANK_CAPACITY;
          const fuelPriority: 'critical' | 'recommended' | 'optional' =
            fuelPercent < 0.10 ? 'critical' :
            fuelPercent < 0.25 ? 'recommended' : 'optional';

          const stopTime = new Date(currentTime);
          currentTime = new Date(currentTime.getTime() + (stopDurationMinutes * 60 * 1000));
          currentFuel = VIRTUAL_TANK_CAPACITY;

          items.push({
            type: 'gas',
            arrivalTime: stopTime,
            cost: refillCost,
            litres: refillAmount,
            fuelPriority,
          });
        }
      }

      // Insert accepted suggested stops before this segment
      const stopsBeforeSegment = acceptedBySegment.get(i - 1) || [];
      stopsBeforeSegment.forEach(stop => {
        items.push({
          type: 'suggested',
          arrivalTime: new Date(currentTime),
          suggestedStop: stop
        });
        currentTime = new Date(currentTime.getTime() + (stop.duration * 60 * 1000));

        // Handle fuel refill for accepted fuel stops
        if (stop.type === 'fuel') {
          currentFuel = VIRTUAL_TANK_CAPACITY;
        }
      });

      // Drive the segment
      const durationMs = (segment.durationMinutes || 0) * 60 * 1000;
      currentTime = new Date(currentTime.getTime() + durationMs);
      currentFuel -= fuelNeeded;

      // Arrive at waypoint
      items.push({
        type: 'stop',
        segment: segment,
        arrivalTime: new Date(currentTime),
        index: i
      });

      // Insert accepted stops after this segment
      const stopsAfterSegment = acceptedBySegment.get(i) || [];
      stopsAfterSegment.forEach(stop => {
        items.push({
          type: 'suggested',
          arrivalTime: new Date(currentTime),
          suggestedStop: stop
        });
        currentTime = new Date(currentTime.getTime() + (stop.duration * 60 * 1000));

        if (stop.type === 'fuel') {
          currentFuel = VIRTUAL_TANK_CAPACITY;
        }
      });
    }

    return items;
  }, [summary.segments, startTime, settings.gasPrice, activeSuggestions, vehicle?.tankSize]);

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

      {/* Day Sections (multi-day trips) */}
      {days && days.length > 0 && (
        <div className="mb-6 space-y-4">
          {days.map((day, idx) => (
            <DaySection
              key={day.dayNumber}
              day={day}
              isFirst={idx === 0}
              editable={!!onUpdateDayType}
              budgetMode={settings.budgetMode}
              onDayTypeChange={onUpdateDayType}
              onTitleChange={onUpdateDayTitle}
              onNotesChange={onUpdateDayNotes}
              onAddDayOption={onAddDayOption}
              onRemoveDayOption={onRemoveDayOption}
              onSelectDayOption={onSelectDayOption}
              onEditOvernight={onUpdateOvernight && day.overnight ? (dayNum) => {
                const target = days?.find(d => d.dayNumber === dayNum);
                if (target?.overnight) {
                  setEditingOvernight({ dayNumber: dayNum, overnight: target.overnight });
                }
              } : undefined}
            />
          ))}
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
            return (
              <WaypointNode
                key={`stop-${item.index}`}
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
