import type { RouteSegment, SegmentWarning, TripSettings } from '../types';
import { isLikelyInUS } from './border-avoidance';
import { lngToIANA, ianaToAbbr } from './trip-timezone';

/**
 * Analyzes route segments and adds intelligent warnings.
 * Each segment is compared against the previous one for timezone detection.
 */
export function analyzeSegments(
  segments: RouteSegment[]
): RouteSegment[] {
  return segments.map((segment, idx) => {
    const warnings: SegmentWarning[] = [];
    const durationHours = segment.durationMinutes / 60;
    const prevSegment = idx > 0 ? segments[idx - 1] : undefined;

    // Long drive warnings
    if (durationHours > 6) {
      warnings.push({
        type: 'long_drive',
        severity: 'critical',
        message: `⚠️ ${durationHours.toFixed(1)}h drive - Consider breaking this leg into multiple days`,
        icon: '🛑',
      });
    } else if (durationHours > 4) {
      warnings.push({
        type: 'long_drive',
        severity: 'warning',
        message: `⏰ ${durationHours.toFixed(1)}h drive - Take breaks every 2 hours`,
        icon: '⚠️',
      });
    }

    // Suggest breaks for segments > 3 hours
    const suggestedBreak = durationHours > 3;

    // Detect border crossings using GPS coordinates — more reliable than
    // string-matching location names which often omit province/state info.
    const fromInUS = isLikelyInUS(segment.from.lat, segment.from.lng);
    const toInUS = isLikelyInUS(segment.to.lat, segment.to.lng);
    const crossesBorder = fromInUS !== toInUS;
    if (crossesBorder) {
      warnings.push({
        type: 'border_crossing',
        severity: 'info',
        message: '🛂 International border crossing - Bring passport & check customs requirements',
        icon: '🛂',
      });
    }

    // Detect timezone crossings — prefer real weather API abbreviations,
    // fall back to longitude heuristic only when weather data is absent.
    const timezoneCrossing = detectTimezoneCrossing(segment, prevSegment);

    if (timezoneCrossing.crosses) {
      warnings.push({
        type: 'timezone',
        severity: 'info',
        message: `🕐 Timezone change: ${timezoneCrossing.message}`,
        icon: '🕐',
      });
    }

    return {
      ...segment,
      warnings,
      suggestedBreak,
      timezone: timezoneCrossing.timezone,
      timezoneCrossing: timezoneCrossing.crosses,
    };
  });
}

/**
 * Detects timezone crossings.
 *
 * Strategy (matches split-by-days.ts for consistency):
 *   1. If both segments have weather.timezoneAbbr, compare them directly.
 *      This correctly handles Saskatchewan (always CST, no change) and other
 *      cases where longitude alone is misleading.
 *   2. Fall back to a longitude heuristic (~15° ≈ 1h) when weather data
 *      is absent — e.g., for routes without weather API coverage.
 */
function detectTimezoneCrossing(
  segment: RouteSegment,
  prevSegment?: RouteSegment,
): {
  crosses: boolean;
  timezone?: string;
  message?: string;
} {
  // ── Strategy 1: real weather timezone abbreviations ──────────────────────
  const toAbbr = segment.weather?.timezoneAbbr;
  const fromAbbr = prevSegment?.weather?.timezoneAbbr;

  if (toAbbr && fromAbbr) {
    if (toAbbr === fromAbbr) return { crosses: false };

    // Derive a human-readable timezone name from the abbreviation
    const tzName = getTimezoneName(toAbbr);
    return {
      crosses: true,
      timezone: toAbbr,
      message: `Entering ${tzName} (${toAbbr})`,
    };
  }

  // ── Strategy 2: longitude boundaries (no weather data available) ─────────
  const { from, to } = segment;
  const fromIANA = prevSegment ? lngToIANA(prevSegment.to.lng) : lngToIANA(from.lng);
  const toIANA = lngToIANA(to.lng);

  if (fromIANA !== toIANA) {
    // Attempt to convert IANA strings back to familiar daylight/standard abbreviations
    const toAbbrFallback = ianaToAbbr(toIANA) || toIANA;
    const tzName = getTimezoneName(toAbbrFallback) !== toAbbrFallback
      ? getTimezoneName(toAbbrFallback)
      : toIANA.split('/').pop()?.replace('_', ' ') || toIANA;

    return {
      crosses: true,
      timezone: toAbbrFallback,
      message: `Entering ${tzName} (${toAbbrFallback})`,
    };
  }

  return { crosses: false };
}

/**
 * Map a timezone abbreviation to its display name.
 * Mirrors the mapping in split-by-days.ts.
 */
function getTimezoneName(abbr: string): string {
  const names: Record<string, string> = {
    PST: 'Pacific Standard Time', PDT: 'Pacific Daylight Time',
    MST: 'Mountain Standard Time', MDT: 'Mountain Daylight Time',
    CST: 'Central Standard Time',  CDT: 'Central Daylight Time',
    EST: 'Eastern Standard Time',  EDT: 'Eastern Daylight Time',
    AKST: 'Alaska Standard Time',  AKDT: 'Alaska Daylight Time',
    HST: 'Hawaii Standard Time',
  };
  return names[abbr] ?? abbr;
}


/**
 * Generates smart pacing suggestions based on trip duration.
 * @param maxDayMinutes - Longest single driving day in minutes (not total trip)
 * @param settings - Trip settings
 * @param isAlreadySplit - True when the trip is already planned as multi-day
 */
export function generatePacingSuggestions(
  maxDayMinutes: number,
  settings: TripSettings,
  isAlreadySplit = false
): string[] {
  const suggestions: string[] = [];
  const dayHours = maxDayMinutes / 60;
  const daysNeeded = Math.ceil(dayHours / settings.maxDriveHours);

  // Only suggest splitting if not already planned as a multi-day trip
  if (daysNeeded > 1 && !isAlreadySplit) {
    suggestions.push(`💡 This is a ${dayHours.toFixed(1)}-hour drive. Consider splitting into ${daysNeeded} days.`);
  }

  if (dayHours > 8 && settings.departureTime) {
    const [hours] = settings.departureTime.split(':').map(Number);
    if (hours > 12) {
      suggestions.push(`🌅 Starting at ${settings.departureTime} means night driving. Consider departing at 6-8 AM instead.`);
    }
  }

  if (settings.numDrivers > 1) {
    const swapInterval = Math.round(dayHours / settings.numDrivers);
    suggestions.push(`👥 With ${settings.numDrivers} drivers, swap every ${swapInterval} hours to stay fresh.`);
  }

  const breaksNeeded = Math.floor(dayHours / 2);
  if (breaksNeeded > 0) {
    suggestions.push(`☕ Plan for ${breaksNeeded} break${breaksNeeded > 1 ? 's' : ''} (every 2-3 hours) to stretch and refuel.`);
  }

  return suggestions;
}

