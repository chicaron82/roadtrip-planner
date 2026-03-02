import type { RouteSegment, TripDay, TripSettings } from '../../types';
import type { ProcessedSegment } from './segment-processor';

/**
 * Round a value UP to the nearest increment.
 * Humans budget in round numbers — $65.14 becomes $70.
 * ceilToNearest(65.14, 5) → 70
 * ceilToNearest(0, 5) → 0  (zero stays zero)
 */
export function ceilToNearest(value: number, increment: number): number {
  if (value === 0) return 0;
  return Math.ceil(value / increment) * increment;
}

/**
 * Label a transit day with "In Transit to X (Day N/M)" when the day
 * contains sub-segments from a splitLongSegments split.
 *
 * Called after finalizeTripDay at each of the three finalization points
 * (max-drive split, midpoint split, final day).
 */
export function labelTransitDay(day: TripDay, originalSegments: RouteSegment[]): void {
  const lastPS = day.segments[day.segments.length - 1] as ProcessedSegment | undefined;
  if (!lastPS?._transitPart) return;
  const destName = originalSegments[lastPS._originalIndex]?.to.name.split(',')[0].trim();
  if (destName) {
    day.title = `In Transit to ${destName} (Day ${lastPS._transitPart.index + 1}/${lastPS._transitPart.total})`;
  }
}

/**
 * Create an empty day structure.
 */
export function createEmptyDay(dayNumber: number, date: Date): TripDay {
  const dateStr = date.toISOString().split('T')[0];
  const dateFormatted = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return {
    dayNumber,
    date: dateStr,
    dateFormatted,
    route: '',
    segments: [],
    segmentIndices: [],
    timezoneChanges: [],
    budget: {
      gasUsed: 0,
      hotelCost: 0,
      foodEstimate: 0,
      miscCost: 0,
      dayTotal: 0,
      gasRemaining: 0,
      hotelRemaining: 0,
      foodRemaining: 0,
    },
    totals: {
      distanceKm: 0,
      driveTimeMinutes: 0,
      stopTimeMinutes: 0,
      departureTime: date.toISOString(),
      arrivalTime: date.toISOString(),
    },
  };
}

/**
 * Finalize a trip day with calculated totals.
 */
export function finalizeTripDay(
  day: TripDay,
  gasRemaining: number,
  hotelRemaining: number,
  foodRemaining: number,
  settings: TripSettings,
): void {
  if (day.segments.length === 0) return;

  // Calculate route string — strip "(transit)" labels from split-point names.
  // Un-snapped transit split-points use the format "CityA → CityB (transit)".
  //   As a FROM name: take CityA (the source — directionally correct)
  //   As a TO name:   take CityB (the destination — avoids "Winnipeg → Winnipeg")
  const cleanFrom = (n: string): string => {
    const name = n.replace(/\s*\(transit\)\s*$/, '');
    const arrow = name.indexOf(' → ');
    return arrow >= 0 ? name.substring(0, arrow).trim() : name;
  };
  const cleanTo = (n: string): string => {
    const name = n.replace(/\s*\(transit\)\s*$/, '');
    const arrow = name.indexOf(' → ');
    return arrow >= 0 ? name.substring(arrow + 3).trim() : name;
  };
  const firstStop = cleanFrom(day.segments[0].from.name);
  const lastStop = cleanTo(day.segments[day.segments.length - 1].to.name);
  day.route = `${firstStop} → ${lastStop}`;

  // Calculate totals
  day.totals.distanceKm = day.segments.reduce((sum, s) => sum + s.distanceKm, 0);
  day.totals.driveTimeMinutes = day.segments.reduce((sum, s) => sum + s.durationMinutes, 0);
  day.totals.stopTimeMinutes = day.segments.reduce((sum, s) => sum + (s.stopDuration || 0), 0);

  // Get departure time. Priority:
  //   1. day.totals.departureTime from split-by-days (smart departure hour)
  //   2. firstSegment.departureTime (from route calculation)
  //   3. midnight placeholder from createTripDay (never correct — means the
  //      departure time was never computed)
  //
  // The midnight test catches the createTripDay placeholder: it's always at
  // 00:00:00 which causes stop times in generateSmartStops to fire before
  // the visible departure hour (e.g. fuel at 6:45 AM on a 10:00 AM departure).
  const firstSegment = day.segments[0];
  const currentDep = day.totals.departureTime;
  const isMidnightPlaceholder = currentDep && new Date(currentDep).getHours() === 0
    && new Date(currentDep).getMinutes() === 0 && new Date(currentDep).getSeconds() === 0;
  if (isMidnightPlaceholder && firstSegment?.departureTime) {
    day.totals.departureTime = firstSegment.departureTime;
  }

  // Re-stamp segment times based on the day's actual departure time.
  // This fixes stale times on multi-day trips where departure was adjusted.
  if (day.totals.departureTime) {
    let currentTimeMs = new Date(day.totals.departureTime).getTime();
    for (const segment of day.segments) {
      segment.departureTime = new Date(currentTimeMs).toISOString();
      currentTimeMs += segment.durationMinutes * 60 * 1000;
      segment.arrivalTime = new Date(currentTimeMs).toISOString();
      // Add stop duration for next segment's departure
      const stopMs = (segment.stopDuration ?? 0) * 60 * 1000;
      currentTimeMs += stopMs;
    }
  }

  // Compute day's arrival time from departure + total drive + stop time
  const departureSource = day.totals.departureTime || firstSegment?.departureTime;
  if (departureSource && day.totals.driveTimeMinutes > 0) {
    const depMs = new Date(departureSource).getTime();
    const totalMinutes = day.totals.driveTimeMinutes + day.totals.stopTimeMinutes;
    day.totals.arrivalTime = new Date(depMs + totalMinutes * 60 * 1000).toISOString();
  }

  // Calculate budget
  // TODO: Refactor — dual fuel model disconnect.
  // gasUsed here sums raw segment.fuelCost (mathematical L/km × price).
  // Stop suggestions display human fill amounts ($74 full fill, $41 top-up) which differ.
  // Both numbers appear in the same itinerary output, causing a ~$57 discrepancy on an
  // 8-day Winnipeg→Vancouver trip. Decision needed: reconcile to one model.
  // See: task.md for cleanup ticket.
  const gasUsed = day.segments.reduce((sum, s) => sum + s.fuelCost, 0);
  const hotelCost = day.overnight?.cost || 0;
  const mealsToday = estimateMealsForDay(day, settings);
  const foodEstimate = mealsToday * settings.mealPricePerDay / 3; // Per meal

  const roundedGas = ceilToNearest(gasUsed, 5);
  const roundedHotel = ceilToNearest(hotelCost, 5);
  const roundedFood = ceilToNearest(foodEstimate, 5);

  day.budget = {
    gasUsed: roundedGas,
    hotelCost: roundedHotel,
    foodEstimate: roundedFood,
    miscCost: 0,
    dayTotal: ceilToNearest(roundedGas + roundedHotel + roundedFood, 10),
    gasRemaining: Math.round((gasRemaining - gasUsed) * 100) / 100,
    hotelRemaining: Math.round((hotelRemaining - hotelCost) * 100) / 100,
    foodRemaining: Math.round((foodRemaining - foodEstimate) * 100) / 100,
  };
}

/**
 * Estimate number of meals needed for a day based on drive time and stops.
 */
export function estimateMealsForDay(day: TripDay, settings: TripSettings): number {
  const mealStops = day.segments.filter(s =>
    s.stopType === 'meal' || s.stopType === 'quickMeal'
  ).length;

  // At least count meal stops, plus estimate based on day length
  const driveHours = day.totals.driveTimeMinutes / 60;
  const estimatedMeals = Math.ceil(driveHours / 4); // One meal per 4 hours of travel

  return Math.max(mealStops, estimatedMeals) * settings.numTravelers;
}
