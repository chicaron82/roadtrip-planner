import type { TripSettings } from '../types';
import type { FeasibilityResult } from './feasibility';
import type { Step3HealthSummary } from './trip-summary-slices';
import { getTripDayCounts } from './trip-summary-view';

export interface PlannerRationaleItem {
  label: string;
  message: string;
}

function formatHours(totalMinutes: number): string {
  const hours = totalMinutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function buildDaySplitReason(summary: Step3HealthSummary, settings: TripSettings): PlannerRationaleItem {
  const { drivingDays, freeDays } = getTripDayCounts(summary);
  const totalHours = formatHours(summary.totalDurationMinutes);
  const freeDayText = freeDays > 0 ? ` plus ${freeDays} free day${freeDays !== 1 ? 's' : ''}` : '';

  if (drivingDays <= 1) {
    return {
      label: 'Day split',
      message: `Kept to one driving day because ${totalHours} stays within your ${settings.maxDriveHours}h/day target.${freeDayText}`,
    };
  }

  return {
    label: 'Day split',
    message: `Split into ${drivingDays} driving days because ${totalHours} would overrun your ${settings.maxDriveHours}h/day target in one push.${freeDayText}`,
  };
}

function buildPaceReason(summary: Step3HealthSummary, feasibility: FeasibilityResult | null): PlannerRationaleItem | null {
  if (!feasibility) return null;

  const leadWarning = feasibility.warnings.find(w => w.category === 'drive-time' || w.category === 'driver' || w.category === 'timing')
    ?? feasibility.warnings[0];

  if (feasibility.status === 'on-track') {
    const longestDayMinutes = Math.max(...(summary.days?.map(day => day.totals.driveTimeMinutes) ?? [summary.totalDurationMinutes]));
    return {
      label: 'Pace',
      message: `This looks on track because the longest driving day lands around ${formatHours(longestDayMinutes)} and the current plan avoids critical pressure points.`,
    };
  }

  return {
    label: 'Pace',
    message: leadWarning?.message ?? 'The planner sees pressure in the current pace, so the trip needs a little more slack.',
  };
}

function buildOvernightReason(summary: Step3HealthSummary): PlannerRationaleItem | null {
  const overnightDays = summary.days?.filter(day => day.segmentIndices.length > 0 && day.overnight)?.length ?? 0;
  if (overnightDays === 0) return null;

  return {
    label: 'Overnights',
    message: `Overnights are carrying ${overnightDays} transit day${overnightDays !== 1 ? 's' : ''} so the route reads like a believable road trip instead of one continuous push.`,
  };
}

function buildBudgetReason(summary: Step3HealthSummary, settings: TripSettings): PlannerRationaleItem | null {
  if (settings.budgetMode !== 'plan-to-budget' || !summary.costBreakdown) return null;

  const categoryDeltas = [
    { label: 'fuel', delta: settings.budget.gas - summary.costBreakdown.fuel },
    { label: 'hotels', delta: settings.budget.hotel - summary.costBreakdown.accommodation },
    { label: 'food', delta: settings.budget.food - summary.costBreakdown.meals },
    { label: 'misc', delta: settings.budget.misc - summary.costBreakdown.misc },
  ];
  const worstCategory = categoryDeltas
    .filter(item => item.delta < 0)
    .sort((a, b) => a.delta - b.delta)[0];

  if (!worstCategory) {
    return {
      label: 'Budget',
      message: 'Budget looks coherent overall; no category is currently pushing the trip past plan.',
    };
  }

  return {
    label: 'Budget',
    message: `Budget pressure is coming mostly from ${worstCategory.label}, which is why the plan reads tighter than the route itself.`,
  };
}

function buildFuelReason(summary: Step3HealthSummary, settings: TripSettings): PlannerRationaleItem | null {
  if (summary.gasStops <= 0) return null;

  const averageKm = Math.round(summary.totalDistanceKm / summary.gasStops);
  return {
    label: 'Fuel rhythm',
    message: `Fuel timing follows your ${settings.stopFrequency} profile and current vehicle range, landing at roughly one fill every ${averageKm} km.`,
  };
}

export function buildPlannerRationale(
  summary: Step3HealthSummary,
  settings: TripSettings,
  feasibility: FeasibilityResult | null,
): PlannerRationaleItem[] {
  return [
    buildDaySplitReason(summary, settings),
    buildPaceReason(summary, feasibility),
    buildOvernightReason(summary),
    buildBudgetReason(summary, settings),
    buildFuelReason(summary, settings),
  ].filter((item): item is PlannerRationaleItem => !!item);
}