import type { TripSummary, TripSettings, Vehicle, TripDay } from '../../types';
import type { SuggestedStop } from '../../lib/stop-suggestions';
import { getTankSizeLitres } from '../../lib/unit-conversions';

export interface SimulationItem {
  type: 'gas' | 'stop' | 'suggested';
  arrivalTime: Date;
  cost?: number;
  litres?: number;
  segment?: TripSummary['segments'][number];
  index?: number;
  suggestedStop?: SuggestedStop;
  fuelPriority?: 'critical' | 'recommended' | 'optional';
}

interface BuildSimulationItemsParams {
  summary: TripSummary;
  settings: TripSettings;
  vehicle: Vehicle | undefined;
  days: TripDay[] | undefined;
  startTime: Date;
  activeSuggestions: SuggestedStop[];
}

/** Pure function: builds the ordered list of simulation items (gas, stop, suggested) for the timeline. */
export function buildSimulationItems({
  summary,
  settings,
  vehicle,
  days,
  startTime,
  activeSuggestions,
}: BuildSimulationItemsParams): SimulationItem[] {
  const items: SimulationItem[] = [];
  let currentTime = new Date(startTime);

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

    // Safety-net fuel check
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

    // Jump currentTime across free-day gaps; reset fuel for next hotel morning
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
}
