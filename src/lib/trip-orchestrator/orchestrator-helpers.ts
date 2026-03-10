import type { TripSummary, TripSettings, TripDay } from '../../types';
import type { StrategicFuelStop } from '../calculations';
import type { SuggestedStop } from '../stop-suggestion-types';
import type { CanonicalTripTimeline, CanonicalTripDay } from '../canonical-trip';
import type { TimedEvent } from '../trip-timeline';
import { groupEventsByTripDay } from '../accepted-itinerary-timeline';
import { formatDateInZone } from '../trip-timezone';
import { formatTime } from '../trip-timeline-helpers';

export function getRoundTripDayTripStayMinutes(
  summary: TripSummary,
  dayCount: number,
  settings: TripSettings,
): number {
  const isRTDayTrip = settings.isRoundTrip &&
    dayCount <= 1 &&
    summary.totalDurationMinutes <= settings.maxDriveHours * 60;

  return isRTDayTrip ? (settings.dayTripDurationHours ?? 0) * 60 : 0;
}

/** Project simulation fuel stops onto the map pin shape. */
export function projectFuelStopsFromSimulation(stops: SuggestedStop[]): StrategicFuelStop[] {
  return stops
    .filter(s => s.type === 'fuel' && !s.dismissed && s.lat != null && s.lng != null)
    .map(s => {
      const timeStr = formatTime(s.estimatedTime);
      return {
        lat: s.lat!,
        lng: s.lng!,
        distanceFromStart: s.distanceFromStart ?? 0,
        estimatedTime: timeStr,
        fuelRemaining: s.details.fillType === 'full' ? 15 : 35,
        stationName: s.hubName,
        cost: s.details.fuelCost,
        isFullFill: s.details.fillType === 'full',
      };
    });
}

/** Group flat canonical events into per-day buckets paired with budget metadata. */
export function assembleCanonicalTimeline(
  events: CanonicalTripTimeline['events'],
  tripDays: TripDay[],
  summary: TripSummary,
  inputs: CanonicalTripTimeline['inputs'],
): CanonicalTripTimeline {
  const days: CanonicalTripDay[] = groupEventsByTripDay(events, tripDays);
  return { events, days, summary, inputs };
}

/** Patch TripDay departure/arrival times and route labels from canonical events. */
export function patchDaysFromCanonicalEvents(tripDays: TripDay[], canonicalEvents: TimedEvent[]): void {
  for (const day of tripDays) {
    if (day.segments.length === 0) continue;
    const depEvent = canonicalEvents.find(
      e => e.type === 'departure' && formatDateInZone(e.arrivalTime, e.timezone ?? 'UTC') === day.date
    );
    let arrEvent: TimedEvent | undefined;
    if (depEvent) {
      const depMs = depEvent.arrivalTime.getTime();
      const nextDepMs = canonicalEvents.find(
        e => e.type === 'departure' && e.arrivalTime.getTime() > depMs
      )?.arrivalTime.getTime() ?? Infinity;

      arrEvent = canonicalEvents
        .filter(e =>
          (e.type === 'overnight' || e.type === 'arrival') &&
          e.arrivalTime.getTime() > depMs &&
          e.arrivalTime.getTime() <= nextDepMs
        )
        .at(-1);

      // Beast mode fallback: last waypoint in the window is the day-boundary event.
      if (!arrEvent) {
        arrEvent = canonicalEvents
          .filter(e =>
            e.type === 'waypoint' &&
            e.arrivalTime.getTime() > depMs &&
            e.arrivalTime.getTime() <= nextDepMs
          )
          .at(-1);
      }
    }
    if (depEvent) day.totals.departureTime = depEvent.arrivalTime.toISOString();
    if (arrEvent) day.totals.arrivalTime = arrEvent.arrivalTime.toISOString();
    if (depEvent && !day.route) {
      let toCity = day.segments.at(-1)?.to.name ?? '';
      toCity = toCity.replace(/\s*\(transit\)\s*$/, '');
      if (toCity.includes(' → ')) toCity = toCity.split(' → ').pop()!.trim();
      if (toCity) day.route = `${depEvent.locationHint} → ${toCity}`;
    }
  }
}
