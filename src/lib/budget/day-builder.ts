import type { TripDay, TripSettings } from '../../types';

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

  // Get departure time - prefer day-level (set by split-by-days), fall back to first segment
  const firstSegment = day.segments[0];
  if (firstSegment?.departureTime && !day.totals.departureTime) {
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
