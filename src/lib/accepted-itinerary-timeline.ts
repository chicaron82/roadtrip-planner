import type { TripDay, TripSettings, TripSummary } from '../types';
import type { AcceptedItineraryTimeline, CanonicalTripDay } from './canonical-trip';
import type { SuggestedStop } from './stop-suggestions';
import type { TimedEvent } from './trip-timeline';
import { buildTimedTimeline } from './trip-timeline';
import { formatDateInZone } from './trip-timezone';

export function groupEventsByTripDay(events: TimedEvent[], tripDays: TripDay[]): CanonicalTripDay[] {
  return tripDays.map(day => {
    if (day.segments.length === 0) return { meta: day, events: [] };

    const departure = events.find(
      event => event.type === 'departure' && formatDateInZone(event.arrivalTime, event.timezone ?? 'UTC') === day.date,
    );
    if (!departure) return { meta: day, events: [] };

    const departureMs = departure.arrivalTime.getTime();
    const nextDepartureMs = events.find(
      event => event.type === 'departure' && event.arrivalTime.getTime() > departureMs,
    )?.arrivalTime.getTime() ?? Infinity;

    return {
      meta: day,
      events: events.filter(
        event => event.arrivalTime.getTime() >= departureMs && event.arrivalTime.getTime() < nextDepartureMs,
      ),
    };
  });
}

interface BuildAcceptedItineraryTimelineParams {
  summary: TripSummary;
  settings: TripSettings;
  tripDays: TripDay[];
  startTime: Date;
  activeSuggestions: SuggestedStop[];
}

export function buildAcceptedItineraryTimeline({
  summary,
  settings,
  tripDays,
  startTime,
  activeSuggestions,
}: BuildAcceptedItineraryTimelineParams): AcceptedItineraryTimeline {
  const acceptedSuggestions = activeSuggestions.filter(stop => stop.accepted);
  const events = buildTimedTimeline(
    summary.segments,
    acceptedSuggestions,
    settings,
    summary.roundTripMidpoint,
    undefined,
    tripDays,
    startTime,
  );

  return {
    summary,
    days: groupEventsByTripDay(events, tripDays),
    events,
  };
}