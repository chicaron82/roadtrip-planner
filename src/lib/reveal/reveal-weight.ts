/**
 * reveal-weight — Reveal mode detection and hold-time calculation for Beat 4.
 *
 * Scales the Voilà reveal to match the emotional weight of what MEE actually did.
 * Three modes: fresh (first time), familiar (seen this route before), forked (shared template).
 *
 * Phase 1: fresh + familiar fully implemented. Forked always resolves to 'fresh' until
 * the sharing/template system exists.
 *
 * 💚 My Experience Engine — Reveal Weight System
 */

const SEEN_TRIPS_KEY = 'mee_seen_trips';
const MAX_SEEN_ENTRIES = 100;
const HARD_CAP_MS = 3000;

// ── Types ─────────────────────────────────────────────────────────────────────

export type RevealMode = 'fresh' | 'familiar' | 'forked';

export interface RevealContext {
  mode: RevealMode;
  distanceKm?: number;
  drivingDays?: number;
}

export interface RevealPlan {
  mode: RevealMode;
  minimumHoldMs: number;
  /** Building-phase copy shown during Beat 4 calculation. */
  steps: string[];
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function buildTripHash(originCity: string, destCity: string, isRoundTrip: boolean): string {
  return `${originCity.toLowerCase().trim()}|${destCity.toLowerCase().trim()}|${isRoundTrip}`;
}

function readSeenTrips(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_TRIPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSeenTrips(entries: string[]): void {
  try {
    localStorage.setItem(SEEN_TRIPS_KEY, JSON.stringify(entries));
  } catch {
    // localStorage unavailable (SSR, private mode quota) — silently skip
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Detect whether MEE has seen this origin→destination route before.
 * Returns 'familiar' if found in localStorage, 'fresh' otherwise.
 * Forked mode is reserved for Phase 2 (sharing/template system).
 */
export function detectRevealMode(
  originCity: string,
  destCity: string,
  isRoundTrip: boolean,
): RevealMode {
  const hash = buildTripHash(originCity, destCity, isRoundTrip);
  const seen = readSeenTrips();
  return seen.includes(hash) ? 'familiar' : 'fresh';
}

/**
 * Compute the reveal plan: hold time + building-phase copy steps.
 * Call twice — once at arc start (sketch data, for building copy)
 * and once at onBuildComplete (actual summary data, for hold time).
 */
export function computeRevealPlan(context: RevealContext): RevealPlan {
  const { mode, distanceKm, drivingDays } = context;

  if (mode === 'familiar') {
    return { mode, minimumHoldMs: 400, steps: ['I know this road…'] };
  }

  if (mode === 'forked') {
    return {
      mode,
      minimumHoldMs: 1200,
      steps: ['Taking in your MEE Time…', 'Making it yours…'],
    };
  }

  // Fresh — determine tier. Prefer drivingDays (post-calc, reliable); fall back to distanceKm.
  const tier = resolveTier(drivingDays, distanceKm);

  if (tier === 'A') {
    return { mode, minimumHoldMs: 600, steps: ['Routing your drive…'] };
  }

  if (tier === 'B') {
    return {
      mode,
      minimumHoldMs: 1400,
      steps: ['Mapping the route…', 'Checking the pace…'],
    };
  }

  // Tier C
  const distLabel = distanceKm ? `${Math.round(distanceKm).toLocaleString()} km` : 'the route';
  return {
    mode,
    minimumHoldMs: Math.min(2500, HARD_CAP_MS),
    steps: [
      `Mapping ${distLabel}…`,
      'Checking the pace…',
      'Securing the overnight stops…',
      'Finding the good stuff…',
    ],
  };
}

/**
 * Mark a route as seen so future reveals use the familiar mode.
 * Called after the Voilà reveal completes (not before).
 */
export function markTripSeen(
  originCity: string,
  destCity: string,
  isRoundTrip: boolean,
): void {
  const hash = buildTripHash(originCity, destCity, isRoundTrip);
  const seen = readSeenTrips();
  if (seen.includes(hash)) return;
  const updated = [...seen, hash];
  // Trim oldest entries if over the limit
  const trimmed = updated.length > MAX_SEEN_ENTRIES
    ? updated.slice(updated.length - MAX_SEEN_ENTRIES)
    : updated;
  writeSeenTrips(trimmed);
}

// ── Internal ──────────────────────────────────────────────────────────────────

type FreshTier = 'A' | 'B' | 'C';

function resolveTier(drivingDays?: number, distanceKm?: number): FreshTier {
  // Days-first (most reliable post-calculation)
  if (drivingDays !== undefined) {
    if (drivingDays <= 1) return 'A';
    if (drivingDays <= 3) return 'B';
    return 'C';
  }
  // Distance fallback (pre-calculation haversine estimate)
  if (distanceKm !== undefined) {
    if (distanceKm < 300) return 'A';
    if (distanceKm <= 800) return 'B';
    return 'C';
  }
  return 'A'; // safe default if no data
}
