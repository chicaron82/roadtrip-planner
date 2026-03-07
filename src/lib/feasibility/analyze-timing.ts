import type { TripDay, TripSettings } from '../../types';
import type { FeasibilityWarning } from './types';
import { formatTime } from './helpers';

/** Late arrival threshold (hour of day, 24h format) */
const LATE_ARRIVAL_HOUR = 22;         // 10 PM

/** Early departure threshold */
const EARLY_DEPARTURE_HOUR = 4;       // 4 AM

export function analyzeTiming(days: TripDay[]): FeasibilityWarning[] {
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

  // Compressed-morning check — correlates consecutive day pairs.
  // The per-day loop above catches each day in isolation. This catches the
  // gap BETWEEN days: a late arrival followed by an early departure leaves
  // the crew with barely enough time to sleep, even if neither day triggers
  // the individual thresholds above (e.g. arrive midnight, leave 6 AM).
  for (let i = 0; i < days.length - 1; i++) {
    const today    = days[i];
    const tomorrow = days[i + 1];
    if (!today.totals.arrivalTime || !tomorrow.totals.departureTime) continue;
    // Free days have no meaningful departure — skip them.
    if (tomorrow.dayType === 'free' || tomorrow.totals.driveTimeMinutes === 0) continue;

    const arrival   = new Date(today.totals.arrivalTime);
    const departure = new Date(tomorrow.totals.departureTime);
    if (isNaN(arrival.getTime()) || isNaN(departure.getTime())) continue;

    const restHours = (departure.getTime() - arrival.getTime()) / (1000 * 60 * 60);
    if (restHours > 0 && restHours < 6) {
      const restH = Math.floor(restHours);
      const restM = Math.round((restHours - restH) * 60);
      const restLabel = restM > 0 ? `${restH}h ${restM}m` : `${restH}h`;
      warnings.push({
        category: 'timing',
        severity: restHours < 4 ? 'critical' : 'warning',
        message: `Night ${today.dayNumber}→${tomorrow.dayNumber}: only ${restLabel} rest`,
        detail: `Arrived ${formatTime(arrival)}, departing ${formatTime(departure)} — barely time to sleep.`,
        dayNumber: tomorrow.dayNumber,
        suggestion: `Reduce max drive hours so Day ${today.dayNumber} arrives earlier, or push Day ${tomorrow.dayNumber}'s departure back.`,
      });
    }
  }

  return warnings;
}

/**
 * Check whether the user's departure→return date window actually fits the
 * trip.  If transit days consume all or most of the calendar, suggest fixes.
 */
export function analyzeDateWindow(
  days: TripDay[],
  settings: TripSettings,
): FeasibilityWarning[] {
  const warnings: FeasibilityWarning[] = [];

  // Only meaningful when both dates are set (round-trip or fixed-end one-way).
  if (!settings.departureDate || !settings.returnDate) return warnings;

  const dep = new Date(settings.departureDate + 'T00:00:00');
  const ret = new Date(settings.returnDate + 'T00:00:00');
  const totalCalendarDays = Math.max(
    1,
    Math.round((ret.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );

  // Count transit days (days with at least one driving segment).
  const transitDays = days.filter(
    d => d.segments.length > 0 && d.dayType !== 'free',
  ).length;

  const freeDays = totalCalendarDays - transitDays;

  if (freeDays < 0) {
    // More transit days than calendar days — the route is longer than the date window.
    const extraDaysNeeded = Math.abs(freeDays);

    // Find the longest pair of consecutive transit days — this is the binding leg
    // that was split by the driving limit. Its combined time tells us the minimum
    // max drive hours that would absorb the overflow (one leg → one day).
    const transitDaysList = days.filter(d => d.segments.length > 0 && d.dayType !== 'free');
    let maxPairMinutes = 0;
    for (let i = 0; i < transitDaysList.length - 1; i++) {
      const pair = transitDaysList[i].totals.driveTimeMinutes + transitDaysList[i + 1].totals.driveTimeMinutes;
      maxPairMinutes = Math.max(maxPairMinutes, pair);
    }

    // Effective max = maxHours * 60 + 60 (1h grace). To fit the leg in one day:
    // maxHours ≥ (pairMinutes − 60) / 60. Round up to nearest 0.5h for a clean value.
    const rawNeededHours = (maxPairMinutes - 60) / 60;
    const minMaxHours = maxPairMinutes > 0 && rawNeededHours > settings.maxDriveHours
      ? Math.ceil(rawNeededHours * 2) / 2
      : null;
    const legLabel = maxPairMinutes > 0
      ? `${Math.floor(maxPairMinutes / 60)}h ${maxPairMinutes % 60}m`
      : null;

    warnings.push({
      category: 'date-window',
      severity: 'critical',
      message: `Trip extended to ${days.length} days — your plan allows ${totalCalendarDays}`,
      detail: legLabel
        ? `The longest leg is ~${legLabel} of driving, which exceeds your ${settings.maxDriveHours}h limit and forces an extra overnight. Routing estimates can differ slightly from other navigation apps.`
        : `${transitDays} driving days needed but only ${totalCalendarDays} calendar day${totalCalendarDays > 1 ? 's' : ''} in your date range.`,
      suggestion: minMaxHours
        ? `Increase max drive hours to ${minMaxHours}h to cover the longest leg in one day — or extend your return date by ${extraDaysNeeded} day${extraDaysNeeded > 1 ? 's' : ''}.`
        : buildDateWindowSuggestion(settings, extraDaysNeeded),
    });
  } else if (freeDays === 0) {
    // Same-day round trip (1 calendar day): "0 free days" is the expected and
    // intentional result — the user is doing a day trip. No warning needed.
    if (totalCalendarDays > 1) {
      // Multi-day trip with no free days at destination — worth flagging.
      warnings.push({
        category: 'date-window',
        severity: 'warning',
        message: 'No free days at destination — entire trip is driving',
        detail: `All ${totalCalendarDays} days are transit days. You'll arrive and immediately turn around.`,
        suggestion: buildDateWindowSuggestion(settings, 1),
      });
    }
  } else if (freeDays === 1 && totalCalendarDays > 3) {
    // Only 1 free day for a trip that's more than a long weekend.
    warnings.push({
      category: 'date-window',
      severity: 'info',
      message: `Only 1 free day at destination out of ${totalCalendarDays}`,
      detail: `${transitDays} days driving, 1 day free. ${buildDateWindowSuggestion(settings, 0)}`,
    });
  }

  return warnings;
}

/** Build a concrete suggestion string for date-window warnings. */
function buildDateWindowSuggestion(
  settings: TripSettings,
  extraDaysNeeded: number,
): string {
  const parts: string[] = [];

  // Can they drive more hours per day?
  // Scale the suggested ceiling to driver count — more rotating drivers can
  // safely push further before fatigue becomes a concern.
  const safeMax = settings.numDrivers >= 4 ? 16
    : settings.numDrivers === 3 ? 14
    : settings.numDrivers >= 2 ? 12
    : 8; // solo driver
  if (settings.numDrivers >= 2 && settings.maxDriveHours < safeMax) {
    parts.push(
      `Increase max drive hours (you have ${settings.numDrivers} drivers — up to ${safeMax}h with rotation is manageable)`,
    );
  } else if (settings.numDrivers === 1 && settings.maxDriveHours < 8) {
    parts.push('Increase max drive hours to 8h');
  }

  // Extend the trip?
  if (extraDaysNeeded > 0) {
    parts.push(
      `Extend your return date by ${extraDaysNeeded}+ day${extraDaysNeeded > 1 ? 's' : ''}`,
    );
  }

  // Closer destination?
  parts.push('Choose a closer destination that fits the drive window');

  return parts.join(', or ');
}
