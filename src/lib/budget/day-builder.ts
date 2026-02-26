import type { TripDay, TripSettings } from '../../types';

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

  // Calculate route string
  const firstStop = day.segments[0].from.name;
  const lastStop = day.segments[day.segments.length - 1].to.name;
  day.route = `${firstStop} → ${lastStop}`;

  // Calculate totals
  day.totals.distanceKm = day.segments.reduce((sum, s) => sum + s.distanceKm, 0);
  day.totals.driveTimeMinutes = day.segments.reduce((sum, s) => sum + s.durationMinutes, 0);
  day.totals.stopTimeMinutes = day.segments.reduce((sum, s) => sum + (s.stopDuration || 0), 0);

  // Get departure and arrival times from segments
  const firstSegment = day.segments[0];
  const lastSegment = day.segments[day.segments.length - 1];

  // Use segment times only if not already stamped (day-splits stamp intended departure above)
  if (firstSegment?.departureTime && !day.totals.departureTime) {
    day.totals.departureTime = firstSegment.departureTime;
  }

  // Compute arrival time from departure time + drive duration + stop time.
  // Don't use lastSegment.arrivalTime directly — it may be stale for multi-day
  // trips where the day's departure time was adjusted (e.g., after free days).
  const departureSource = day.totals.departureTime || firstSegment?.departureTime;
  if (departureSource && day.totals.driveTimeMinutes > 0) {
    const depMs = new Date(departureSource).getTime();
    const totalMinutes = day.totals.driveTimeMinutes + day.totals.stopTimeMinutes;
    day.totals.arrivalTime = new Date(depMs + totalMinutes * 60 * 1000).toISOString();
  }
  // No fallback to stale segment.arrivalTime - if we can't compute, leave undefined

  // Calculate budget
  const gasUsed = day.segments.reduce((sum, s) => sum + s.fuelCost, 0);
  const hotelCost = day.overnight?.cost || 0;
  const mealsToday = estimateMealsForDay(day, settings);
  const foodEstimate = mealsToday * settings.mealPricePerDay / 3; // Per meal

  day.budget = {
    gasUsed: Math.round(gasUsed * 100) / 100,
    hotelCost,
    foodEstimate: Math.round(foodEstimate * 100) / 100,
    miscCost: 0,
    dayTotal: Math.round((gasUsed + hotelCost + foodEstimate) * 100) / 100,
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
