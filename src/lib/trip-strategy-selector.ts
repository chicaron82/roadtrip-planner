/**
 * trip-strategy-selector.ts — Pure function for applying a named route strategy.
 *
 * Extracted from useTripCalculation.ts to keep hook under 300 lines.
 * Given a strategy and the current summary, produces an updated TripSummary
 * with recalculated costs, round-trip mirroring, and day-split budget.
 */

import type { RouteStrategy, Vehicle, TripSettings, TripSummary } from '../types';
import {
  calculateTripCosts,
  calculateArrivalTimes,
  calculateHumanFuelCosts,
} from './calculations';
import {
  splitTripByDays,
  calculateCostBreakdown,
  getBudgetStatus,
} from './budget';
import {
  getTankSizeLitres,
  getWeightedFuelEconomyL100km,
  estimateGasStops,
} from './unit-conversions';

/**
 * Build an updated TripSummary from a named route strategy.
 *
 * Handles:
 * - Recalculating costs from the strategy's segments
 * - Round-trip: mirroring outbound→return and recalculating totals
 * - Day splitting with budget tracking
 * - Budget status + remaining
 */
export function buildStrategyUpdate(
  strategy: RouteStrategy,
  localSummary: TripSummary,
  vehicle: Vehicle,
  settings: TripSettings,
): TripSummary {
  const newSummary = calculateTripCosts(strategy.segments, vehicle, settings);

  let allSegments = newSummary.segments;
  let outboundLength: number | undefined;

  if (settings.isRoundTrip) {
    const outbound = newSummary.segments;
    outboundLength = outbound.length;
    const returnLegs = [...outbound].reverse().map(seg => ({
      ...seg,
      from: seg.to,
      to: seg.from,
      departureTime: undefined,
      arrivalTime: undefined,
      stopDuration: undefined,
      stopType: 'drive' as const,
    }));
    allSegments = calculateArrivalTimes(
      [...outbound, ...returnLegs],
      settings.departureDate,
      settings.departureTime,
      outboundLength,
    );

    newSummary.totalDistanceKm = allSegments.reduce((s, seg) => s + seg.distanceKm, 0);
    newSummary.totalDurationMinutes = allSegments.reduce((s, seg) => s + seg.durationMinutes, 0);
    newSummary.totalFuelLitres = allSegments.reduce((s, seg) => s + seg.fuelNeededLitres, 0);
    const stratSegFuelCost = allSegments.reduce((s, seg) => s + seg.fuelCost, 0);
    const tankSizeLitres = getTankSizeLitres(vehicle, settings.units);
    newSummary.gasStops = estimateGasStops(newSummary.totalFuelLitres, tankSizeLitres);

    const stratEconomy = getWeightedFuelEconomyL100km(vehicle, settings.units);
    const stratLastSeg = allSegments[allSegments.length - 1];
    const stratAverageGasPrice = newSummary.totalFuelLitres > 0
      ? stratSegFuelCost / newSummary.totalFuelLitres
      : settings.gasPrice;

    const stratHuman = calculateHumanFuelCosts(
      newSummary.gasStops, tankSizeLitres, stratAverageGasPrice,
      stratLastSeg?.distanceKm ?? 0, stratEconomy,
    );
    newSummary.totalFuelCost = Math.max(stratSegFuelCost, stratHuman.totalFuelCost);
    newSummary.costPerPerson = settings.numTravelers > 0
      ? newSummary.totalFuelCost / settings.numTravelers
      : newSummary.totalFuelCost;
  }

  const updatedDays = splitTripByDays(
    allSegments,
    settings,
    settings.departureDate,
    settings.departureTime,
    outboundLength,
    strategy.geometry as [number, number][],
  );

  let updatedCostBreakdown = localSummary.costBreakdown;
  let updatedBudgetStatus = localSummary.budgetStatus;
  let updatedBudgetRemaining = localSummary.budgetRemaining;

  if (updatedDays.length > 0) {
    updatedCostBreakdown = calculateCostBreakdown(updatedDays, settings.numTravelers);
    updatedBudgetStatus = getBudgetStatus(settings.budget, updatedCostBreakdown);
    updatedBudgetRemaining = settings.budget.total - updatedCostBreakdown.total;
  }

  return {
    ...localSummary,
    totalDistanceKm: newSummary.totalDistanceKm,
    totalDurationMinutes: newSummary.totalDurationMinutes,
    totalFuelLitres: newSummary.totalFuelLitres,
    totalFuelCost: newSummary.totalFuelCost,
    costPerPerson: newSummary.costPerPerson,
    gasStops: newSummary.gasStops,
    fullGeometry: strategy.geometry,
    segments: allSegments,
    days: updatedDays,
    costBreakdown: updatedCostBreakdown,
    budgetStatus: updatedBudgetStatus,
    budgetRemaining: updatedBudgetRemaining,
  };
}
