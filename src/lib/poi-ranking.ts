import type { POISuggestion, RouteSegment, TripPreference, POISuggestionCategory } from '../types';
import * as SunCalc from 'suncalc';
import { formatDriveTime } from './driver-rotation';

// Ranking weights (sum to 1.0)
const WEIGHTS = {
  categoryMatch: 0.30,  // 30% - How well it matches user preferences
  popularity:    0.20,  // 20% - Based on OSM metadata richness
  detourCost:    0.25,  // 25% - Minimize extra time/distance
  timingFit:     0.15,  // 15% - Fits into natural break windows
  weatherFit:    0.10,  // 10% - Fits current forecast / conditions
};

const OUTDOOR_CATEGORIES: POISuggestionCategory[] = [
  'viewpoint', 'park', 'waterfall', 'attraction', 'landmark',
];
const INDOOR_CATEGORIES: POISuggestionCategory[] = [
  'museum', 'restaurant', 'cafe', 'shopping', 'entertainment', 'hotel',
];

// Maximum acceptable detour (minutes)
const MAX_DETOUR_MINUTES = 30;

/** Return fractional hour (0–23.99) in a specific IANA timezone, or fall back to local. */
function getLocalTod(date: Date, tz?: string): number {
  if (tz) {
    const parts = new Intl.DateTimeFormat('en', {
      hour: 'numeric', minute: 'numeric', hourCycle: 'h23', timeZone: tz,
    }).formatToParts(date);
    const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
    const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
    return h + m / 60;
  }
  return date.getHours() + date.getMinutes() / 60;
}

// Corridor distance thresholds
const CORRIDOR_THRESHOLDS = {
  quick: 5,      // Within 5km - minimal detour
  moderate: 10,  // Within 10km - acceptable detour
  farther: 20,   // Within 20km - worth it if high value
};

/**
 * Calculate straight-line distance between two points (Haversine formula)
 * Returns distance in kilometers
 */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate minimum distance from POI to route polyline using true
 * perpendicular point-to-segment projection (flat-earth approximation).
 * Returns { distanceKm, nearestSegmentIndex, nearestPoint }
 */
function distanceToRoute(
  poi: POISuggestion,
  routeGeometry: [number, number][]
): { distanceKm: number; nearestSegmentIndex: number; nearestPoint: [number, number] } {
  let minDistance = Infinity;
  let nearestSegmentIndex = 0;
  let nearestPoint: [number, number] = routeGeometry[0];

  for (let i = 0; i < routeGeometry.length - 1; i++) {
    const [lat1, lng1] = routeGeometry[i];
    const [lat2, lng2] = routeGeometry[i + 1];

    const dx = lat2 - lat1;
    const dy = lng2 - lng1;
    const lenSq = dx * dx + dy * dy;

    let nearLat: number;
    let nearLng: number;

    if (lenSq === 0) {
      // Degenerate segment (zero-length) — use the endpoint
      nearLat = lat1;
      nearLng = lng1;
    } else {
      // Perpendicular projection: t = ((P-P1)·(P2-P1)) / |P2-P1|²
      const t = Math.max(0, Math.min(1,
        ((poi.lat - lat1) * dx + (poi.lng - lng1) * dy) / lenSq
      ));
      nearLat = lat1 + t * dx;
      nearLng = lng1 + t * dy;
    }

    const dist = haversineDistance(poi.lat, poi.lng, nearLat, nearLng);

    if (dist < minDistance) {
      minDistance = dist;
      nearestSegmentIndex = i;
      nearestPoint = [nearLat, nearLng];
    }
  }

  return {
    distanceKm: minDistance,
    nearestSegmentIndex,
    nearestPoint,
  };
}

/**
 * Estimate detour time based on distance from route.
 * Uses the actual driving speed of the nearest segment rather than a flat 60 km/h,
 * so highway drivers don't get over-penalised for the same detour distance.
 * Speed is clamped to 40–120 km/h to guard against degenerate segment data.
 */
export function estimateDetourTime(distanceFromRouteKm: number, drivingSpeedKmh = 60): number {
  const roundTripKm = distanceFromRouteKm * 2;
  const detourHours = roundTripKm / drivingSpeedKmh;
  return Math.round(detourHours * 60); // Convert to minutes
}

/**
 * Find which route segment a POI falls nearest to.
 * Compares against each segment's `to` location (arrival point).
 * Returns the segment index suitable for `afterSegmentIndex`.
 */
export function findNearestSegmentIndex(
  lat: number,
  lng: number,
  segments: RouteSegment[]
): number {
  let minDist = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < segments.length; i++) {
    const to = segments[i].to;
    const dist = haversineDistance(lat, lng, to.lat, to.lng);
    if (dist < minDist) {
      minDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Calculate category match score (0-100)
 * Boosts POIs that align with user preferences
 */
function calculateCategoryMatchScore(
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
 * Calculate detour cost score (0-100)
 * Lower distance = higher score
 */
function calculateDetourCostScore(distanceKm: number, detourMinutes: number): number {
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
function calculateTimingFitScore(
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
 * Calculate weather fit score (0-100)
 * Penalizes outdoor activities in bad weather, boosts them in perfect weather.
 */
function calculateWeatherFitScore(
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

  // ── Golden Hour (Sunset Guardian) ──────────────────────────────────
  // If the POI is specifically tagged as Golden Hour by the ranking context,
  // ensure it has a persistent boost that keeps it prioritized for orchestration.
  // Note: isGoldenHour is calculated in rankPOI, but score is base-evaluated here.
  // We'll apply the final boost in rankPOI to maintain consistency.

  return { score, rationale };
}

import type { JourneyContext, JourneyContextSegment } from './trip-orchestrator/journey-context';

/**
 * Calculate fatigue score (0-40 boost)
 * Sums the driving minutes since the last major stop (break/meal/overnight).
 */
function calculateFatigueScore(
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
function calculateHungerScore(
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
 * Proposal: Keep visible but attach a heavy warning for late arrivals.
 */
function checkLateArrivalRisk(
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

/**
 * Calculate overall ranking score for a POI
 * Returns updated POI with all scores populated
 */
function rankPOI(
  poi: POISuggestion,
  routeGeometry: [number, number][],
  segments: RouteSegment[],
  tripPreferences: TripPreference[],
  journeyContext?: JourneyContext,
  sunCalcCache?: Map<string, { sunrise: Date, sunset: Date }>
): POISuggestion {
  // Calculate distance from route
  const { distanceKm, nearestSegmentIndex } = distanceToRoute(poi, routeGeometry);
  const journeySegment = journeyContext?.segments[nearestSegmentIndex];

  // Derive driving speed from the nearest segment's actual data.
  // Clamped to 40–120 km/h to guard against degenerate (zero-duration) segments.
  const nearSeg = segments[nearestSegmentIndex];
  const rawSpeedKmh = nearSeg && nearSeg.durationMinutes > 0
    ? nearSeg.distanceKm / (nearSeg.durationMinutes / 60)
    : 60;
  const detourSpeedKmh = Math.min(Math.max(rawSpeedKmh, 40), 120);
  const detourMinutes = estimateDetourTime(distanceKm, detourSpeedKmh);

  // Estimate arrival time based on segment early, for late limits
  let estimatedArrivalTime: Date | undefined;
  if (nearestSegmentIndex < segments.length && segments[nearestSegmentIndex].arrivalTime) {
    estimatedArrivalTime = new Date(segments[nearestSegmentIndex].arrivalTime!);
  }
  const segTz = segments[nearestSegmentIndex]?.timezone;

  // Calculate individual scores
  const categoryMatchScore = calculateCategoryMatchScore(poi.category, tripPreferences);
  const detourCostScore = calculateDetourCostScore(distanceKm, detourMinutes);
  const timingFitScore = calculateTimingFitScore(
    { ...poi, segmentIndex: nearestSegmentIndex },
    segments,
    estimatedArrivalTime,
    segTz,
  );
  const popularityScore = poi.popularityScore; // Already calculated from OSM tags

  // Weighted composite score
  const { score: weatherFitScore, rationale: weatherRationale } = calculateWeatherFitScore(poi);
  const { score: fatigueScore, rationale: fatigueRationale } = calculateFatigueScore(journeySegment);
  const { penalty: arrivalPenalty, rationale: arrivalRationale } = checkLateArrivalRisk(poi, segments);
  const { score: hungerScore, rationale: hungerRationale } = calculateHungerScore(poi.category, journeySegment);

  let rankingScore =
    categoryMatchScore * WEIGHTS.categoryMatch +
    popularityScore * WEIGHTS.popularity +
    detourCostScore * WEIGHTS.detourCost +
    timingFitScore * WEIGHTS.timingFit +
    weatherFitScore * WEIGHTS.weatherFit +
    fatigueScore + 
    hungerScore; // Fatigue and Hunger are direct additive boosts

  rankingScore -= arrivalPenalty; // Subtract arrival penalty

  // Combine rationales (Empathy-driven microcopy)
  const rationales: string[] = [];
  if (fatigueRationale) rationales.push(fatigueRationale);
  if (hungerRationale) rationales.push(hungerRationale);
  if (arrivalRationale) rationales.push(arrivalRationale);
  if (weatherRationale) rationales.push(weatherRationale);
  
  const rankingRationale = rationales.join(' ');

  // Time-of-day demotion: places visited before 07:00 or after 19:30 are less
  // useful (closed or after dark). Apply a -25pt penalty to discourage them.
  if (estimatedArrivalTime) {
    const tod = getLocalTod(estimatedArrivalTime, segTz);
    if (tod < 7 || tod > 19.5) {
      rankingScore = Math.max(0, rankingScore - 25);
    }
  }

  let isGoldenHour = poi.isGoldenHour || false;
  if (!isGoldenHour && estimatedArrivalTime) {
    const arrTimeMs = estimatedArrivalTime.getTime();
    const dateStr = estimatedArrivalTime.toISOString().split('T')[0];
    const latRounded = Math.round(poi.lat * 10) / 10;
    const lngRounded = Math.round(poi.lng * 10) / 10;
    const cacheKey = `${dateStr}_${latRounded}_${lngRounded}`;
    
    let sunTimes = sunCalcCache?.get(cacheKey);
    if (!sunTimes) {
      const fullTimes = SunCalc.getTimes(estimatedArrivalTime, poi.lat, poi.lng);
      sunTimes = { sunrise: fullTimes.sunrise, sunset: fullTimes.sunset };
      sunCalcCache?.set(cacheKey, sunTimes);
    }
    
    // Golden hour logic: within 60 mins of sunrise or sunset
    const sunsetDiff = Math.abs(arrTimeMs - sunTimes.sunset.getTime());
    const sunriseDiff = Math.abs(arrTimeMs - sunTimes.sunrise.getTime());
    const ONE_HOUR = 60 * 60 * 1000;
    
    if (sunsetDiff <= ONE_HOUR || sunriseDiff <= ONE_HOUR) {
      isGoldenHour = true;
      // Subtly boost the ranking score so amazing photospots bubble up!
      rankingScore += 15;
    }
  }

  // Final "Guardianship" boost for Golden Hour viewpoints
  if (isGoldenHour && (poi.category === 'viewpoint' || poi.category === 'waterfall')) {
    rankingScore += 20; // Ensure they stay at the top of the 'Legendary' list
  }

  // Check if fits in break window (if detour is quick)
  const fitsInBreakWindow = detourMinutes <= 15;

  return {
    ...poi,
    distanceFromRoute: distanceKm,
    detourTimeMinutes: detourMinutes,
    segmentIndex: nearestSegmentIndex,
    estimatedArrivalTime,
    fitsInBreakWindow,
    isGoldenHour,
    rankingScore: Math.round(rankingScore),
    categoryMatchScore: Math.round(categoryMatchScore),
    timingFitScore: Math.round(timingFitScore),
    weatherFitScore,
    rankingRationale,
  };
}

/**
 * Rank and filter POIs to top picks.
 * Enforces category diversity: max 3 POIs per category to prevent
 * one type (e.g. restaurants) from flooding the results.
 */
export function rankAndFilterPOIs(
  pois: POISuggestion[],
  routeGeometry: [number, number][],
  segments: RouteSegment[],
  tripPreferences: TripPreference[],
  topN: number = 5,
  journeyContext?: JourneyContext
): POISuggestion[] {
  const sunCalcCache = new Map<string, { sunrise: Date, sunset: Date }>();

  // Rank all POIs
  const rankedPOIs = pois.map(poi => rankPOI(poi, routeGeometry, segments, tripPreferences, journeyContext, sunCalcCache));

  // Filter out POIs that are too far (>20km from route)
  const filtered = rankedPOIs.filter(poi => poi.distanceFromRoute <= CORRIDOR_THRESHOLDS.farther);

  // Sort by ranking score (descending)
  const sorted = filtered.sort((a, b) => b.rankingScore - a.rankingScore);

  // Category-diverse selection: max 3 per category
  // Plus: Timeline Protection (Phase 3)
  const MAX_PER_CATEGORY = 3;
  const MAX_TOTAL_DETOUR = 50; // Total allowed extra detour minutes per selection set
  
  // PHASE 1: Category Diverse Filter
  const categoryDiverse: POISuggestion[] = [];
  const categoryCounts = new Map<string, number>();

  for (const poi of sorted) {
    const count = categoryCounts.get(poi.category) || 0;
    if (count < MAX_PER_CATEGORY) {
      categoryDiverse.push(poi);
      categoryCounts.set(poi.category, count + 1);
    }
  }

  // PHASE 2: Budget Enforcement Pruning
  const diverse: (POISuggestion & { isTimelineProtected?: boolean })[] = [];
  let currentTotalDetour = 0;

  for (const poi of categoryDiverse) {
    const isHeavy = poi.detourTimeMinutes > 15;
    const isExhausted = currentTotalDetour + poi.detourTimeMinutes > MAX_TOTAL_DETOUR;
    const isGoldenGuardian = poi.isGoldenHour && (poi.category === 'viewpoint' || poi.category === 'waterfall');

    // Pruning logic: If we already have 1+ stop and this one blows the budget 
    // and is a "heavy" detour (>15m) skip it unless it's a 'viewpoint' in Golden Hour.
    if (isExhausted && isHeavy && !isGoldenGuardian && diverse.length >= 1) {
      // Skip this heavy detour to protect the timeline
      continue;
    }

    const finalPoi = { ...poi };
    // If it breached the budget but we allowed it (because it was quick or golden),
    // mark it as timeline protected.
    if (isExhausted && diverse.length >= 1) {
      finalPoi.rankingRationale = (finalPoi.rankingRationale ? finalPoi.rankingRationale + ' ' : '') + 
        "[Timeline Protected: Pruned longer alternatives to ensure arrival]";
      finalPoi.isTimelineProtected = true;
    }
    
    diverse.push(finalPoi);
    currentTotalDetour += poi.detourTimeMinutes;
    
    if (diverse.length >= topN) break;
  }

  return diverse;
}

/**
 * Rank destination-area POIs (different logic - no detour cost, focus on quality).
 * Calculates distance from destination point so the UI can display meaningful info.
 * Accepts optional arrivalTime so time-of-day demotion and hunger awareness
 * stay consistent with the route POI ranking pipeline.
 */
export function rankDestinationPOIs(
  pois: POISuggestion[],
  tripPreferences: TripPreference[],
  destination: { lat: number; lng: number },
  topN: number = 5,
  arrivalTime?: Date,
  arrivalTimezone?: string,
): POISuggestion[] {
  const rankedPOIs = pois.map(poi => {
    const categoryMatchScore = calculateCategoryMatchScore(poi.category, tripPreferences);
    const popularityScore = poi.popularityScore;

    // Distance from the destination point (for informational display)
    const distanceFromDest = haversineDistance(poi.lat, poi.lng, destination.lat, destination.lng);

    // Contextual weather score
    const { score: weatherFitScore, rationale: weatherRationale } = calculateWeatherFitScore(poi);

    // For destination POIs, use category match + popularity + weather (40/40/20)
    let rankingScore = categoryMatchScore * 0.4 + popularityScore * 0.4 + weatherFitScore * 0.2;
    const rationales: string[] = [];
    if (weatherRationale) rationales.push(weatherRationale);

    // Empathy parity: apply the same time-of-day and hunger signals as route POIs
    if (arrivalTime) {
      const tod = getLocalTod(arrivalTime, arrivalTimezone);
      // Time-of-day demotion: same -25pt window as route ranking
      if (tod < 7 || tod > 19.5) {
        rankingScore = Math.max(0, rankingScore - 25);
      }
      // Hunger awareness — derived inline from tod (no JourneyContextSegment needed)
      if (poi.category === 'restaurant' || poi.category === 'cafe') {
        if (tod >= 11.5 && tod < 13.5) {
          rankingScore += 30;
          rationales.push('Right around lunchtime. Perfect moment for a bite.');
        } else if (tod >= 17.5 && tod < 20) {
          rankingScore += 30;
          rationales.push('Dinner time approaching. Good spot to refuel.');
        }
      }
    }

    return {
      ...poi,
      distanceFromRoute: Math.round(distanceFromDest * 10) / 10, // km from destination center
      detourTimeMinutes: 0, // No detour — you're already at destination
      fitsInBreakWindow: true,
      rankingScore: Math.round(rankingScore),
      categoryMatchScore: Math.round(categoryMatchScore),
      weatherFitScore,
      rankingRationale: rationales.join(' '),
    };
  });

  // Sort by ranking score
  const sorted = rankedPOIs.sort((a, b) => b.rankingScore - a.rankingScore);

  // Return top N
  return sorted.slice(0, topN);
}
