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
    // More transit days than calendar days — physically impossible.
    const extraDaysNeeded = Math.abs(freeDays);
    warnings.push({
      category: 'date-window',
      severity: 'critical',
      message: `Trip doesn't fit — need ${extraDaysNeeded} more day${extraDaysNeeded > 1 ? 's' : ''}`,
      detail: `${transitDays} driving days needed but only ${totalCalendarDays} calendar day${totalCalendarDays > 1 ? 's' : ''} between departure and return.`,
      suggestion: buildDateWindowSuggestion(settings, extraDaysNeeded),
    });
  } else if (freeDays === 0) {
    // Fits, but zero time at destination — every day is spent driving.
    warnings.push({
      category: 'date-window',
      severity: 'warning',
      message: 'No free days at destination — entire trip is driving',
      detail: `All ${totalCalendarDays} day${totalCalendarDays > 1 ? 's' : ''} are transit days. You\'ll arrive and immediately turn around.`,
      suggestion: buildDateWindowSuggestion(settings, 1),
    });
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
  if (settings.numDrivers >= 2 && settings.maxDriveHours < 12) {
    parts.push(
      `Increase max drive hours (you have ${settings.numDrivers} drivers — up to 12h is safe)`,
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
