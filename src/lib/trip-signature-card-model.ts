/**
 * Trip Signature Card — ViewModel builder
 *
 * Pure function that derives all display data for the Signature Trip Summary Card
 * from canonical trip truth. No component logic lives here — this is the kitchen
 * prep work. The renderer just plates what this function produces.
 *
 * Data flow:
 *   TripSummary + TripSettings + FeasibilityResult + SignatureCardInput
 *     → buildSignatureCardModel()
 *       → SignatureCardModel
 *         → <TripSignatureCard model={...} />
 */

import type { TripSummary, TripSettings } from '../types';
import type { FeasibilityResult } from './feasibility';
import type { TripMode } from '../types/core';
import { formatDistance, formatDuration } from './trip-formatters';
import { getCityMoniker } from './city-monikers';

// ==================== TYPES ====================

export type TripTitleMode = 'auto' | 'custom';

/**
 * A short health phrase derived from trip feasibility + pacing.
 * Used as the supporting bottom chip — not a warning banner.
 */
export type TripHealthPhrase =
  | 'Balanced'
  | 'Comfort-first'
  | 'Ambitious but workable'
  | 'Well suited to shared driving'
  | 'Relaxed pace'
  | 'A long push'
  | 'Over budget — worth reviewing';

export interface SignatureMetrics {
  driveTime: string;     // "16h 41m"
  distance: string;      // "1,401 km" or "870 mi"
  nights: number;        // drivingDays - 1
  rooms: number;         // settings.numRooms ?? 1
  mode: string;          // "Plan" | "Adventure" | "Estimate"
  drivers?: number;      // only set if > 1 (worth showing)
}

export interface SignatureCardModel {
  title: string;
  titleMode: TripTitleMode;
  subtitle: string;
  routeLabel: string;         // "Winnipeg → Thunder Bay"
  tripRead: string;           // editorial interpretation sentence
  healthPhrase: TripHealthPhrase;
  metrics: SignatureMetrics;
}

// ==================== INPUT ====================

export interface SignatureCardInput {
  summary: TripSummary;
  settings: TripSettings;
  feasibility: FeasibilityResult;
  /** First location name — shown in route label and auto title */
  originName: string;
  /** Last location name — shown in route label and auto title */
  destinationName: string;
  /** If user set a custom title, pass it here */
  customTitle?: string;
  /** Active trip mode from useTripMode hook */
  tripMode?: TripMode | null;
  /** Formatted date range, e.g. "Sep 12–15" */
  dateRange?: string;
  /**
   * Named overnight anchor point (e.g. "Dryden") for Trip Read flavor.
   * Derived from declared overnight stops if available.
   */
  namedResetPoint?: string;
}

// ==================== BUILDERS ====================

/**
 * Derive the auto-generated trip title.
 * Format: "Your MEE time in {destination}"
 * Kept intentionally simple — authorship belongs to the subtitle.
 */
export function buildAutoTitle(destinationName: string): string {
  const city = destinationName.split(',')[0].trim();
  // forceMoniker: true — journal titles and signature cards are permanent display
  // surfaces. The moniker should be stable once chosen, not re-rolled per render.
  return `Your MEE time in ${getCityMoniker(city, { forceMoniker: true })}`;
}

/**
 * Build the supporting subtitle line beneath the title.
 *
 * - Custom title  → "Your MEE time in {destination} · {dateRange}"
 * - Auto title    → "Built by MEE · {dateRange}"  (shorter, since title already IDs the trip)
 * - No date       → omit the date segment
 */
export function buildSubtitle(
  titleMode: TripTitleMode,
  destinationName: string,
  dateRange?: string,
): string {
  const city = destinationName.split(',')[0].trim();
  const datePart = dateRange ? ` · ${dateRange}` : '';

  if (titleMode === 'custom') {
    return `Your MEE time in ${city}${datePart}`;
  }
  return `Built by MEE${datePart}`;
}

/**
 * Build the editorial Trip Read sentence — the card's interpretive soul.
 *
 * Rules from the spec:
 * - One sentence, concise, calm, human-readable
 * - Interpretive, not metadata
 * - Not marketing fluff, not raw numbers, not jokey
 *
 * Priority order for flavor:
 * 1. Over budget → honest acknowledgment
 * 2. Multi-day with named reset point → highlight the anchor
 * 3. Shared driving fit → note the rotation benefit
 * 4. Drive-time pressure (tight / over) → honest but calm
 * 5. Comfortable pacing → reinforce the feel
 * 6. Default balanced read
 */
export function buildTripRead(input: SignatureCardInput): string {
  const { summary, settings, feasibility, namedResetPoint } = input;
  const days = summary.drivingDays ?? 1;
  const hasSharedDrivers = settings.numDrivers >= 2;
  const status = feasibility.status;

  // Over budget — say so clearly, without alarm
  if (status === 'over' && feasibility.warnings.some(w => w.category === 'budget')) {
    return 'The numbers are stretched — a budget review before you leave is worth it.';
  }

  // Multi-day with a named anchor — lead with the shape of the journey
  if (days >= 2 && namedResetPoint) {
    const city = namedResetPoint.split(',')[0].trim();
    const paceWord = status === 'tight' ? 'a demanding' : 'a deliberate';
    return `A ${days}-day drive with ${paceWord} ${city} reset.`;
  }

  // Shared driving on a longer trip — that's the story
  if (hasSharedDrivers && days >= 2 && status !== 'over') {
    if (status === 'tight') {
      return `A longer push, but manageable with shared drivers.`;
    }
    return `Smooth shared driving with low stop pressure.`;
  }

  // Tight timing — honest and calm
  if (status === 'tight') {
    return `Ambitious pacing — plan your departure time carefully.`;
  }

  // Drive-time pressure from feasibility warnings
  const hasDriveWarning = feasibility.warnings.some(w => w.category === 'drive-time');
  if (hasDriveWarning) {
    return `A long day behind the wheel — build in recovery time.`;
  }

  // Single day, clean run
  if (days <= 1) {
    return `A clean single-day run — straightforward and direct.`;
  }

  // Multi-day, comfortable pacing
  if (status === 'on-track') {
    return `Comfort-first pacing with a clean overnight rhythm.`;
  }

  // Default balanced read
  return `A balanced ${days}-day drive — well within reach.`;
}

/**
 * Derive the short health phrase shown at the bottom of the card.
 * Complements the Trip Read without duplicating it.
 */
export function buildHealthPhrase(input: SignatureCardInput): TripHealthPhrase {
  const { settings, feasibility, summary } = input;
  const status = feasibility.status;
  const hasSharedDrivers = settings.numDrivers >= 2;
  const days = summary.drivingDays ?? 1;

  if (status === 'over' && feasibility.warnings.some(w => w.category === 'budget')) {
    return 'Over budget — worth reviewing';
  }

  if (status === 'tight') {
    return 'Ambitious but workable';
  }

  if (feasibility.warnings.some(w => w.category === 'drive-time')) {
    return 'A long push';
  }

  if (hasSharedDrivers && days >= 2) {
    return 'Well suited to shared driving';
  }

  if (days <= 1) {
    return 'Balanced';
  }

  if (status === 'on-track') {
    const { longestDriveDay, maxDriveLimit } = feasibility.summary;
    const utilizationPct = longestDriveDay / maxDriveLimit;
    if (utilizationPct < 0.6) return 'Relaxed pace';
    if (utilizationPct < 0.85) return 'Balanced';
    return 'Comfort-first';
  }

  return 'Balanced';
}

/**
 * Map TripMode to a display label.
 */
function formatTripMode(tripMode?: TripMode | null): string {
  switch (tripMode) {
    case 'adventure': return 'Adventure';
    case 'estimate':  return 'Estimate';
    case 'plan':
    default:          return 'Plan';
  }
}

// ==================== MAIN BUILDER ====================

/**
 * Build the complete SignatureCardModel from canonical trip truth.
 *
 * This is the single source of display truth for the Signature Card —
 * results reveal, viewer header, and print cover all derive from this.
 */
export function buildSignatureCardModel(input: SignatureCardInput): SignatureCardModel {
  const { summary, settings, customTitle, destinationName, dateRange, tripMode } = input;

  const titleMode: TripTitleMode = customTitle ? 'custom' : 'auto';
  const title = customTitle ?? buildAutoTitle(destinationName);
  const subtitle = buildSubtitle(titleMode, destinationName, dateRange);

  const originCity = input.originName.split(',')[0].trim();
  const destCity = destinationName.split(',')[0].trim();
  const routeLabel = `${originCity} → ${destCity}`;

  const nights = Math.max(0, (summary.drivingDays ?? 1) - 1);
  const rooms = settings.numRooms ?? 1;

  const metrics: SignatureMetrics = {
    driveTime: formatDuration(summary.totalDurationMinutes),
    distance: formatDistance(summary.totalDistanceKm, settings.units),
    nights,
    rooms,
    mode: formatTripMode(tripMode),
    ...(settings.numDrivers > 1 && { drivers: settings.numDrivers }),
  };

  return {
    title,
    titleMode,
    subtitle,
    routeLabel,
    tripRead: buildTripRead(input),
    healthPhrase: buildHealthPhrase(input),
    metrics,
  };
}
