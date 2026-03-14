/**
 * source-tier-utils.ts — Derives SourceTier from runtime trip data.
 *
 * The data model (`TimedEvent`, `RouteSegment`) does not carry an explicit
 * `sourceTier` field — source is derivable from the event's type and segment
 * state. This module centralises that derivation so components stay thin.
 *
 * Derivation rules:
 *   departure / drive         → null  (structural, no user-facing source label)
 *   waypoint / arrival        → 'declared'  (user authored the route stop)
 *   overnight with stopType   → 'declared'  (user explicitly set it)
 *   overnight without stopType→ 'inferred'  (engine-placed pacing stop)
 *   fuel / meal / rest / combo→ 'inferred'  (engine-estimated support stop)
 *
 * 💚 Declared vs Inferred vs Discovered — MEE Design Language
 */

import type { SourceTier } from './mee-tokens';
import type { TimedEvent } from './trip-timeline-types';

/**
 * Derives the source tier for a `TimedEvent`.
 *
 * Returns `null` for structural events (departure, drive) that do not
 * warrant a source label in the UI.
 */
export function deriveEventSourceTier(event: TimedEvent): SourceTier | null {
  // Structural — no user-facing source attribution needed
  if (event.type === 'departure' || event.type === 'drive') return null;

  // User-declared route stops
  if (
    event.type === 'waypoint' ||
    event.type === 'arrival'  ||
    event.type === 'destination'
  ) {
    return 'declared';
  }

  // Overnight: declared when the user explicitly set the stopType,
  // otherwise the engine placed it for pacing → inferred
  if (event.type === 'overnight') {
    return event.segment?.stopType === 'overnight' ? 'declared' : 'inferred';
  }

  // Engine-estimated support stops (fuel, meal, rest, combo)
  return 'inferred';
}
