/**
 * trip-strategy-selector.ts — Pure function for applying a named route strategy.
 *
 * Extracted from useTripCalculation.ts to keep the hook under the line cap.
 * Given a strategy and the current summary, produces an updated TripSummary
 * with recalculated costs, round-trip mirroring, and day-split budget.
 *
 * ⭐ THE CONTRACT: a swap builds the same trip the FIRST calculation (orchestrate-trip) would have
 * built for that route. So it uses the first calculation's own steps rather than copies of them.
 *
 * ⚠️ It used to carry its OWN copy of the round-trip mirroring, and the copy had drifted: it dropped
 * the day-trip dwell (a same-day Winnipeg → Gimli trip came home the NEXT MORNING after any swap),
 * drew only the outbound leg, kept a stale drivingDays, and skipped arrival times on one-way trips.
 * Proven by ZeeRah's 2026-09-21 line-check; nothing caught it because the one test that reached this
 * file mocked it. Pinned now by trip-strategy-selector.test.ts, which compares against the first
 * calculation rather than against clock times.
 */

import type { RouteStrategy, Vehicle, TripSettings, TripSummary } from '../types';
import {
  calculateTripCosts,
  calculateArrivalTimes,
} from './calculations';
import {
  calculateStrategicFuelStops,
} from './fuel-stops';
import {
  splitTripByDays,
  calculateCostBreakdown,
  getBudgetStatus,
} from './budget';
import {
  buildRoundTripSegments, stampDeclaredOvernights, stampDrivingDayTerminals,
} from './trip-calculation-helpers';

/**
 * Build an updated TripSummary from a named route strategy.
 *
 * Handles:
 * - Recalculating costs from the strategy's segments
 * - Arrival times, and for a round trip the mirrored return — via the first calculation's own
 *   `buildRoundTripSegments`, so day-trip dwell, both-leg geometry and the fuel model all match
 * - Day splitting with budget tracking, and driving days counted from those days
 * - Budget status + remaining
 */
export function buildStrategyUpdate(
  strategy: RouteStrategy,
  localSummary: TripSummary,
  vehicle: Vehicle,
  settings: TripSettings,
): TripSummary {
  // `newSummary` is fresh and ours — buildRoundTripSegments mutates the summary it is given, which is
  // exactly why the caller's `localSummary` is never passed to it.
  const newSummary = calculateTripCosts(strategy.segments, vehicle, settings);
  newSummary.fullGeometry = strategy.geometry;

  // Same first step as orchestrate-trip: every trip, one-way included, gets its times stamped.
  let allSegments = calculateArrivalTimes(
    newSummary.segments, settings.departureDate, settings.departureTime,
  );
  let outboundLength: number | undefined;

  if (settings.isRoundTrip) {
    const rt = buildRoundTripSegments(allSegments, newSummary, settings, vehicle);
    allSegments = rt.segments;
    outboundLength = rt.roundTripMidpoint;
  }

  // Pin day boundaries at declared overnights — the swap used to skip this, and a planned overnight
  // vanished with any route change (ticket-swap-drops-declared-overnight).
  allSegments = stampDeclaredOvernights(allSegments);

  // Fuel stops and day splits take the OUTBOUND geometry, as the first calculation passes them.
  const stratFuelStops = calculateStrategicFuelStops(
    strategy.geometry,
    allSegments,
    vehicle,
    settings
  );

  const updatedDays = splitTripByDays(
    allSegments,
    settings,
    settings.departureDate,
    settings.departureTime,
    outboundLength,
    strategy.geometry,
    stratFuelStops,
  );

  // Same post-split pass as the first calculation. The breakdown below reads the UNSTAMPED days,
  // exactly as orchestrate-trip does; only the returned records carry the stamp.
  const stamped = stampDrivingDayTerminals(allSegments, updatedDays);

  let updatedCostBreakdown = localSummary.costBreakdown;
  let updatedBudgetStatus = localSummary.budgetStatus;
  let updatedBudgetRemaining = localSummary.budgetRemaining;

  if (updatedDays.length > 0) {
    updatedCostBreakdown = calculateCostBreakdown(updatedDays, settings.numTravelers);
    updatedBudgetStatus = getBudgetStatus(settings.budget, updatedCostBreakdown);
    updatedBudgetRemaining = settings.budget.total - updatedCostBreakdown.total;

    // Sync summary with breakdown — the same rule orchestrate-trip applies.
    // ⚠️ Per person is the WHOLE trip split by travellers: TripSummary.tsx shows it under
    // "Per Person" with "N people · $total total" beneath. This used to divide fuel only.
    newSummary.totalFuelCost = updatedCostBreakdown.fuel;
    newSummary.costPerPerson = settings.numTravelers > 0
      ? updatedCostBreakdown.total / settings.numTravelers
      : updatedCostBreakdown.total;
  }

  return {
    ...localSummary,
    totalDistanceKm: newSummary.totalDistanceKm,
    totalDurationMinutes: newSummary.totalDurationMinutes,
    totalFuelLitres: newSummary.totalFuelLitres,
    totalFuelCost: newSummary.totalFuelCost,
    costPerPerson: newSummary.costPerPerson,
    gasStops: newSummary.gasStops,
    fullGeometry: newSummary.fullGeometry,
    segments: stamped.segments,
    days: stamped.days,
    drivingDays: updatedDays.filter(d => d.dayType !== 'free').length,
    roundTripMidpoint: outboundLength,
    costBreakdown: updatedCostBreakdown,
    budgetStatus: updatedBudgetStatus,
    budgetRemaining: updatedBudgetRemaining,
  };
}
