import type { POISuggestion, RouteSegment, TripPreference, POISuggestionCategory } from '../types';

// Ranking weights (sum to 1.0)
const WEIGHTS = {
  categoryMatch: 0.35,  // 35% - How well it matches user preferences
  popularity: 0.25,     // 25% - Based on OSM metadata richness
  detourCost: 0.25,     // 25% - Minimize extra time/distance
  timingFit: 0.15,      // 15% - Fits into natural break windows
};

// Maximum acceptable detour (minutes)
const MAX_DETOUR_MINUTES = 30;

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
 * Calculate minimum distance from POI to route polyline
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

    // Distance to segment endpoints
    const distToStart = haversineDistance(poi.lat, poi.lng, lat1, lng1);
    const distToEnd = haversineDistance(poi.lat, poi.lng, lat2, lng2);

    // Simple approximation: check distance to both endpoints
    // (Full point-to-line-segment distance would require projection)
    const minSegmentDist = Math.min(distToStart, distToEnd);

    if (minSegmentDist < minDistance) {
      minDistance = minSegmentDist;
      nearestSegmentIndex = i;
      nearestPoint = distToStart < distToEnd ? [lat1, lng1] : [lat2, lng2];
    }
  }

  return {
    distanceKm: minDistance,
    nearestSegmentIndex,
    nearestPoint,
  };
}

/**
 * Estimate detour time based on distance from route
 * Assumes ~60 km/h average speed for detours
 */
export function estimateDetourTime(distanceFromRouteKm: number): number {
  // Round trip detour at 60 km/h
  const roundTripKm = distanceFromRouteKm * 2;
  const detourHours = roundTripKm / 60;
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
    scenic: ['viewpoint', 'park', 'waterfall', 'landmark'],
    family: ['attraction', 'park', 'entertainment', 'landmark'],
    budget: ['viewpoint', 'park', 'cafe', 'waterfall'],
    foodie: ['restaurant', 'cafe'],
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
 * Calculate timing fit score (0-100)
 * Checks if POI fits into natural break windows
 */
function calculateTimingFitScore(
  poi: POISuggestion,
  segments: RouteSegment[]
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

  return Math.min(score, 100);
}

/**
 * Calculate overall ranking score for a POI
 * Returns updated POI with all scores populated
 */
function rankPOI(
  poi: POISuggestion,
  routeGeometry: [number, number][],
  segments: RouteSegment[],
  tripPreferences: TripPreference[]
): POISuggestion {
  // Calculate distance from route
  const { distanceKm, nearestSegmentIndex } = distanceToRoute(poi, routeGeometry);

  // Estimate detour time
  const detourMinutes = estimateDetourTime(distanceKm);

  // Calculate individual scores
  const categoryMatchScore = calculateCategoryMatchScore(poi.category, tripPreferences);
  const detourCostScore = calculateDetourCostScore(distanceKm, detourMinutes);
  const timingFitScore = calculateTimingFitScore({ ...poi, segmentIndex: nearestSegmentIndex }, segments);
  const popularityScore = poi.popularityScore; // Already calculated from OSM tags

  // Weighted composite score
  const rankingScore =
    categoryMatchScore * WEIGHTS.categoryMatch +
    popularityScore * WEIGHTS.popularity +
    detourCostScore * WEIGHTS.detourCost +
    timingFitScore * WEIGHTS.timingFit;

  // Estimate arrival time based on segment
  let estimatedArrivalTime: Date | undefined;
  if (nearestSegmentIndex < segments.length && segments[nearestSegmentIndex].arrivalTime) {
    estimatedArrivalTime = new Date(segments[nearestSegmentIndex].arrivalTime!);
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
    rankingScore: Math.round(rankingScore),
    categoryMatchScore: Math.round(categoryMatchScore),
    timingFitScore: Math.round(timingFitScore),
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
  topN: number = 5
): POISuggestion[] {
  // Rank all POIs
  const rankedPOIs = pois.map(poi => rankPOI(poi, routeGeometry, segments, tripPreferences));

  // Filter out POIs that are too far (>20km from route)
  const filtered = rankedPOIs.filter(poi => poi.distanceFromRoute <= CORRIDOR_THRESHOLDS.farther);

  // Sort by ranking score (descending)
  const sorted = filtered.sort((a, b) => b.rankingScore - a.rankingScore);

  // Category-diverse selection: max 3 per category
  const MAX_PER_CATEGORY = 3;
  const categoryCounts = new Map<string, number>();
  const diverse: POISuggestion[] = [];

  for (const poi of sorted) {
    const count = categoryCounts.get(poi.category) || 0;
    if (count < MAX_PER_CATEGORY) {
      diverse.push(poi);
      categoryCounts.set(poi.category, count + 1);
    }
    if (diverse.length >= topN) break;
  }

  return diverse;
}

/**
 * Rank destination-area POIs (different logic - no detour cost, focus on quality)
 * Calculates distance from destination point so the UI can display meaningful info.
 */
export function rankDestinationPOIs(
  pois: POISuggestion[],
  tripPreferences: TripPreference[],
  destination: { lat: number; lng: number },
  topN: number = 5
): POISuggestion[] {
  const rankedPOIs = pois.map(poi => {
    const categoryMatchScore = calculateCategoryMatchScore(poi.category, tripPreferences);
    const popularityScore = poi.popularityScore;

    // Distance from the destination point (for informational display)
    const distanceFromDest = haversineDistance(poi.lat, poi.lng, destination.lat, destination.lng);

    // For destination POIs, only use category match + popularity (50/50 weight)
    const rankingScore = categoryMatchScore * 0.5 + popularityScore * 0.5;

    return {
      ...poi,
      distanceFromRoute: Math.round(distanceFromDest * 10) / 10, // km from destination center
      detourTimeMinutes: 0, // No detour — you're already at destination
      fitsInBreakWindow: true,
      rankingScore: Math.round(rankingScore),
      categoryMatchScore: Math.round(categoryMatchScore),
    };
  });

  // Sort by ranking score
  const sorted = rankedPOIs.sort((a, b) => b.rankingScore - a.rankingScore);

  // Return top N
  return sorted.slice(0, topN);
}
