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

import type { TripSummary, TripSettings, TripDay } from '../types';

// ==================== TYPES ====================

export type FeasibilityStatus = 'on-track' | 'tight' | 'over';

export type WarningCategory =
  | 'budget'        // Over budget, close to budget
  | 'drive-time'    // Exceeds max drive hours
  | 'driver'        // Single driver fatigue, uneven rotation
  | 'timing'        // Late arrivals, early departures
  | 'passenger'     // Per-person cost changes
  | 'fuel';         // Fuel range / gas stop warnings

export type WarningSeverity = 'info' | 'warning' | 'critical';

export interface FeasibilityWarning {
  category: WarningCategory;
  severity: WarningSeverity;
  message: string;
  detail?: string;          // Extended explanation
  dayNumber?: number;       // Which day this applies to (undefined = whole trip)
  suggestion?: string;      // "Consider adding an overnight stop"
}

export interface FeasibilityResult {
  status: FeasibilityStatus;
  warnings: FeasibilityWarning[];
  summary: {
    totalBudgetUsed: number;
    totalBudgetAvailable: number;
    budgetUtilization: number;    // 0-1 (percentage)
    longestDriveDay: number;      // minutes
    maxDriveLimit: number;        // minutes
    perPersonCost: number;
    totalDays: number;
  };
}

// ==================== THRESHOLDS ====================

/** Budget utilization thresholds */
const BUDGET_TIGHT_THRESHOLD = 0.85;  // 85% = amber
const BUDGET_OVER_THRESHOLD = 1.0;    // 100% = red

/** Drive time thresholds (relative to maxDriveHours) */
const DRIVE_TIME_GRACE_HOURS = 1;  // 1h buffer before warning fires

/** Late arrival threshold (hour of day, 24h format) */
const LATE_ARRIVAL_HOUR = 22;         // 10 PM

/** Early departure threshold */
const EARLY_DEPARTURE_HOUR = 4;       // 4 AM

// ==================== CORE ANALYSIS ====================

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

// ==================== BUDGET ANALYSIS ====================

function analyzeBudget(
  summary: TripSummary,
  settings: TripSettings,
): FeasibilityWarning[] {
  const warnings: FeasibilityWarning[] = [];
  const budget = settings.budget;

  if (budget.mode !== 'plan-to-budget' || budget.total <= 0) {
    return warnings; // No budget constraints in open mode
  }

  const days = summary.days || [];
  const totalUsed = calculateTotalBudgetUsed(days);
  const utilization = totalUsed / budget.total;

  if (utilization > BUDGET_OVER_THRESHOLD) {
    const overBy = Math.round(totalUsed - budget.total);
    warnings.push({
      category: 'budget',
      severity: 'critical',
      message: `Over budget by $${overBy}`,
      detail: `Total estimated cost: $${Math.round(totalUsed)}. Budget: $${Math.round(budget.total)}.`,
      suggestion: 'Consider reducing hotel costs, cutting a stop, or increasing the budget.',
    });
  } else if (utilization >= BUDGET_TIGHT_THRESHOLD) {
    const remaining = Math.round(budget.total - totalUsed);
    warnings.push({
      category: 'budget',
      severity: 'warning',
      message: `Budget is tight — $${remaining} remaining`,
      detail: `Using ${Math.round(utilization * 100)}% of your $${Math.round(budget.total)} budget.`,
      suggestion: 'Leave some buffer for unexpected expenses.',
    });
  }

  // Per-category analysis
  if (budget.gas > 0) {
    const gasUsed = days.reduce((sum, d) => sum + d.budget.gasUsed, 0);
    if (gasUsed > budget.gas) {
      warnings.push({
        category: 'budget',
        severity: 'warning',
        message: `Gas budget exceeded by $${Math.round(gasUsed - budget.gas)}`,
        detail: `Gas estimate: $${Math.round(gasUsed)}. Gas budget: $${Math.round(budget.gas)}.`,
      });
    }
  }

  if (budget.hotel > 0) {
    const hotelUsed = days.reduce((sum, d) => sum + d.budget.hotelCost, 0);
    if (hotelUsed > budget.hotel) {
      warnings.push({
        category: 'budget',
        severity: 'warning',
        message: `Hotel budget exceeded by $${Math.round(hotelUsed - budget.hotel)}`,
        detail: `Hotel estimate: $${Math.round(hotelUsed)}. Hotel budget: $${Math.round(budget.hotel)}.`,
      });
    }
  }

  return warnings;
}

// ==================== DRIVE TIME ANALYSIS ====================

function analyzeDriveTime(
  days: TripDay[],
  settings: TripSettings,
): FeasibilityWarning[] {
  const warnings: FeasibilityWarning[] = [];
  const maxDriveMinutes = settings.maxDriveHours * 60;
  const tightDriveMinutes = maxDriveMinutes * 0.9; // 90% threshold for warning

  for (const day of days) {
    const driveMinutes = day.totals.driveTimeMinutes;
    const hardLimitMinutes = maxDriveMinutes + DRIVE_TIME_GRACE_HOURS * 60;

    if (driveMinutes > hardLimitMinutes) {
      const overBy = Math.round((driveMinutes - maxDriveMinutes) / 60 * 10) / 10;
      warnings.push({
        category: 'drive-time',
        severity: 'critical',
        message: `Day ${day.dayNumber}: Drive time exceeds limit by ${overBy}h`,
        detail: `${formatDuration(driveMinutes)} driving vs ${settings.maxDriveHours}h limit.`,
        dayNumber: day.dayNumber,
        suggestion: 'Consider adding an overnight stop to split this day.',
      });
    } else if (driveMinutes >= tightDriveMinutes && driveMinutes <= hardLimitMinutes) {
      warnings.push({
        category: 'drive-time',
        severity: 'warning',
        message: `Day ${day.dayNumber}: Drive time is close to daily limit`,
        detail: `${formatDuration(driveMinutes)} driving vs ${settings.maxDriveHours}h limit.`,
        dayNumber: day.dayNumber,
        suggestion: 'Ensure adequate rest stops are planned.',
      });
    }
    // Grace period (max < drive <= hard limit) now covered by the warning condition above.
  }

  return warnings;
}

// ==================== DRIVER FATIGUE ANALYSIS ====================

function analyzeDriverFatigue(
  days: TripDay[],
  settings: TripSettings,
): FeasibilityWarning[] {
  const warnings: FeasibilityWarning[] = [];

  if (settings.numDrivers < 1) return warnings;

  // Single driver warning for long trips
  if (settings.numDrivers === 1) {
    const totalDriveMinutes = days.reduce(
      (sum, d) => sum + d.totals.driveTimeMinutes,
      0,
    );
    const totalDriveHours = totalDriveMinutes / 60;

    // Warn if any single day exceeds the user's max drive hours with one driver
    const fatigueThresholdMinutes = settings.maxDriveHours * 60;
    const longDays = days.filter(d => d.totals.driveTimeMinutes > fatigueThresholdMinutes);
    if (longDays.length > 0) {
      for (const day of longDays) {
        warnings.push({
          category: 'driver',
          severity: 'warning',
          message: `Day ${day.dayNumber}: ${formatDuration(day.totals.driveTimeMinutes)} with 1 driver`,
          detail: `Long drives with a single driver increase fatigue risk. Recommended: max ${settings.maxDriveHours} hours per driver per day.`,
          dayNumber: day.dayNumber,
          suggestion: totalDriveHours > 16
            ? 'Consider adding a second driver to share the load.'
            : 'Plan extra rest stops to break up the drive.',
        });
      }
    }
  }

  // Multi-driver under-utilization hint
  // If the user has set up team driving but kept the max daily limit at solo levels,
  // nudge them to unlock the real benefit of having multiple drivers.
  if (settings.numDrivers >= 2 && settings.maxDriveHours <= 8) {
    const suggestedHours = settings.numDrivers === 2 ? 12 : 16;
    warnings.push({
      category: 'driver',
      severity: 'info',
      message: `${settings.numDrivers} drivers — you could safely drive up to ${suggestedHours}h/day`,
      detail: `Your daily limit is ${settings.maxDriveHours}h, which is the recommended max for a solo driver. With ${settings.numDrivers} drivers rotating, you can push to ${suggestedHours}h/day and reduce transit days.`,
      suggestion: `Increase "Max Drive Hours" to ${suggestedHours}h in Settings to cut driving days and get more time at your destination.`,
    });
  }

  return warnings;
}

// ==================== TIMING ANALYSIS ====================

function analyzeTiming(days: TripDay[]): FeasibilityWarning[] {
  const warnings: FeasibilityWarning[] = [];

  for (const day of days) {
    // Check late arrivals
    if (day.totals.arrivalTime) {
      const arrival = new Date(day.totals.arrivalTime);
      if (!isNaN(arrival.getTime()) && arrival.getHours() >= LATE_ARRIVAL_HOUR) {
        warnings.push({
          category: 'timing',
          severity: 'warning',
          message: `Day ${day.dayNumber}: Late arrival at ${formatTime(arrival)}`,
          detail: 'Arriving after 10 PM can make hotel check-in difficult and reduces rest time.',
          dayNumber: day.dayNumber,
          suggestion: 'Consider departing earlier or splitting the drive.',
        });
      }
    }

    // Check early departures (skip free days — they have no real departure)
    if (day.totals.departureTime && day.dayType !== 'free') {
      const departure = new Date(day.totals.departureTime);
      const h = departure.getHours();
      const m = departure.getMinutes();
      // Skip hour=0 min=0 — that's the midnight sentinel meaning "not set"
      if (!isNaN(departure.getTime()) && h < EARLY_DEPARTURE_HOUR && (h > 0 || m > 0)) {
        warnings.push({
          category: 'timing',
          severity: 'info',
          message: `Day ${day.dayNumber}: Early departure at ${formatTime(departure)}`,
          detail: 'Departing before 4 AM means less sleep. Make sure the previous night allows enough rest.',
          dayNumber: day.dayNumber,
        });
      }
    }
  }

  return warnings;
}

// ==================== PER-PERSON COST ANALYSIS ====================

function analyzePerPersonCosts(
  summary: TripSummary,
  settings: TripSettings,
): FeasibilityWarning[] {
  const warnings: FeasibilityWarning[] = [];
  const days = summary.days || [];

  if (settings.numTravelers <= 0) return warnings;

  const totalCost = calculateTotalBudgetUsed(days);
  const perPerson = Math.round(totalCost / settings.numTravelers);
  const budget = settings.budget;

  // Inform about per-person cost when in budget mode
  if (budget.mode === 'plan-to-budget' && budget.total > 0) {
    const perPersonBudget = Math.round(budget.total / settings.numTravelers);
    if (perPerson > perPersonBudget) {
      warnings.push({
        category: 'passenger',
        severity: 'warning',
        message: `Per-person cost ($${perPerson}) exceeds per-person budget ($${perPersonBudget})`,
        detail: `${settings.numTravelers} traveler${settings.numTravelers > 1 ? 's' : ''} splitting $${Math.round(totalCost)} total.`,
      });
    }
  }

  return warnings;
}

// ==================== REFINEMENT COMPARISON ====================

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

export interface RefinementChange {
  travelersBefore?: number;
  travelersAfter?: number;
  driversBefore?: number;
  driversAfter?: number;
  stopsAdded?: number;
  stopsRemoved?: number;
}

// ==================== HELPERS ====================

function calculateTotalBudgetUsed(days: TripDay[]): number {
  return days.reduce((sum, d) => sum + d.budget.dayTotal, 0);
}

function deriveStatus(warnings: FeasibilityWarning[]): FeasibilityStatus {
  if (warnings.some(w => w.severity === 'critical')) return 'over';
  if (warnings.some(w => w.severity === 'warning')) return 'tight';
  return 'on-track';
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
