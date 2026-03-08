import type { TripDay, TripSettings } from '../../types';
import type { FeasibilityWarning } from './types';
import { formatDuration } from './helpers';
import { TRIP_CONSTANTS } from '../trip-constants';
import { lngToIANA } from '../trip-timezone';

/**
 * Comfortable daily max for rotating drivers — the ceiling where individual
 * shifts are still manageable and the crew checks in at a civilised hour.
 * Used in both the Day 1 late-arrival hint and the per-day close-to-limit hint.
 */
function getComfortMaxHours(numDrivers: number): number {
  return numDrivers >= 4 ? 12 : numDrivers === 3 ? 11 : 10; // 2 drivers
}

/** Build the multi-driver reduce-hours hint string, or '' if not applicable. */
function buildDriverHint(numDrivers: number, maxDriveHours: number): string {
  if (numDrivers < 2 || maxDriveHours <= 10) return '';
  const comfortMax = getComfortMaxHours(numDrivers);
  if (maxDriveHours <= comfortMax) return '';
  const perShift = Math.round((comfortMax / numDrivers) * 10) / 10;
  return ` With ${numDrivers} rotating drivers, try ${comfortMax}h max — shifts drop to ~${perShift}h each and you'll check in before midnight.`;
}

export function analyzeDriveTime(
  days: TripDay[],
  settings: TripSettings,
): FeasibilityWarning[] {
  const warnings: FeasibilityWarning[] = [];
  const maxDriveMinutes = settings.maxDriveHours * 60;
  const tightDriveMinutes = maxDriveMinutes * TRIP_CONSTANTS.feasibility.tightDriveThreshold;

  // ── Day 1 late-arrival check ──────────────────────────────────────────────
  // Day 1 always uses the user's explicit departureTime (e.g. "09:00"). If the
  // first driving day has more drive time than the gap between departure and the
  // target arrival hour, the crew will arrive well past their intended time.
  // We warn and suggest an earlier departure rather than silently adjusting it.
  const day1 = days.find(d => d.dayNumber === 1 && d.totals.driveTimeMinutes > 0);
  if (day1) {
    const [depH, depM] = settings.departureTime.split(':').map(Number);
    const departureDecimal = depH + (depM || 0) / 60;
    const targetArrivalHour = settings.targetArrivalHour ?? 21;
    const availableHours = targetArrivalHour - departureDecimal;
    const actualDriveHours = day1.totals.driveTimeMinutes / 60;

    // Express arrival in the destination's local timezone so stop durations
    // and timezone shifts are both accounted for (not just raw drive time).
    const lastSeg = day1.segments[day1.segments.length - 1];
    const destTZ = lngToIANA(lastSeg.to.lng);
    let estimatedArrivalHour: number;
    // Only use the timezone-aware path when arrivalTime is an explicit UTC ISO
    // string (ends with 'Z'). Production always uses Date.toISOString() which
    // includes 'Z'. Test fixtures without 'Z' fall back to drive-time arithmetic.
    const arrivalISO = day1.totals.arrivalTime;
    if (arrivalISO && /Z$|[+-]\d\d:\d\d$/.test(arrivalISO)) {
      const arrDate = new Date(arrivalISO);
      const [hStr, mStr] = new Intl.DateTimeFormat('en-US', {
        timeZone: destTZ, hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(arrDate).split(':');
      estimatedArrivalHour = (parseInt(hStr) % 24) + parseInt(mStr) / 60;
      // Handle post-midnight arrivals (e.g. 1:00 AM after 9 AM departure)
      if (estimatedArrivalHour < departureDecimal) estimatedArrivalHour += 24;
    } else {
      estimatedArrivalHour = departureDecimal + actualDriveHours;
    }
    // Effective elapsed hours absorbed into destination TZ (drive + stops + TZ shift)
    const effectiveElapsedHours = estimatedArrivalHour - departureDecimal;

    if (estimatedArrivalHour > targetArrivalHour + TRIP_CONSTANTS.feasibility.day1ArrivalBuffer) {
      // Suggest the ideal departure so they'd hit the target arrival
      const suggestedDep = Math.max(5, Math.round(targetArrivalHour - effectiveElapsedHours));
      const suggestedH = Math.floor(suggestedDep);
      const suggestedMin = Math.round((suggestedDep - suggestedH) * 60);
      const suggestedLabel = `${suggestedH}:${String(suggestedMin).padStart(2, '0')}`;
      // Normalize arrival label — handles post-midnight arrivals (24:30 → "0:30, next day")
      const arrivalNorm   = estimatedArrivalHour >= 24 ? estimatedArrivalHour - 24 : estimatedArrivalHour;
      const arrivalH      = Math.floor(arrivalNorm);
      const arrivalMin    = Math.round((arrivalNorm - arrivalH) * 60);
      const arrivalSuffix = estimatedArrivalHour >= 24 ? ', next day' : '';
      const arrivalLabel  = `${arrivalH}:${String(arrivalMin).padStart(2, '0')}${arrivalSuffix}`;
      const overByHours   = Math.round((estimatedArrivalHour - targetArrivalHour) * 10) / 10;

      const driverHint = buildDriverHint(settings.numDrivers, settings.maxDriveHours);

      warnings.push({
        category: 'drive-time',
        severity: 'info',
        message: `Day 1: departing at ${settings.departureTime} means arriving around ${arrivalLabel}`,
        detail: `With ${formatDuration(day1.totals.driveTimeMinutes)} of driving, you'll arrive ~${overByHours}h past your ${targetArrivalHour}:00 target. ${availableHours < effectiveElapsedHours ? 'The drive is longer than the day allows.' : ''}`,
        dayNumber: 1,
        suggestion: `Depart by ${suggestedLabel} to arrive near your ${targetArrivalHour}:00 target.${actualDriveHours > settings.maxDriveHours ? ' Or add a planned overnight stop to split the drive.' : ''}${driverHint}`,
      });
    }
  }

  for (const day of days) {
    const driveMinutes = day.totals.driveTimeMinutes;
    const hardLimitMinutes = maxDriveMinutes + TRIP_CONSTANTS.feasibility.driveTimeGraceHours * 60;

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
      const hint = buildDriverHint(settings.numDrivers, settings.maxDriveHours);
      warnings.push({
        category: 'drive-time',
        severity: 'warning',
        message: `Day ${day.dayNumber}: Drive time is close to daily limit`,
        detail: `${formatDuration(driveMinutes)} driving vs ${settings.maxDriveHours}h limit.`,
        dayNumber: day.dayNumber,
        suggestion: `Ensure adequate rest stops are planned.${hint}`,
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

  // Per-driver shift breakdown — show how the driving is distributed when rotating
  if (settings.numDrivers >= TRIP_CONSTANTS.feasibility.minDriversForRotation) {
    const drivingDays = days.filter(d => d.totals.driveTimeMinutes >= TRIP_CONSTANTS.feasibility.minDrivingMinutesForBreakdown);
    for (const day of drivingDays) {
      const perDriverMinutes = Math.round(day.totals.driveTimeMinutes / settings.numDrivers);
      const perDriverHours = Math.floor(perDriverMinutes / 60);
      const perDriverMins = perDriverMinutes % 60;
      const shiftLabel = perDriverMins > 0
        ? `${perDriverHours}h ${perDriverMins}m`
        : `${perDriverHours}h`;
      warnings.push({
        category: 'driver',
        severity: 'info',
        message: `Day ${day.dayNumber}: each driver takes ~${shiftLabel} (${settings.numDrivers} rotating)`,
        detail: `${formatDuration(day.totals.driveTimeMinutes)} total driving split across ${settings.numDrivers} drivers.`,
        dayNumber: day.dayNumber,
      });
    }
  }

  // Multi-driver under-utilization hint
  // If the user has set up team driving but kept the max daily limit at solo levels,
  // nudge them to unlock the real benefit of having multiple drivers.
  if (settings.numDrivers >= TRIP_CONSTANTS.feasibility.minDriversForRotation && settings.maxDriveHours <= 8) {
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
