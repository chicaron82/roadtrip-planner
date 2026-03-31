/**
 * poi-scoring.ts — Individual scoring algorithms for POI ranking.
 *
 * Each function calculates a single dimension of POI quality
 * (category match, detour cost, timing fit, weather, fatigue, hunger,
 * late-arrival risk). Used by rankPOI in poi-ranking.ts.
 *
 * 💚 My Experience Engine
 */

import type { POISuggestion, RouteSegment, TripPreference, POISuggestionCategory } from '../types';
import type { JourneyContextSegment } from './trip-orchestrator/journey-context';
import { formatDriveTime } from './driver-rotation';
import { normalizeToIANA } from './trip-timezone';

const OUTDOOR_CATEGORIES: POISuggestionCategory[] = [
  'viewpoint', 'park', 'waterfall', 'attraction', 'landmark',
];
const INDOOR_CATEGORIES: POISuggestionCategory[] = [
  'museum', 'restaurant', 'cafe', 'shopping', 'entertainment', 'hotel',
];

// Corridor distance thresholds
const CORRIDOR_THRESHOLDS = {
  quick: 5,      // Within 5km - minimal detour
  moderate: 10,  // Within 10km - acceptable detour
  farther: 20,   // Within 20km - worth it if high value
};

// Maximum acceptable detour (minutes)
const MAX_DETOUR_MINUTES = 30;

/** Return fractional hour (0–23.99) in a specific IANA timezone, or fall back to local. */
export function getLocalTod(date: Date, tz?: string): number {
  if (tz) {
    const iana = normalizeToIANA(tz);
    const parts = new Intl.DateTimeFormat('en', {
      hour: 'numeric', minute: 'numeric', hourCycle: 'h23', timeZone: iana,
    }).formatToParts(date);
    const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
    const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
    return h + m / 60;
  }
  return date.getHours() + date.getMinutes() / 60;
}

/** Corridor distance threshold for "farther" — max distance from route for inclusion. */
export const MAX_CORRIDOR_KM = CORRIDOR_THRESHOLDS.farther;

/**
 * Calculate category match score (0-100).
 * Boosts POIs that align with user preferences.
 */
export function calculateCategoryMatchScore(
  poiCategory: POISuggestionCategory,
  tripPreferences: TripPreference[]
): number {
  if (tripPreferences.length === 0) {
    // No preferences = all categories equally valued
    return 50;
  }

  let score = 30; // Base score

  // Check if POI category matches any preference
  const preferenceMap: Record<TripPreference, POISuggestionCategory[]> = {
    scenic:  ['viewpoint', 'park', 'waterfall', 'landmark'],
    family:  ['attraction', 'park', 'entertainment', 'landmark', 'museum', 'cafe'],
    budget:  ['viewpoint', 'park', 'cafe', 'waterfall', 'landmark', 'museum'],
    foodie:  ['restaurant', 'cafe', 'attraction'],
  };

  tripPreferences.forEach(pref => {
    const matchingCategories = preferenceMap[pref];
    if (matchingCategories.includes(poiCategory)) {
      score += 20; // Strong boost for preference match
    }
  });

  // Universal boosts — discovery-worthy categories rank higher
  if (poiCategory === 'viewpoint') score += 10; // Viewpoints always valuable
  if (poiCategory === 'waterfall') score += 12; // Waterfalls are universally cool
  if (poiCategory === 'landmark') score += 10;  // Landmarks are discovery gold
  if (poiCategory === 'attraction') score += 5; // Attractions slightly favored
  if (poiCategory === 'museum') score += 5;     // Museums are interesting

  // Penalties for generic/utilitarian POIs (not "cool discoveries")
  if (poiCategory === 'cafe') score -= 10;      // Cafes/fast food aren't discoveries
  if (poiCategory === 'gas') score -= 15;       // Gas stations definitely aren't
  if (poiCategory === 'restaurant') score -= 5; // Restaurants are less interesting unless foodie

  return Math.min(score, 100);
}

/**
 * Calculate detour cost score (0-100).
 * Lower distance = higher score.
 */
export function calculateDetourCostScore(distanceKm: number, detourMinutes: number): number {
  // Penalize both distance and time
  let score = 100;

  // Distance penalty
  if (distanceKm > CORRIDOR_THRESHOLDS.farther) {
    score -= 50; // Major penalty for far POIs
  } else if (distanceKm > CORRIDOR_THRESHOLDS.moderate) {
    score -= 30;
  } else if (distanceKm > CORRIDOR_THRESHOLDS.quick) {
    score -= 15;
  }

  // Time penalty
  if (detourMinutes > MAX_DETOUR_MINUTES) {
    score -= 30; // Major penalty for long detours
  } else if (detourMinutes > 20) {
    score -= 20;
  } else if (detourMinutes > 10) {
    score -= 10;
  }

  return Math.max(score, 0);
}

/**
 * Calculate timing fit score (0-100).
 * Checks if POI fits into natural break windows (stop-type matching) and
 * whether the POI type is appropriate for the actual time of day at arrival.
 */
export function calculateTimingFitScore(
  poi: POISuggestion,
  segments: RouteSegment[],
  estimatedArrivalTime?: Date,
  segTz?: string,
): number {
  if (poi.segmentIndex == null || poi.segmentIndex >= segments.length) {
    return 50; // Neutral score if no timing context
  }

  const segment = segments[poi.segmentIndex];
  const stopType = segment.stopType;

  let score = 50; // Base score

  // Boost if POI aligns with existing stop type
  if (stopType === 'meal' && (poi.category === 'restaurant' || poi.category === 'cafe')) {
    score += 30; // Great fit - meal stop + food POI
  } else if (stopType === 'break' && poi.category === 'viewpoint') {
    score += 25; // Good fit - break + viewpoint
  } else if (stopType === 'fuel' && poi.category === 'gas') {
    score += 20; // Practical fit
  } else if (stopType === 'overnight' && poi.category === 'hotel') {
    score += 20; // Accommodation alignment
  }

  // Boost for POIs that can be visited during any stop
  if (poi.category === 'viewpoint' || poi.category === 'park') {
    score += 10; // Quick stops work for any break
  }

  // Time-of-day modifiers: use actual arrival time when available
  if (estimatedArrivalTime) {
    const tod = getLocalTod(estimatedArrivalTime, segTz);
    // Museums, attractions, entertainment score best during business hours (10am–5pm)
    if (
      (poi.category === 'museum' || poi.category === 'attraction' || poi.category === 'entertainment') &&
      tod >= 10 && tod <= 17
    ) {
      score += 15;
    }
    // Outdoor categories less appealing outside comfortable daylight (before 8am or after 6pm)
    if (
      (poi.category === 'viewpoint' || poi.category === 'park' || poi.category === 'waterfall') &&
      (tod < 8 || tod > 18)
    ) {
      score -= 10;
    }
  }

  return Math.min(score, 100);
}

/**
 * Calculate weather fit score (0-100).
 * Penalizes outdoor activities in bad weather, boosts them in perfect weather.
 */
export function calculateWeatherFitScore(
  poi: POISuggestion
): { score: number; rationale?: string } {
  if (!poi.weather) return { score: 50 }; // Neutral if no weather data

  const { weatherCode, temperatureMax, precipitationProb } = poi.weather;
  const isOutdoor = OUTDOOR_CATEGORIES.includes(poi.category);
  const isIndoor = INDOOR_CATEGORIES.includes(poi.category);

  let score = 50; // Base score
  let rationale: string | undefined;

  // ── Bad Weather (Rain / Snow / Thunder) ──────────────────────────────
  // WMO codes >= 51 are drizzle, rain, snow, or thunderstorms.
  if (weatherCode >= 51 || precipitationProb > 40) {
    if (isOutdoor) {
      score = 10;
      rationale = 'Penalized for rain/snow forecast';
    } else if (isIndoor) {
      score = 80; // Boost indoor spots as a good rainy-day alternative
      rationale = 'Boosted for indoor protection';
    }
  }

  // ── Extreme Heat / Cold ──────────────────────────────────────────────
  if (temperatureMax > 32) {
    if (isOutdoor) {
      score = Math.min(score, 30);
      rationale = rationale || 'High heat advisory for outdoors';
    }
  } else if (temperatureMax < 0 && isOutdoor) {
    score = Math.min(score, 30);
    rationale = rationale || 'Extreme cold — potentially inaccessible';
  }

  // ── Perfect Weather (Clear skies, temperate) ───────────────────────
  if ((weatherCode === 0 || weatherCode === 1) && temperatureMax <= 32 && temperatureMax >= 0) {
    if (poi.category === 'viewpoint' || poi.category === 'waterfall') {
      score = 90;
      rationale = 'Perfect conditions for viewing';
    } else if (isOutdoor) {
      score = 75;
    }
  }

  return { score, rationale };
}

/**
 * Calculate fatigue score (0-40 boost).
 * Sums the driving minutes since the last major stop (break/meal/overnight).
 */
export function calculateFatigueScore(
  journeySegment: JourneyContextSegment | undefined
): { score: number; rationale?: string } {
  if (!journeySegment) return { score: 0 };

  if (journeySegment.fatigueBucket === 'exhausted') {
    return {
      score: 40,
      rationale: `You've been driving for ${formatDriveTime(journeySegment.cumulativeDriveMinutesBefore)}. Critical time for a safety break.`,
    };
  }
  if (journeySegment.fatigueBucket === 'fatigued') {
    return {
      score: 20,
      rationale: `Driving for ${formatDriveTime(journeySegment.cumulativeDriveMinutesBefore)}. Perfect time for a quick legs-stretch?`,
    };
  }

  return { score: 0 };
}

/**
 * Calculate hunger score (0-30 boost).
 * Engages MEE's "Hunger Awareness" to naturally boost food during prime mealtimes.
 */
export function calculateHungerScore(
  category: POISuggestionCategory,
  journeySegment: JourneyContextSegment | undefined
): { score: number; rationale?: string } {
  if (!journeySegment) return { score: 0 };
  if (category !== 'restaurant' && category !== 'cafe') return { score: 0 };

  if (journeySegment.isMealWindowLunch) {
    return {
      score: 30,
      rationale: "Right around lunchtime. Perfect moment for a bite.",
    };
  }
  
  if (journeySegment.isMealWindowDinner) {
    return {
      score: 30,
      rationale: "Dinner time approaching. Good spot to refuel.",
    };
  }

  return { score: 0 };
}

/**
 * Check if the detour pushes the arrival at the final destination too late.
 * Keep visible but attach a heavy warning for late arrivals.
 */
export function checkLateArrivalRisk(
  poi: POISuggestion,
  segments: RouteSegment[]
): { penalty: number; rationale?: string } {
  const lastSegment = segments[segments.length - 1];
  if (!lastSegment?.arrivalTime) return { penalty: 0 };

  // Calculate arrival offset (estimated arrival + detour)
  const baseArrival = new Date(lastSegment.arrivalTime);
  const lateArrival = new Date(baseArrival.getTime() + poi.detourTimeMinutes * 60 * 1000);
  
  const tod = lateArrival.getHours() + lateArrival.getMinutes() / 60;
  
  if (tod > 22.5) { // After 10:30 PM
    const isLegendary = poi.popularityScore > 75;
    return {
      penalty: isLegendary ? 5 : 25, // Only slightly penalize 'Legendary' spots, but warn heavily
      rationale: `Legit spot, but it puts your hotel arrival at ${lateArrival.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Worth the late check-in?`,
    };
  }

  return { penalty: 0 };
}
