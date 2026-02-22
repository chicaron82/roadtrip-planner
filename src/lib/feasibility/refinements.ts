import type { FeasibilityResult, FeasibilityWarning, RefinementChange } from './types';

/**
 * Compare two trip states and produce change-specific warnings.
 * Used when the user modifies travelers, drivers, stops, etc.
 *
 * @param before - Previous feasibility result
 * @param after - New feasibility result after changes
 * @param changes - What changed (for targeted messaging)
 * @returns Additional warnings about the impact of changes
 */
export function compareRefinements(
  before: FeasibilityResult,
  after: FeasibilityResult,
  changes: RefinementChange,
): FeasibilityWarning[] {
  const warnings: FeasibilityWarning[] = [];

  // Traveler count changed
  if (changes.travelersBefore !== undefined && changes.travelersAfter !== undefined) {
    const diff = changes.travelersAfter - changes.travelersBefore;
    if (diff !== 0) {
      const costDiff = after.summary.perPersonCost - before.summary.perPersonCost;
      const direction = diff > 0 ? 'added' : 'removed';
      const absDiff = Math.abs(diff);
      warnings.push({
        category: 'passenger',
        severity: Math.abs(costDiff) > 50 ? 'warning' : 'info',
        message: `${absDiff} traveler${absDiff > 1 ? 's' : ''} ${direction} — per-person cost ${costDiff >= 0 ? 'increased' : 'decreased'} by $${Math.abs(costDiff)}`,
        detail: `Was $${before.summary.perPersonCost}/person with ${changes.travelersBefore} travelers. Now $${after.summary.perPersonCost}/person with ${changes.travelersAfter}.`,
      });
    }
  }

  // Driver count changed
  if (changes.driversBefore !== undefined && changes.driversAfter !== undefined) {
    if (changes.driversAfter < changes.driversBefore) {
      warnings.push({
        category: 'driver',
        severity: changes.driversAfter === 1 ? 'warning' : 'info',
        message: `Drivers reduced from ${changes.driversBefore} to ${changes.driversAfter}`,
        detail: changes.driversAfter === 1
          ? 'Single driver — no rotation possible. Consider rest stops every 2 hours.'
          : `Rotation intervals will be longer with fewer drivers.`,
        suggestion: changes.driversAfter === 1
          ? 'Review long driving days — single driver fatigue is a safety concern.'
          : undefined,
      });
    }
  }

  // Status changed
  if (before.status !== after.status) {
    if (after.status === 'over') {
      warnings.push({
        category: 'budget',
        severity: 'critical',
        message: 'Plan is no longer within budget after changes',
        suggestion: 'Adjust stops, hotel choices, or increase the budget to make this work.',
      });
    } else if (after.status === 'on-track' && before.status !== 'on-track') {
      warnings.push({
        category: 'budget',
        severity: 'info',
        message: 'Plan is back on track after changes! 🟢',
      });
    }
  }

  return warnings;
}
