import { useState, useMemo } from 'react';
import type { TripSummary, TripSettings, Vehicle, TripDay, Activity, OvernightStop, RouteSegment } from '../../types';
import { generatePacingSuggestions } from '../../lib/segment-analyzer';
import { generateSmartStops, createStopConfig, type SuggestedStop } from '../../lib/stop-suggestions';
import { getTankSizeLitres } from '../../lib/unit-conversions';
import { assignDrivers, extractFuelStopIndices } from '../../lib/driver-rotation';
import { findOptimalReturnDeparture } from '../../lib/return-departure-optimizer';

// ---------------------------------------------------------------------------

export interface SimulationItem {
  type: 'gas' | 'stop' | 'suggested';
  arrivalTime: Date;
  cost?: number;
  litres?: number;
  segment?: RouteSegment;
  index?: number;
  suggestedStop?: SuggestedStop;
  fuelPriority?: 'critical' | 'recommended' | 'optional';
}

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
  const drivingDays = days?.filter(d => d.segmentIndices.length > 0) ?? [];
  const isAlreadySplit = drivingDays.length > 1;
  const maxDayMinutes = isAlreadySplit
    ? Math.max(...drivingDays.map(d => d.totals?.driveTimeMinutes ?? 0))
    : summary.totalDurationMinutes;
  const pacingSuggestions = useMemo(() => {
    const base = generatePacingSuggestions(maxDayMinutes, settings, isAlreadySplit);

    // For round trips with a vehicle, check if tweaking the return departure
    // would create a Fuel + Lunch combo at a real hub city.
    if (
      summary.roundTripMidpoint != null &&
      summary.roundTripMidpoint > 0 &&
      vehicle &&
      summary.fullGeometry?.length > 1
    ) {
      const returnSegments = summary.segments.slice(summary.roundTripMidpoint);

      // Outbound km = sum of outbound segments; return geometry starts there
      const returnStartKm = summary.segments
        .slice(0, summary.roundTripMidpoint)
        .reduce((sum, s) => sum + s.distanceKm, 0);

      // Determine the return leg's current departure time.
      // Prefer the first return segment's departureTime; fall back to settings.
      const firstReturnSeg = returnSegments[0];
      const returnDeparture: Date =
        firstReturnSeg?.departureTime
          ? new Date(firstReturnSeg.departureTime)
          : (() => {
              const d = new Date(`${settings.departureDate}T${settings.departureTime}`);
              return d;
            })();

      const suggestion = findOptimalReturnDeparture(
        returnSegments,
        returnDeparture,
        summary.fullGeometry as number[][],
        returnStartKm,
        vehicle,
        settings,
      );

      if (suggestion) {
        const direction = suggestion.minutesDelta < 0 ? 'earlier' : 'later';
        const absDelta = Math.abs(suggestion.minutesDelta);
        const deltaStr = absDelta >= 60
          ? `${Math.floor(absDelta / 60)}h${absDelta % 60 > 0 ? ` ${absDelta % 60}min` : ''}`
          : `${absDelta} min`;
        base.push(
          `⏰ Return trip tip: departing ${deltaStr} ${direction} (${suggestion.suggestedTime}) would create a Fuel + Lunch combo stop near ${suggestion.hubName}, saving ~${suggestion.timeSavedMinutes} min.`
        );
      }
    }

    return base;
  }, [maxDayMinutes, settings, isAlreadySplit, summary, vehicle]);

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
  const simulationItems = useMemo(() => {
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
      if (nextDrivingIdx <= curDayIdx + 1) return undefined;
      return nextDriving;
    };

    // Initial stops at the origin (afterSegmentIndex: -1)
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

      items.push({ type: 'stop', segment, arrivalTime: new Date(currentTime), index: i });

      // Jump currentTime across free-day gaps before rendering post-arrival stops.
      // Also reset fuel — the driver refuels overnight at the hotel.
      const nextDay = nextDrivingDayAfterGap(i);
      if (nextDay) {
        const [dh, dm] = settings.departureTime.split(':').map(Number);
        const dayStart = new Date(nextDay.date + 'T00:00:00');
        dayStart.setHours(dh, dm, 0, 0);
        if (dayStart > currentTime) currentTime = dayStart;
        currentFuel = VIRTUAL_TANK_CAPACITY;
      }

      // Accepted stops after this segment
      const stopsAfterSegment = acceptedBySegment.get(i) || [];
      stopsAfterSegment.forEach(stop => {
        items.push({ type: 'suggested', arrivalTime: new Date(currentTime), suggestedStop: stop });
        currentTime = new Date(currentTime.getTime() + (stop.duration * 60 * 1000));
        if (stop.type === 'fuel') currentFuel = VIRTUAL_TANK_CAPACITY;
      });
    }

    return items;
  }, [summary.segments, startTime, settings.gasPrice, settings.departureTime, settings.units, activeSuggestions, vehicle, days]);

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
