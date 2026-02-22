import type { TripDay, TripSettings } from '../../types';
import type { FeasibilityWarning } from './types';
import { formatDuration } from './helpers';

/** Drive time thresholds (relative to maxDriveHours) */
const DRIVE_TIME_GRACE_HOURS = 1;  // 1h buffer before warning fires

export function analyzeDriveTime(
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

export function analyzeDriverFatigue(
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
