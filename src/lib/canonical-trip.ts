/**
 * canonical-trip.ts — Named contract for useTripCalculation's output
 *
 * Defines the authoritative shape that a completed trip calculation produces.
 * All downstream surfaces — itinerary view, print/PDF, ghost car, arrival
 * hero, overnight logic — should derive their display data from this shape,
 * not by independently re-deriving data from TripSummary + TimedEvent[].
 *
 * Migration path:
 *   1. ✅ useTripCalculation.ts produces CanonicalTripTimeline alongside TripSummary
 *   2. ItineraryTimeline switches to ItineraryInput (days + summary)
 *   3. trip-print-builders switches to PrintInput (days + summary + inputs)
 *   4. useGhostCar switches to GhostCarInput (events)
 *   5. TripSummary reference in calculateTrip() return type → CanonicalTripTimeline
 *
 * 💚 My Experience Engine
 */

import type { TripSummary, TripDay, TripSettings, Vehicle } from '../types';
import type { Location } from '../types';
import type { TimedEvent } from './trip-timeline';

// ─── Grouped day container ────────────────────────────────────────────────────

/**
 * One driving day: metadata from the budget pipeline + ordered timed events
 * from the timeline engine.
 *
 * Replaces the current pattern where each consumer independently filters
 * the global TimedEvent[] by day index and cross-references TripDay[] — a
 * step that is currently duplicated in ItineraryTimeline, trip-print-builders,
 * and the arrival hero calculation.
 */
export interface CanonicalTripDay {
  /** Budget, route label, overnight stop, timezone changes — from splitTripByDays */
  meta: TripDay;
  /** Timed events that occur on this day, in chronological order */
  events: TimedEvent[];
}

// ─── Full trip output ─────────────────────────────────────────────────────────

/**
 * Authoritative output of a completed trip calculation.
 *
 * Consumer contracts — what each surface reads:
 *
 *   Ghost car      ← events  (timed positions + timezone for lerp interpolation)
 *   Itinerary      ← days    (ordered events grouped by driving day)
 *   Print / PDF    ← days + summary + inputs
 *   Arrival hero   ← summary stats + days.at(-1) final event
 *   Overnight logic ← days  (scan for events where type === 'overnight')
 *   Journal stops  ← days  (map events to journal entry slots)
 */
export interface CanonicalTripTimeline {
  /** Flat ordered event sequence — single source of truth for timing and position */
  events: TimedEvent[];

  /**
   * Same events, grouped by driving day and paired with the day's budget/route
   * metadata. Parallel in length with summary.days.
   */
  days: CanonicalTripDay[];

  /** Aggregate stats, cost breakdown, budget status, geometry */
  summary: TripSummary;

  /**
   * Trip inputs that produced this result.
   * Required by print (header) and template export (re-use as trip template).
   * Not stored in TripSummary today — naming it here makes the gap explicit.
   */
  inputs: {
    locations: Location[];
    vehicle: Vehicle;
    settings: TripSettings;
  };
}

// ─── Narrow surface contracts ─────────────────────────────────────────────────
//
// Each surface should consume only the slice it needs, not the full timeline.
// Using Pick enforces that: adding a field to one surface's input can't
// accidentally change what another surface receives.

/** What the ghost car anchor + lerp system reads */
export type GhostCarInput = Pick<CanonicalTripTimeline, 'events'>;

/** What the itinerary view renders */
export type ItineraryInput = Pick<CanonicalTripTimeline, 'days' | 'summary'>;

/** What print / PDF formats */
export type PrintInput = Pick<CanonicalTripTimeline, 'days' | 'summary' | 'inputs'>;
