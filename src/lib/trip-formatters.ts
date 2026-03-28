/**
 * trip-formatters.ts — Pure display formatting utilities
 *
 * Stateless functions for converting raw numbers / ISO strings into
 * human-readable distance, currency, duration, and time strings.
 * No business logic lives here — only presentation transforms.
 */

import { KM_TO_MILES } from './constants';
import { formatTimeInZone, normalizeToIANA } from './trip-timezone';

export function formatDistance(km: number, units: 'metric' | 'imperial', precision: number = 1): string {
  if (units === 'imperial') {
    return `${(km * KM_TO_MILES).toFixed(precision)} mi`;
  }
  return `${km.toFixed(precision)} km`;
}

export function formatCurrency(amount: number, currency: 'CAD' | 'USD'): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

/** Simple $-prefix format for print views that don't need locale awareness. */
export function formatCurrencySimple(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Format time for display with optional timezone abbreviation.
 * Uses Intl-based formatting so the time is correct in the route's timezone,
 * not the browser's timezone.
 */
export function formatTime(isoString: string, timezoneAbbr?: string): string {
  const date = new Date(isoString);
  const iana = timezoneAbbr ? normalizeToIANA(timezoneAbbr) : undefined;
  const timeStr = formatTimeInZone(date, iana);
  return timezoneAbbr ? `${timeStr} ${timezoneAbbr}` : timeStr;
}

/**
 * Get day number for multi-day trips (1-indexed).
 */
export function getDayNumber(departureDate: string, currentDate: string): number {
  const start = new Date(departureDate);
  const current = new Date(currentDate);
  const diffDays = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

const MONTH_ABBRS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format an inclusive date range into a compact human-readable string.
 * Expects ISO date strings (YYYY-MM-DD). Collapses month/year when shared.
 *
 * Examples:
 *   Mar 5–8, 2026
 *   Mar 28 – Apr 3, 2026
 *   Dec 30, 2025 – Jan 2, 2026
 */
export function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (s.getFullYear() === e.getFullYear()) {
    if (s.getMonth() === e.getMonth()) {
      return `${MONTH_ABBRS[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
    }
    return `${MONTH_ABBRS[s.getMonth()]} ${s.getDate()} – ${MONTH_ABBRS[e.getMonth()]} ${e.getDate()}, ${s.getFullYear()}`;
  }
  return `${MONTH_ABBRS[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()} – ${MONTH_ABBRS[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
}
