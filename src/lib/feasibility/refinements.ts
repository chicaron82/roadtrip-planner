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
      // Round to nearest dollar — perPersonCost can be a float
      const costDiff = Math.round(after.summary.perPersonCost - before.summary.perPersonCost);
      const direction = diff > 0 ? 'added' : 'removed';
      const absDiff = Math.abs(diff);
      warnings.push({
        category: 'passenger',
        severity: Math.abs(costDiff) > 50 ? 'warning' : 'info',
        message: `${absDiff} traveler${absDiff > 1 ? 's' : ''} ${direction} — per-person cost ${costDiff >= 0 ? 'increased' : 'decreased'} by $${Math.abs(costDiff)}`,
        detail: `Was $${Math.round(before.summary.perPersonCost)}/person with ${changes.travelersBefore} travelers. Now $${Math.round(after.summary.perPersonCost)}/person with ${changes.travelersAfter}.`,
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

  // Route stops added / removed
  // "stops" here means user-added waypoints (detours, attractions) — adding them
  // extends the route and can push drive time or budget into warning territory.
  if (changes.stopsAdded && changes.stopsAdded > 0) {
    const driveTimeDiffMins = after.summary.longestDriveDay - before.summary.longestDriveDay;
    const costDiff = Math.round(after.summary.totalBudgetUsed - before.summary.totalBudgetUsed);
    const n = changes.stopsAdded;
    const driveNote = driveTimeDiffMins > 30
      ? ` Longest driving day is ~${Math.round(driveTimeDiffMins / 60 * 10) / 10}h longer.`
      : '';
    const costNote = costDiff > 0 ? ` Estimated cost up ~$${costDiff}.` : '';
    warnings.push({
      category: 'drive-time',
      severity: after.status === 'over' ? 'warning' : 'info',
      message: `${n} stop${n > 1 ? 's' : ''} added to route`,
      detail: `Route is longer.${driveNote}${costNote}`.trim() || undefined,
      suggestion: after.status === 'over'
        ? 'Consider swapping a hotel night for an earlier departure to recover time.'
        : undefined,
    });
  }

  if (changes.stopsRemoved && changes.stopsRemoved > 0) {
    const n = changes.stopsRemoved;
    warnings.push({
      category: 'drive-time',
      severity: 'info',
      message: `${n} stop${n > 1 ? 's' : ''} removed from route`,
      detail: 'Driving stretches may be longer between the remaining stops.',
      suggestion: n > 1
        ? 'Consider adding a fuel or rest break if any stretch exceeds 3 hours.'
        : undefined,
    });
  }

  // Budget threshold crossed
  const wasOver = before.summary.budgetUtilization > 1;
  const isOver = after.summary.budgetUtilization > 1;

  if (!wasOver && isOver) {
    warnings.push({
      category: 'budget',
      severity: 'warning',
      message: 'Plan is no longer within budget after changes',
      suggestion: 'Adjust stops, hotel choices, or increase the budget to make this work.',
    });
  } else if (wasOver && !isOver) {
    warnings.push({
      category: 'budget',
      severity: 'info',
      message: 'Plan is back on track after changes! 🟢',
    });
  }

  return warnings;
}
