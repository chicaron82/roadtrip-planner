/**
 * Trip Feasibility Engine
 *
 * Pure functions that analyze a trip plan and produce health checks.
 * No DOM, no React — just data in, warnings out.
 *
 * Use cases:
 * - Post-calculation health check
 * - Live refinement feedback (traveler count change, stop added/removed)
 * - Print view summary
 *
 * Inspired by Aaron's 2025 Winnipeg→Toronto trip where 4→3 travelers,
 * 2→1 drivers, and a Montreal cut all cascaded through the plan.
 */

import type { TripSummary, TripSettings } from '../../types';
import type { FeasibilityResult, FeasibilityWarning } from './types';
import { analyzeBudget } from './analyze-budget';
import { analyzeDriveTime, analyzeDriverFatigue } from './analyze-drive-time';
import { analyzeTiming, analyzeDateWindow } from './analyze-timing';
import { analyzePerPersonCosts } from './analyze-costs';
import { calculateTotalBudgetUsed, deriveStatus } from './helpers';

// Re-export public API
export type { FeasibilityStatus, WarningCategory, WarningSeverity, FeasibilityWarning, FeasibilityResult, RefinementChange } from './types';
export { compareRefinements } from './refinements';

/**
 * Run a full feasibility analysis on a trip plan.
 *
 * @param summary - Calculated trip summary with segments and days
 * @param settings - Trip settings (budget, max drive hours, travelers, etc.)
 * @returns Feasibility result with status and warnings
 */
export function analyzeFeasibility(
  summary: TripSummary,
  settings: TripSettings,
): FeasibilityResult {
  const warnings: FeasibilityWarning[] = [];
  const days = summary.days || [];

  // Run all analysis passes
  warnings.push(...analyzeBudget(summary, settings));
  warnings.push(...analyzeDriveTime(days, settings));
  warnings.push(...analyzeDriverFatigue(days, settings));
  warnings.push(...analyzeTiming(days));
  warnings.push(...analyzePerPersonCosts(summary, settings));
  warnings.push(...analyzeDateWindow(days, settings));

  // Determine overall status from worst warning
  const status = deriveStatus(warnings);

  // Build summary
  const totalBudgetUsed = calculateTotalBudgetUsed(days);
  const totalBudgetAvailable = settings.budget.total;
  const longestDriveDay = days.reduce(
    (max, d) => Math.max(max, d.totals.driveTimeMinutes),
    0,
  );

  return {
    status,
    warnings,
    summary: {
      totalBudgetUsed,
      totalBudgetAvailable,
      budgetUtilization: totalBudgetAvailable > 0
        ? totalBudgetUsed / totalBudgetAvailable
        : 0,
      longestDriveDay,
      maxDriveLimit: settings.maxDriveHours * 60,
      perPersonCost: settings.numTravelers > 0
        ? Math.round(totalBudgetUsed / settings.numTravelers)
        : 0,
      totalDays: days.length,
    },
  };
}
