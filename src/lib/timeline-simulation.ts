import type { TripSummary, TripSettings, Vehicle, TripDay } from '../types';
import type { SuggestedStop } from './stop-suggestions';
import { buildTimedTimeline } from './trip-timeline';

export interface SimulationItem {
  type: 'gas' | 'stop' | 'suggested';
  arrivalTime: Date;
  cost?: number;
  litres?: number;
  segment?: TripSummary['segments'][number];
  /** Flat sub-segment index — unique per iteration item.
   *  Used for dayStartMap keying and React keys. */
  index?: number;
  /** Original segment index (for callbacks like onUpdateStopType).
   *  Only differs from `index` when days contain processed sub-segments. */
  originalIndex?: number;
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

/**
 * Build the ordered list of simulation items for the timeline.
 *
 * Thin adapter over buildTimedTimeline — single source of truth for stop
 * placement, clock advancement, and timezone handling. Converts TimedEvent[]
 * into SimulationItem[] so ItineraryTimeline's rendering loop is unchanged.
 *
 * 'waypoint' / 'arrival' events → SimulationItem[type='stop'] (carries segment + flatIndex)
 * 'fuel' / 'meal' / 'rest' / 'combo' events → SimulationItem[type='suggested']
 * 'departure' / 'drive' / 'overnight' / 'destination' → skipped (structural, not rendered)
 */
export function buildSimulationItems({
  summary,
  settings,
  vehicle: _vehicle,
  days,
  startTime,
  activeSuggestions,
}: BuildSimulationItemsParams): SimulationItem[] {
  // Pass accepted suggestions to the canonical engine.
  // Overnight stops are included so buildTimedTimeline can advance the clock
  // to next-morning departure; they are filtered out of the SimulationItem output.
  const acceptedSuggestions = activeSuggestions.filter(s => s.accepted);

  const timedEvents = buildTimedTimeline(
    summary.segments,
    acceptedSuggestions,
    settings,
    summary.roundTripMidpoint,
    undefined,
    days,
    startTime,
  );

  const items: SimulationItem[] = [];

  for (const event of timedEvents) {
    switch (event.type) {
      case 'fuel':
      case 'meal':
      case 'rest':
      case 'combo': {
        const stop = event.stops[0];
        if (stop && stop.type !== 'overnight') {
          items.push({
            type: 'suggested',
            arrivalTime: event.arrivalTime,
            suggestedStop: stop,
          });
        }
        break;
      }
      case 'waypoint':
      case 'arrival': {
        if (event.segment && event.flatIndex !== undefined) {
          items.push({
            type: 'stop',
            segment: event.segment,
            arrivalTime: event.arrivalTime,
            index: event.flatIndex,
            originalIndex: event.originalIndex ?? event.flatIndex,
          });
        }
        break;
      }
      // 'departure', 'drive', 'overnight', 'destination' — structural events,
      // not rendered as SimulationItems. Day headers come from useTimelineData's
      // dayStartMap; free days from freeDaysAfterSegment.
    }
  }

  return items;
}
