import type { TripSummary, TripSettings } from '../../types';
import { TRIP_CONSTANTS } from '../trip-constants';

export interface SensitivityScenario {
  label: string;
  gasCost: number;
  hotelCost: number;
  totalCost: number;
  /** Percentage of total budget used. null when budgetMode is 'open'. */
  pctOfBudget: number | null;
}

/**
 * Compute three "what-if" cost scenarios relative to the base trip estimate.
 *
 * Scenarios:
 *   Base      — current calculated costs
 *   +10% Fuel — fuel price 10% higher (e.g., gas stations scarce, highway pricing)
 *   +1 Night  — one extra overnight (missed connection, weather delay)
 */
export function computeSensitivity(
  summary: TripSummary,
  settings: TripSettings,
): SensitivityScenario[] {
  const breakdown = summary.costBreakdown;
  if (!breakdown) return [];

  const baseGas   = breakdown.fuel;
  const baseHotel = breakdown.accommodation;
  const baseOther = breakdown.meals + breakdown.misc;
  const baseTotal = breakdown.total;

  const isPlanMode = settings.budgetMode === 'plan-to-budget' && settings.budget.total > 0;
  const budgetTotal = settings.budget.total;

  function pct(total: number): number | null {
    if (!isPlanMode) return null;
    return Math.round((total / budgetTotal) * 100);
  }

  const scenarios: SensitivityScenario[] = [
    {
      label: 'Base',
      gasCost: baseGas,
      hotelCost: baseHotel,
      totalCost: baseTotal,
      pctOfBudget: pct(baseTotal),
    },
    {
      label: '+10% Fuel',
      gasCost: baseGas * 1.1,
      hotelCost: baseHotel,
      totalCost: baseGas * 1.1 + baseHotel + baseOther,
      pctOfBudget: pct(baseGas * 1.1 + baseHotel + baseOther),
    },
    {
      label: '+1 Night',
      gasCost: baseGas,
      hotelCost: baseHotel + settings.hotelPricePerNight,
      totalCost: baseTotal + settings.hotelPricePerNight,
      pctOfBudget: pct(baseTotal + settings.hotelPricePerNight),
    },
  ];

  return scenarios;
}

/** Whether a scenario's % of budget is in the amber or red zone. */
export function getSensitivityStatus(
  pctOfBudget: number | null,
): 'green' | 'amber' | 'red' | null {
  if (pctOfBudget === null) return null;
  if (pctOfBudget > TRIP_CONSTANTS.budget.overThreshold * 100) return 'red';
  if (pctOfBudget >= TRIP_CONSTANTS.budget.tightThreshold * 100) return 'amber';
  return 'green';
}
