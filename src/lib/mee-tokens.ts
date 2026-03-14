/**
 * MEE Tokens — Single source of truth for labels, voice copy, and source-tier metadata.
 *
 * Three export groups:
 *   1. SOURCE_TIER   — Declared / Inferred / Discovered / Verified chip/label constants
 *   2. Voice builders — Typed functions that produce interpretive copy
 *   3. Vocabulary     — String union types that enforce the voice spec at compile time
 *
 * No component logic lives here. Pure data + pure functions.
 * All surfaces (viewer, print, results, map, Step 1) derive copy from this module.
 *
 * 💚 "MEE sounds like a journey editor, not a trip calculator." — Editorial Voice Spec
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. SOURCE TIER METADATA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The four tiers of trip truth, in descending authority order.
 *
 * declared   — the user explicitly authored this
 * verified   — grounded in real historical trip data (hub cache, challenge pars)
 * inferred   — engine-estimated to make the trip viable or coherent
 * discovered — optional enrichment, not canonical until accepted
 */
export type SourceTier = 'declared' | 'verified' | 'inferred' | 'discovered';

/**
 * Authority ranking: higher is more authoritative.
 * Use for sort/comparison logic when tiers need ordering.
 */
export const SOURCE_TIER_RANK: Record<SourceTier, number> = {
  declared:   4,
  verified:   3,
  inferred:   2,
  discovered: 1,
};

/**
 * Chip/tag labels — the exact strings that appear in the UI.
 * Use the shortest clear phrasing that fits the surface context.
 */
export const SOURCE_TIER_LABELS = {
  // Primary short labels (chip / tag context)
  declared:           'Declared',
  verified:           'From real experience',
  inferred:           'Estimated by MEE',
  discovered:         'Suggested by MEE',

  // Extended labels (helper copy / row context)
  declaredStop:       'Declared stop',
  declaredOvernight:  'Declared overnight',
  customTitle:        'Custom title',
  autoTitle:          'Auto title',
  engineEstimated:    'Engine-estimated',
  engineSupport:      'Engine support',
  meeEstimatedStop:   'MEE-estimated stop',
  meeWillInfer:       'MEE will infer',
  nearbyDiscovery:    'Nearby discovery',
  worthALook:         'Worth a look',
  optionalStop:       'Optional stop',
  suggestedByMee:     'Suggested by MEE',
} as const;

export type SourceTierLabelKey = keyof typeof SOURCE_TIER_LABELS;

/**
 * Visual weight hint for each tier.
 * Components use this to select styling (filled vs outlined vs ghost chip).
 * Not a Tailwind class — intentionally generic so the design system can evolve.
 */
export type ChipWeight = 'solid' | 'outlined' | 'ghost';

export const SOURCE_TIER_CHIP_WEIGHT: Record<SourceTier, ChipWeight> = {
  declared:   'solid',
  verified:   'solid',
  inferred:   'outlined',
  discovered: 'ghost',
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. VOCABULARY TYPES (enforce voice spec at compile time)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Approved health/status phrases for trip summary surfaces.
 * These map to FeasibilityStatus + driver count context.
 */
export type TripHealthPhrase =
  | 'Balanced'
  | 'Comfort-first'
  | 'Ambitious but workable'
  | 'Shared-driver friendly'
  | 'Heavy driving day'
  | 'A long push'
  | 'Light stop pressure'
  | 'Low stop pressure'
  | 'Strong shared-driver fit'
  | 'Well suited to shared driving';

/**
 * Approved road-language terms.
 * Using this type in builder params prevents system-language from leaking in.
 */
export type RoadLanguageTerm =
  | 'journey'
  | 'route'
  | 'road'
  | 'drive'
  | 'leg'
  | 'reset'
  | 'anchor'
  | 'rhythm'
  | 'pacing'
  | 'push'
  | 'stretch'
  | 'run'
  | 'overnight'
  | 'stop';

// ─────────────────────────────────────────────────────────────────────────────
// 3. VOICE BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

// ── 3a. Trip Health Phrase ────────────────────────────────────────────────────

import type { FeasibilityStatus } from './feasibility/types';

export interface TripHealthContext {
  feasibilityStatus: FeasibilityStatus;
  numDrivers: number;
  longestDriveHours: number;   // longest single driving day in hours
  totalDays: number;
}

/**
 * Returns a single status phrase for the trip summary card / health block.
 *
 * Examples:
 *   on-track + 2 drivers + ≤8h → "Shared-driver friendly"
 *   on-track + 1 driver + ≤8h → "Balanced"
 *   tight + any               → "Ambitious but workable"
 *   over                      → "A long push"
 */
export function buildHealthPhrase(ctx: TripHealthContext): TripHealthPhrase {
  const { feasibilityStatus, numDrivers, longestDriveHours } = ctx;

  if (feasibilityStatus === 'over') {
    return 'A long push';
  }

  if (feasibilityStatus === 'tight') {
    return 'Ambitious but workable';
  }

  // on-track
  if (numDrivers >= 2) {
    return longestDriveHours > 10 ? 'Strong shared-driver fit' : 'Shared-driver friendly';
  }

  if (longestDriveHours <= 6) {
    return 'Comfort-first';
  }

  if (longestDriveHours <= 8) {
    return 'Balanced';
  }

  return 'Heavy driving day';
}

// ── 3b. Trip Read Sentence ────────────────────────────────────────────────────

export interface TripReadContext {
  days: number;
  destination: string;
  feasibilityStatus: FeasibilityStatus;
  numDrivers: number;
  longestDriveHours: number;
  hasNamedResetPoint?: string;   // e.g. "Dryden" — if a declared overnight has a named city
  isRoundTrip?: boolean;
}

/**
 * Builds the interpretive trip read sentence shown on the summary card and results reveal.
 *
 * Interprets trip meaning — does not merely echo numbers.
 *
 * Examples:
 *   "A balanced 3-day drive to Thunder Bay."
 *   "A balanced 3-day loop with a deliberate Dryden reset."
 *   "A long push to Vancouver — best shared across two drivers."
 *   "Comfort-first pacing on a 2-day run to Saskatoon."
 */
export function buildTripRead(ctx: TripReadContext): string {
  const {
    days,
    destination,
    feasibilityStatus,
    numDrivers,
    longestDriveHours,
    hasNamedResetPoint,
    isRoundTrip,
  } = ctx;

  const dayStr = `${days}-day`;
  const routeLabel = isRoundTrip ? 'loop' : 'drive';

  // Over-budget / over-limit path — honest, composed, not alarming
  if (feasibilityStatus === 'over') {
    const driverNote = numDrivers >= 2
      ? ' — best shared across two drivers'
      : ' — consider an overnight reset';
    return `A long push to ${destination}${driverNote}.`;
  }

  // Tight path — acknowledge the ambition without catastrophising
  if (feasibilityStatus === 'tight') {
    if (numDrivers >= 2) {
      return `An ambitious ${dayStr} ${routeLabel} to ${destination}, well suited to shared driving.`;
    }
    return `An ambitious ${dayStr} ${routeLabel} to ${destination}.`;
  }

  // On-track paths — interpret the feel of the trip
  if (hasNamedResetPoint && isRoundTrip) {
    return `A balanced ${dayStr} loop with a deliberate ${hasNamedResetPoint} reset.`;
  }

  if (hasNamedResetPoint) {
    return `A balanced ${dayStr} ${routeLabel} to ${destination} with a deliberate ${hasNamedResetPoint} reset.`;
  }

  if (longestDriveHours <= 6) {
    return `Comfort-first pacing on a ${dayStr} run to ${destination}.`;
  }

  if (numDrivers >= 2) {
    return `A smooth ${dayStr} ${routeLabel} to ${destination} — well suited to shared driving.`;
  }

  return `A balanced ${dayStr} ${routeLabel} to ${destination}.`;
}

// ── 3c. Trip Title ────────────────────────────────────────────────────────────

export type TripTitleMode = 'auto' | 'custom';

export interface TripTitleContext {
  destination: string;
  departureDate?: string;   // e.g. "Sep 12"
  isRoundTrip?: boolean;
}

/**
 * Generates the auto title shown when user has not set a custom name.
 * Locked once user makes a custom edit (mode → 'custom').
 *
 * Examples:
 *   "Your MEE time in Thunder Bay"
 *   "Your MEE time in Thunder Bay · Sep 12"
 */
export function buildAutoTitle(ctx: TripTitleContext): string {
  const { destination, departureDate } = ctx;
  const base = `Your MEE time in ${destination}`;
  return departureDate ? `${base} · ${departureDate}` : base;
}

// ── 3d. Guidance Lines (Step 1 / input surfaces) ─────────────────────────────

/**
 * Guidance lines for Step 1 — make authorship visible without over-explaining.
 */
export const GUIDANCE = {
  titlePrompt:        'Give this journey a name, or let MEE title it for you.',
  stopRolePrompt:     'Declare key stops, or let the engine infer the rhythm.',
  stopsIntent:        'Tell MEE what matters along the way.',
  modeAuto:           'Let MEE shape the route',
  modeAutoSub:        'Guide the journey, let MEE handle the rhythm',
  modeManual:         'Shape the trip directly',
  modeManualSub:      'Set the route up your way',
  inferredFallback:   'MEE will infer',
} as const;

export type GuidanceKey = keyof typeof GUIDANCE;

// ── 3e. Health / Warning Lines ────────────────────────────────────────────────

export interface WarningLineContext {
  numDrivers: number;
  longestDriveHours: number;
  hasOvernightAnchor: boolean;
}

/**
 * Returns a composed warning or reassurance line for health/feasibility blocks.
 * Honest but never alarmist. Calm but never vague.
 *
 * Examples:
 *   "This route asks a lot from a solo driver."
 *   "More comfortable with one additional reset point."
 *   "A long push best split with an overnight anchor."
 *   "Well suited to shared driving."
 */
export function buildWarningLine(ctx: WarningLineContext): string {
  const { numDrivers, longestDriveHours, hasOvernightAnchor } = ctx;

  if (numDrivers < 2 && longestDriveHours > 12) {
    return hasOvernightAnchor
      ? 'A long push — the overnight anchor helps.'
      : 'A long push best split with an overnight anchor.';
  }

  // >10h without an overnight anchor — recommend a reset regardless of driver count
  if (!hasOvernightAnchor && longestDriveHours > 10) {
    return 'More comfortable with one additional reset point.';
  }

  if (numDrivers < 2 && longestDriveHours > 8) {
    return 'This route asks a lot from a solo driver.';
  }

  if (numDrivers >= 2) {
    return 'Well suited to shared driving.';
  }

  return 'A smoother run with a real rest point.';
}

// ── 3f. Discovery / Enrichment Lines ─────────────────────────────────────────

export interface DiscoveryLineContext {
  name: string;
  detourMinutes?: number;
}

/**
 * Short discovery card copy for POI / enrichment surfaces.
 * Inviting but clearly optional — never sounds like a requirement.
 *
 * Examples:
 *   "Worth a look — about 15 min off the route."
 *   "Worth a look."
 *   "A good detour if you want more from the day."
 */
export function buildDiscoveryLine(ctx: DiscoveryLineContext): string {
  const { detourMinutes } = ctx;

  if (detourMinutes && detourMinutes <= 20) {
    return `Worth a look — about ${detourMinutes} min off the route.`;
  }

  if (detourMinutes && detourMinutes <= 45) {
    return 'A good detour if you want more from the day.';
  }

  return 'Worth a look.';
}

// ── 3g. Verified Source Line (hub cache / challenge pars) ─────────────────────

/**
 * Short label used when data comes from real historical trip evidence.
 * Distinct from "Estimated by MEE" — this is grounded in lived experience.
 *
 * Examples:
 *   "From a real trip"
 *   "Verified from the Canadian EuroTrip (2025)"
 */
export function buildVerifiedLine(tripName?: string): string {
  if (tripName) return `Verified from the ${tripName}`;
  return 'From a real trip';
}
