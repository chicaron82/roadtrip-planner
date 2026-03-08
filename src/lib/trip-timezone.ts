/**
 * trip-timezone.ts — Timezone utilities for route time calculations
 *
 * All time math in the trip planner uses plain Date objects (UTC internally).
 * The bugs this fixes:
 *   1. `new Date('YYYY-MM-DDThh:mm')` is parsed in BROWSER local time — wrong
 *      when the user's browser timezone ≠ the departure city's timezone.
 *   2. `date.getHours()` / `toLocaleTimeString()` (no TZ arg) renders in
 *      BROWSER local time — wrong when the destination is in a different zone.
 *
 * These two bugs cancel out for single-timezone trips, but diverge when the
 * route crosses a timezone boundary (e.g. Winnipeg CST → Thunder Bay EST).
 *
 * 💚 My Experience Engine
 */

// ── Longitude → IANA timezone (Canadian/US routes) ───────────────────────────
// These longitude bands are approximate but accurate enough for road trips.
// Note: Saskatchewan stays on MST year-round (no DST); we can't distinguish
// it from Alberta purely by longitude, so we use America/Regina for lng < -101.5
// (rough SK boundary) and America/Edmonton west of that.
//
// Eastern/Atlantic boundary at -67.8° (≈ QC/NB border):
//   All of Quebec (incl. Montreal -73.57°, QC City -71.2°) → America/Toronto
//   New Brunswick (Fredericton -66.6°), Nova Scotia, PEI → America/Halifax
// The old -75° boundary incorrectly gave Montreal → America/Halifax.
export function lngToIANA(lng: number): string {
  if (lng < -141) return 'America/Anchorage';
  if (lng < -120) return 'America/Vancouver';
  if (lng < -110) return 'America/Edmonton';
  if (lng < -101.5) return 'America/Regina';   // Saskatchewan (no DST)
  if (lng < -90)  return 'America/Winnipeg';
  if (lng < -67.8) return 'America/Toronto';   // ON + QC (Eastern Time)
  if (lng < -60)  return 'America/Halifax';    // NB, NS, PEI (Atlantic Time)
  return 'America/St_Johns';
}

// ── TZ abbreviation → IANA string ────────────────────────────────────────────
// Weather API returns abbreviations like "CST", "EST". We map them to IANA.
const TZ_ABBR_TO_IANA: Record<string, string> = {
  PST: 'America/Vancouver',  PDT: 'America/Vancouver',
  MST: 'America/Edmonton',   MDT: 'America/Edmonton',
  CST: 'America/Winnipeg',   CDT: 'America/Winnipeg',
  EST: 'America/Toronto',    EDT: 'America/Toronto',
  AST: 'America/Halifax',    ADT: 'America/Halifax',
  NST: 'America/St_Johns',   NDT: 'America/St_Johns',
};

// ── IANA → TZ abbreviation (daylight-saving flavour) ─────────────────────────
// Used by transit sub-segment timezone derivation: lngToIANA returns an IANA
// string, but the stop simulator's state tracks abbreviations (CDT, MDT, etc.).
const IANA_TO_ABBR: Record<string, string> = {
  'America/Vancouver': 'PDT', 'America/Edmonton': 'MDT',
  'America/Regina': 'CST', 'America/Winnipeg': 'CDT',
  'America/Toronto': 'EDT', 'America/Halifax': 'ADT',
  'America/St_Johns': 'NDT', 'America/Anchorage': 'AKDT',
};

const OFFSET_TZ_RE = /^(?:UTC|GMT)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?$/i;

/** Convert an IANA timezone to its rough abbreviation (daylight-saving variant). */
export function ianaToAbbr(iana: string): string | null {
  return IANA_TO_ABBR[iana] ?? null;
}

function parseUTCOffsetMinutes(tz: string): number | null {
  const match = tz.trim().match(OFFSET_TZ_RE);
  if (!match) return null;

  const [, sign, hoursText, minutesText] = match;
  const hours = Number(hoursText);
  const minutes = minutesText ? Number(minutesText) : 0;

  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) {
    return null;
  }

  const totalMinutes = hours * 60 + minutes;
  return sign === '+' ? totalMinutes : -totalMinutes;
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function getOffsetAdjustedDate(date: Date, offsetMinutes: number): Date {
  return new Date(date.getTime() + offsetMinutes * 60 * 1000);
}

function formatWithOffsetTimezone(
  date: Date,
  offsetMinutes: number,
  options: Intl.DateTimeFormatOptions,
  locale: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: 'UTC',
  }).format(getOffsetAdjustedDate(date, offsetMinutes));
}

/**
 * Normalize a TZ abbreviation ("EST", "CDT") or an already-IANA string
 * ("America/Toronto") to a canonical display timezone token.
 */
export function normalizeToIANA(tz: string): string {
  const normalized = tz.trim();
  const upper = normalized.toUpperCase();

  if (TZ_ABBR_TO_IANA[upper]) return TZ_ABBR_TO_IANA[upper];
  if (parseUTCOffsetMinutes(normalized) !== null) return upper.replace(/\s+/g, '');
  return normalized;
}

// ── Parse local datetime in a specific IANA timezone to UTC Date ──────────────
/**
 * Convert a local date/time string to a UTC Date object, treating the input
 * as local time in the given IANA timezone (not browser local time).
 *
 * Algorithm:
 *   1. Treat the input as UTC to get a reference Date.
 *   2. Ask Intl.DateTimeFormat what that UTC time looks like in target TZ.
 *   3. The difference = the UTC offset. Apply it to get the true UTC instant.
 *
 * Example: parseLocalDateInTZ('2026-02-28', '09:00', 'America/Winnipeg')
 *   → Date at 15:00 UTC (9 AM CST = UTC−6, confirmed)
 */
export function parseLocalDateInTZ(dateStr: string, timeStr: string, iana: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  const fmtOpts: Intl.DateTimeFormatOptions = {
    timeZone: iana,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  };

  // Step 1: create a UTC instant treating the wall-clock time as if it were UTC.
  const asUTC = Date.UTC(year, month - 1, day, hours, minutes);

  // Step 2: find what the target TZ would display for this UTC instant.
  const parts = new Intl.DateTimeFormat('en-CA', fmtOpts).formatToParts(new Date(asUTC));
  const pobj = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const h = pobj.hour === '24' ? 0 : Number(pobj.hour);
  const displayedUTC = Date.UTC(Number(pobj.year), Number(pobj.month) - 1, Number(pobj.day), h, Number(pobj.minute));

  // Step 3: the UTC offset is the gap between what we assumed and what was displayed.
  // offset > 0  = TZ is behind UTC  (CST: asUTC(9) – displayed(3) = +6h)
  // offset < 0  = TZ is ahead of UTC (unlikely for North American routes)
  const offsetMs = asUTC - displayedUTC;
  const candidate = new Date(asUTC + offsetMs);

  // Step 4: DST-transition-day correction.
  // If departure is after the DST flip (e.g. 6 AM on spring-forward Sunday), Step 1
  // samples the pre-flip offset (midnight CST) and returns an hour late.
  // Verify by checking what `candidate` actually shows — if it's off, nudge by the diff.
  const parts2 = new Intl.DateTimeFormat('en-CA', fmtOpts).formatToParts(candidate);
  const p2 = Object.fromEntries(parts2.map(p => [p.type, p.value]));
  const h2 = p2.hour === '24' ? 0 : Number(p2.hour);
  const displayedMinutes2 = h2 * 60 + Number(p2.minute);
  const wantedMinutes = hours * 60 + minutes;
  const dstDiffMs = (wantedMinutes - displayedMinutes2) * 60 * 1000;
  // Only adjust for clock-shift differences of exactly ±1 h (DST only; ignore multi-hour anomalies).
  if (Math.abs(dstDiffMs) === 3_600_000) {
    return new Date(candidate.getTime() + dstDiffMs);
  }
  return candidate;
}

/**
 * Build the trip's departure instant using the origin longitude when available.
 * Falls back to legacy browser-local parsing only when no origin coordinates exist.
 */
export function getTripStartTime(dateStr: string, timeStr: string, originLng?: number): Date {
  return originLng !== undefined
    ? parseLocalDateInTZ(dateStr, timeStr, lngToIANA(originLng))
    : new Date(`${dateStr}T${timeStr}`);
}

// ── Format a UTC Date in a specific timezone for display ─────────────────────
/**
 * Format a UTC Date as "9:00 AM" in the given IANA timezone.
 * Falls back to browser local time when no timezone is provided (legacy behaviour).
 */
export function formatTimeInZone(date: Date, ianaTimezone?: string): string {
  const normalized = ianaTimezone?.trim();
  const offsetMinutes = normalized ? parseUTCOffsetMinutes(normalized) : null;

  if (offsetMinutes !== null) {
    return formatWithOffsetTimezone(date, offsetMinutes, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }, 'en-US');
  }

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...(normalized && isValidTimeZone(normalized) ? { timeZone: normalized } : {}),
  });
}

/**
 * Format a UTC Date as "YYYY-MM-DD" in the given IANA timezone.
 * Used for overnight advancement — ensures we compute dates in the destination
 * timezone rather than the browser's local timezone.
 */
export function formatDateInZone(date: Date, ianaTimezone: string): string {
  const normalized = ianaTimezone.trim();
  const offsetMinutes = parseUTCOffsetMinutes(normalized);

  if (offsetMinutes !== null) {
    const shifted = getOffsetAdjustedDate(date, offsetMinutes);
    const year = shifted.getUTCFullYear();
    const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const day = String(shifted.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    ...(isValidTimeZone(normalized) ? { timeZone: normalized } : { timeZone: 'UTC' }),
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const pobj = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${pobj.year}-${pobj.month}-${pobj.day}`;
}

/**
 * Format a UTC Date as a short human-readable label like "Sat, Mar 7" in the
 * given IANA timezone. Falls back to browser-local formatting when omitted.
 */
export function formatDisplayDateInZone(date: Date, ianaTimezone?: string): string {
  const normalized = ianaTimezone?.trim();
  const offsetMinutes = normalized ? parseUTCOffsetMinutes(normalized) : null;

  if (offsetMinutes !== null) {
    return formatWithOffsetTimezone(date, offsetMinutes, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }, 'en-US');
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(normalized && isValidTimeZone(normalized) ? { timeZone: normalized } : {}),
  });
}
