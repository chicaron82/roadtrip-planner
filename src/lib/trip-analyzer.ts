import type { TripSummary, TripSettings } from '../types';

export type DifficultyLevel = 'easy' | 'moderate' | 'challenging' | 'extreme';

export interface TripDifficulty {
  level: DifficultyLevel;
  score: number; // 0-100
  factors: string[];
  color: string;
  emoji: string;
}

export interface RouteConfidence {
  score: number; // 0-100
  label: string;
  factors: string[];
}

/**
 * Calculate trip difficulty based on various factors
 */
export function calculateTripDifficulty(
  summary: TripSummary,
  settings: TripSettings
): TripDifficulty {
  let score = 0;
  const factors: string[] = [];

  const totalHours = summary.totalDurationMinutes / 60;
  const daysNeeded = Math.ceil(totalHours / settings.maxDriveHours);

  // Distance factor (0-25 points)
  if (summary.totalDistanceKm > 2000) {
    score += 25;
    factors.push('Very long distance (>2000km)');
  } else if (summary.totalDistanceKm > 1000) {
    score += 15;
    factors.push('Long distance (>1000km)');
  } else if (summary.totalDistanceKm > 500) {
    score += 8;
    factors.push('Moderate distance');
  }

  // Duration factor (0-25 points)
  if (totalHours > 20) {
    score += 25;
    factors.push('Very long drive time (>20h)');
  } else if (totalHours > 12) {
    score += 15;
    factors.push('Long drive time (>12h)');
  } else if (totalHours > 8) {
    score += 8;
    factors.push('Full day of driving');
  }

  // Multi-day factor (0-15 points)
  if (daysNeeded > 3) {
    score += 15;
    factors.push('Multi-day journey (>3 days)');
  } else if (daysNeeded > 1) {
    score += 8;
    factors.push('Multi-day journey');
  }

  // Warnings factor (0-20 points)
  const criticalWarnings = summary.segments.reduce(
    (acc, seg) => acc + (seg.warnings?.filter(w => w.severity === 'critical').length || 0),
    0
  );
  const warningCount = summary.segments.reduce(
    (acc, seg) => acc + (seg.warnings?.filter(w => w.severity === 'warning').length || 0),
    0
  );

  if (criticalWarnings > 0) {
    score += 20;
    factors.push(`${criticalWarnings} critical warnings`);
  } else if (warningCount > 2) {
    score += 10;
    factors.push(`${warningCount} warnings`);
  }

  // Border crossing factor (0-10 points)
  const borderCrossings = summary.segments.filter(
    seg => seg.warnings?.some(w => w.type === 'border_crossing')
  ).length;
  if (borderCrossings > 0) {
    score += 10;
    factors.push('International border crossing');
  }

  // Timezone crossing factor (0-5 points)
  const timezoneCrossings = summary.segments.filter(seg => seg.timezoneCrossing).length;
  if (timezoneCrossings > 0) {
    score += 5;
    factors.push(`${timezoneCrossings} timezone crossing${timezoneCrossings > 1 ? 's' : ''}`);
  }

  // Determine difficulty level
  let level: DifficultyLevel;
  let color: string;
  let emoji: string;

  if (score >= 70) {
    level = 'extreme';
    color = 'red';
    emoji = '🔴';
  } else if (score >= 45) {
    level = 'challenging';
    color = 'orange';
    emoji = '🟠';
  } else if (score >= 20) {
    level = 'moderate';
    color = 'yellow';
    emoji = '🟡';
  } else {
    level = 'easy';
    color = 'green';
    emoji = '🟢';
  }

  return { level, score, factors, color, emoji };
}

/**
 * Calculate route confidence score
 */
export function calculateRouteConfidence(
  summary: TripSummary,
  settings: TripSettings
): RouteConfidence {
  let score = 100; // Start at perfect confidence
  const factors: string[] = [];

  // Deduct for complexity
  if (summary.segments.length > 5) {
    score -= 10;
    factors.push('Many waypoints reduce accuracy');
  }

  // Deduct for warnings
  const hasWarnings = summary.segments.some(seg => seg.warnings && seg.warnings.length > 0);
  if (hasWarnings) {
    score -= 5;
    factors.push('Route has complexity warnings');
  }

  // Deduct for missing weather data
  const missingWeather = summary.segments.filter(seg => !seg.weather).length;
  if (missingWeather > 0) {
    score -= missingWeather * 2;
    factors.push('Some weather data unavailable');
  }

  // Deduct for very long routes (more uncertainty)
  if (summary.totalDistanceKm > 2000) {
    score -= 8;
    factors.push('Very long routes have more variability');
  }

  // Round trip is more predictable
  if (settings.isRoundTrip) {
    score += 3;
    factors.push('Round trip is familiar route');
  }

  // Cap score
  score = Math.max(60, Math.min(100, score));

  let label: string;
  if (score >= 95) label = 'Excellent';
  else if (score >= 85) label = 'Very Good';
  else if (score >= 75) label = 'Good';
  else if (score >= 65) label = 'Fair';
  else label = 'Estimated';

  return { score, label, factors };
}

/**
 * Generate trip overview statistics
 */
export function generateTripOverview(
  summary: TripSummary,
  settings: TripSettings
): {
  difficulty: TripDifficulty;
  confidence: RouteConfidence;
  highlights: string[];
} {
  const difficulty = calculateTripDifficulty(summary, settings);
  const confidence = calculateRouteConfidence(summary, settings);

  const highlights: string[] = [];

  // Add key highlights — context-aware for multi-day trips
  const totalHours = summary.totalDurationMinutes / 60;
  const actualDays = summary.days?.filter(d => d.segmentIndices.length > 0).length ?? 0;

  if (actualDays > 1) {
    // Trip is already split into days — show total context, not single-day warnings
    highlights.push(`${totalHours.toFixed(1)} hours of driving across ${actualDays} days`);
  } else {
    highlights.push(`${totalHours.toFixed(1)} hours of driving`);

    // Only suggest splitting when the trip ISN'T already multi-day
    const daysNeeded = Math.ceil(totalHours / settings.maxDriveHours);
    if (daysNeeded > 1) {
      highlights.push(`Best split into ${daysNeeded} days`);
    }
  }

  if (summary.gasStops > 0) {
    highlights.push(`${summary.gasStops} gas stop${summary.gasStops > 1 ? 's' : ''} planned`);
  }

  const borderCrossings = summary.segments.filter(
    seg => seg.warnings?.some(w => w.type === 'border_crossing')
  ).length;
  if (borderCrossings > 0) {
    highlights.push('Crosses international border');
  }

  return { difficulty, confidence, highlights };
}
