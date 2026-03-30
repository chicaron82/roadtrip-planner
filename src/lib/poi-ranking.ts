import type { POISuggestion, RouteSegment, TripPreference } from '../types';
import * as SunCalc from 'suncalc';
import { haversineDistance, distanceToRoute, estimateDetourTime } from './geo-utils';
import {
  getLocalTod, MAX_CORRIDOR_KM,
  calculateCategoryMatchScore, calculateDetourCostScore,
  calculateTimingFitScore, calculateWeatherFitScore,
  calculateFatigueScore, calculateHungerScore, checkLateArrivalRisk,
} from './poi-scoring';
import type { JourneyContext } from './trip-orchestrator/journey-context';

// Ranking weights (sum to 1.0)
const WEIGHTS = {
  categoryMatch: 0.30,  // 30% - How well it matches user preferences
  popularity:    0.20,  // 20% - Based on OSM metadata richness
  detourCost:    0.25,  // 25% - Minimize extra time/distance
  timingFit:     0.15,  // 15% - Fits into natural break windows
  weatherFit:    0.10,  // 10% - Fits current forecast / conditions
};

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
  const filtered = rankedPOIs.filter(poi => poi.distanceFromRoute <= MAX_CORRIDOR_KM);

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
