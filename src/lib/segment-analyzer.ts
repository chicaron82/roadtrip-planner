import type { RouteSegment, SegmentWarning, TripSettings } from '../types';

/**
 * Analyzes route segments and adds intelligent warnings
 */
export function analyzeSegments(
  segments: RouteSegment[]
): RouteSegment[] {
  return segments.map((segment) => {
    const warnings: SegmentWarning[] = [];
    const durationHours = segment.durationMinutes / 60;

    // Long drive warnings
    if (durationHours > 6) {
      warnings.push({
        type: 'long_drive',
        severity: 'critical',
        message: `⚠️ ${durationHours.toFixed(1)}h drive - Consider breaking this leg into multiple days`,
        icon: '🛑',
      });
    } else if (durationHours > 4) {
      warnings.push({
        type: 'long_drive',
        severity: 'warning',
        message: `⏰ ${durationHours.toFixed(1)}h drive - Take breaks every 2 hours`,
        icon: '⚠️',
      });
    }

    // Suggest breaks for segments > 3 hours
    const suggestedBreak = durationHours > 3;

    // Detect border crossings based on location names
    const crossesBorder = detectBorderCrossing(segment.from.name, segment.to.name);
    if (crossesBorder) {
      warnings.push({
        type: 'border_crossing',
        severity: 'info',
        message: '🛂 International border crossing - Bring passport & check customs requirements',
        icon: '🛂',
      });
    }

    // Detect timezone crossings (basic heuristic based on distance and direction)
    const timezoneCrossing = detectTimezoneCrossing(segment);

    if (timezoneCrossing.crosses) {
      warnings.push({
        type: 'timezone',
        severity: 'info',
        message: `🕐 Timezone change: ${timezoneCrossing.message}`,
        icon: '🕐',
      });
    }

    return {
      ...segment,
      warnings,
      suggestedBreak,
      timezone: timezoneCrossing.timezone,
      timezoneCrossing: timezoneCrossing.crosses,
    };
  });
}

/**
 * Detects border crossings based on location names
 */
function detectBorderCrossing(fromName: string, toName: string): boolean {
  const canadianIndicators = ['canada', 'ontario', 'quebec', 'alberta', 'british columbia', 'bc', 'on', 'qc', 'ab'];
  const usIndicators = ['usa', 'united states', 'new york', 'washington', 'michigan', 'ny', 'wa', 'mi', 'california'];

  const fromIsCanada = canadianIndicators.some(ind => fromName.toLowerCase().includes(ind));
  const toIsCanada = canadianIndicators.some(ind => toName.toLowerCase().includes(ind));
  const fromIsUS = usIndicators.some(ind => fromName.toLowerCase().includes(ind));
  const toIsUS = usIndicators.some(ind => toName.toLowerCase().includes(ind));

  return (fromIsCanada && toIsUS) || (fromIsUS && toIsCanada);
}

/**
 * Detects timezone crossings (simplified heuristic)
 */
function detectTimezoneCrossing(segment: RouteSegment): {
  crosses: boolean;
  timezone?: string;
  message?: string;
} {
  const { from, to } = segment;
  const lngDiff = Math.abs(to.lng - from.lng);

  // Rough heuristic: ~15 degrees longitude = 1 hour timezone change
  if (lngDiff > 10) {
    const direction = to.lng > from.lng ? 'East' : 'West';
    const hoursChange = Math.round(lngDiff / 15);

    // Detect which timezone based on longitude (very rough)
    let timezone = 'America/Toronto'; // Default
    if (to.lng < -120) timezone = 'America/Los_Angeles'; // Pacific
    else if (to.lng < -105) timezone = 'America/Denver'; // Mountain
    else if (to.lng < -90) timezone = 'America/Chicago'; // Central
    else if (to.lng < -75) timezone = 'America/New_York'; // Eastern

    return {
      crosses: true,
      timezone,
      message: `You ${direction === 'East' ? 'lose' : 'gain'} ${hoursChange} hour${hoursChange > 1 ? 's' : ''}`,
    };
  }

  return { crosses: false };
}

/**
 * Calculates estimated arrival time for a segment
 */
export function calculateArrivalTime(
  departureTime: string,
  durationMinutes: number,
  departureDate?: string
): { time: string; date: string } {
  const [hours, minutes] = departureTime.split(':').map(Number);
  const date = departureDate ? new Date(departureDate) : new Date();

  date.setHours(hours, minutes, 0, 0);
  date.setMinutes(date.getMinutes() + durationMinutes);

  const arrivalTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const arrivalDate = date.toISOString().split('T')[0];

  return { time: arrivalTime, date: arrivalDate };
}

/**
 * Generates smart pacing suggestions based on trip duration.
 * @param maxDayMinutes - Longest single driving day in minutes (not total trip)
 * @param settings - Trip settings
 * @param isAlreadySplit - True when the trip is already planned as multi-day
 */
export function generatePacingSuggestions(
  maxDayMinutes: number,
  settings: TripSettings,
  isAlreadySplit = false
): string[] {
  const suggestions: string[] = [];
  const dayHours = maxDayMinutes / 60;
  const daysNeeded = Math.ceil(dayHours / settings.maxDriveHours);

  // Only suggest splitting if not already planned as a multi-day trip
  if (daysNeeded > 1 && !isAlreadySplit) {
    suggestions.push(`💡 This is a ${dayHours.toFixed(1)}-hour drive. Consider splitting into ${daysNeeded} days.`);
  }

  if (dayHours > 8 && settings.departureTime) {
    const [hours] = settings.departureTime.split(':').map(Number);
    if (hours > 12) {
      suggestions.push(`🌅 Starting at ${settings.departureTime} means night driving. Consider departing at 6-8 AM instead.`);
    }
  }

  if (settings.numDrivers > 1) {
    const swapInterval = (dayHours / settings.numDrivers).toFixed(1);
    suggestions.push(`👥 With ${settings.numDrivers} drivers, swap every ${swapInterval} hours to stay fresh.`);
  }

  const breaksNeeded = Math.floor(dayHours / 2);
  if (breaksNeeded > 0) {
    suggestions.push(`☕ Plan for ${breaksNeeded} break${breaksNeeded > 1 ? 's' : ''} (every 2-3 hours) to stretch and refuel.`);
  }

  return suggestions;
}

/**
 * Calculates fuel stop recommendations
 */
export function calculateFuelStops(
  segments: RouteSegment[],
  tankSizeLitres: number,
  fuelEconomyL100km: number
): { segmentIndex: number; distanceFromStart: number; fuelRemaining: number }[] {
  const usableTank = tankSizeLitres * 0.75; // 75% usable capacity
  let currentFuel = tankSizeLitres;
  let totalDistance = 0;
  const stops: { segmentIndex: number; distanceFromStart: number; fuelRemaining: number }[] = [];

  segments.forEach((segment, index) => {
    const fuelNeeded = (segment.distanceKm / 100) * fuelEconomyL100km;
    totalDistance += segment.distanceKm;

    // Check if we need to refuel before this segment
    if (currentFuel - fuelNeeded < usableTank * 0.25) {
      stops.push({
        segmentIndex: index,
        distanceFromStart: totalDistance - segment.distanceKm,
        fuelRemaining: currentFuel,
      });
      currentFuel = tankSizeLitres; // Refill
    }

    currentFuel -= fuelNeeded;
  });

  return stops;
}
