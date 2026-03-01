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
export function lngToIANA(lng: number): string {
  if (lng < -141) return 'America/Anchorage';
  if (lng < -120) return 'America/Vancouver';
  if (lng < -110) return 'America/Edmonton';
  if (lng < -101.5) return 'America/Regina';   // Saskatchewan (no DST)
  if (lng < -90)  return 'America/Winnipeg';
  if (lng < -75)  return 'America/Toronto';
  if (lng < -60)  return 'America/Halifax';
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

/** Convert an IANA timezone to its rough abbreviation (daylight-saving variant). */
export function ianaToAbbr(iana: string): string | null {
  return IANA_TO_ABBR[iana] ?? null;
}

/**
 * Normalize a TZ abbreviation ("EST", "CDT") or an already-IANA string
 * ("America/Toronto") to a canonical IANA string.
 */
export function normalizeToIANA(tz: string): string {
  return TZ_ABBR_TO_IANA[tz] ?? tz; // if it's already IANA, return as-is
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

  // Step 1: create a UTC instant treating the wall-clock time as if it were UTC.
  const asUTC = Date.UTC(year, month - 1, day, hours, minutes);
  const tempDate = new Date(asUTC);

  // Step 2: find what the target TZ would display for this UTC instant.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: iana,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(tempDate);

  const pobj = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const h = pobj.hour === '24' ? 0 : Number(pobj.hour);
  const displayedUTC = Date.UTC(Number(pobj.year), Number(pobj.month) - 1, Number(pobj.day), h, Number(pobj.minute));

  // Step 3: the UTC offset is the gap between what we assumed and what was displayed.
  // offset > 0  = TZ is behind UTC  (CST: asUTC(9) – displayed(3) = +6h)
  // offset < 0  = TZ is ahead of UTC (unlikely for North American routes)
  const offsetMs = asUTC - displayedUTC;
  return new Date(asUTC + offsetMs);
}

// ── Format a UTC Date in a specific timezone for display ─────────────────────
/**
 * Format a UTC Date as "9:00 AM" in the given IANA timezone.
 * Falls back to browser local time when no timezone is provided (legacy behaviour).
 */
export function formatTimeInZone(date: Date, ianaTimezone?: string): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...(ianaTimezone ? { timeZone: ianaTimezone } : {}),
  });
}
