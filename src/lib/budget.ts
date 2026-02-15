import type {
  TripBudget,
  TripDay,
  TripSettings,
  RouteSegment,
  CostBreakdown,
} from '../types';

// Default budget values (CAD)
export const DEFAULT_BUDGET: TripBudget = {
  mode: 'open',
  gas: 0,
  hotel: 0,
  food: 0,
  misc: 0,
  total: 0,
};

// Average cost estimates for planning
export const COST_ESTIMATES = {
  hotelPerNight: {
    budget: 100,
    moderate: 150,
    comfort: 200,
  },
  mealPerDay: {
    budget: 30,
    moderate: 50,
    comfort: 75,
  },
  gasPerKm: 0.12, // Rough estimate at $1.50/L and 8L/100km
};

/**
 * Create a budget with smart defaults based on trip parameters
 */
export function createSmartBudget(
  totalDays: number,
  totalDistanceKm: number,
  numTravelers: number,
  settings: TripSettings
): TripBudget {
  const nights = Math.max(0, totalDays - 1);
  const roomsNeeded = Math.ceil(numTravelers / 2);

  // Estimate costs
  const gasEstimate = totalDistanceKm * COST_ESTIMATES.gasPerKm;
  const hotelEstimate = nights * roomsNeeded * settings.hotelPricePerNight;
  const foodEstimate = totalDays * numTravelers * settings.mealPricePerDay;

  return {
    mode: 'open',
    gas: Math.round(gasEstimate),
    hotel: Math.round(hotelEstimate),
    food: Math.round(foodEstimate),
    misc: 0,
    total: Math.round(gasEstimate + hotelEstimate + foodEstimate),
  };
}

/**
 * Split a trip into days based on max drive hours and overnight stops
 */
export function splitTripByDays(
  segments: RouteSegment[],
  settings: TripSettings,
  departureDate: string,
  departureTime: string
): TripDay[] {
  if (segments.length === 0) return [];

  const days: TripDay[] = [];
  let currentDay: TripDay | null = null;
  let currentDayDriveMinutes = 0;
  let currentDate = new Date(`${departureDate}T${departureTime}`);
  let dayNumber = 1;

  // Initialize running budget totals
  let gasRemaining = settings.budget.gas;
  let hotelRemaining = settings.budget.hotel;
  let foodRemaining = settings.budget.food;

  const maxDriveMinutes = settings.maxDriveHours * 60;

  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];

    // Start a new day if needed
    if (!currentDay) {
      currentDay = createEmptyDay(dayNumber, currentDate, settings);
    }

    const segmentDriveMinutes = segment.durationMinutes;
    const wouldExceedMaxDrive = currentDayDriveMinutes + segmentDriveMinutes > maxDriveMinutes;

    // Check if we need to start a new day (max drive hours exceeded)
    if (wouldExceedMaxDrive && currentDay.segments.length > 0) {
      // Finalize current day
      finalizeTripDay(currentDay, gasRemaining, hotelRemaining, foodRemaining, settings);

      // Update running totals
      gasRemaining -= currentDay.budget.gasUsed;
      hotelRemaining -= currentDay.budget.hotelCost;
      foodRemaining -= currentDay.budget.foodEstimate;

      days.push(currentDay);

      // Start new day (next morning after overnight)
      dayNumber++;
      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000); // Next day
      currentDate.setHours(9, 0, 0, 0); // Default 9 AM departure
      currentDay = createEmptyDay(dayNumber, currentDate, settings);
      currentDayDriveMinutes = 0;
    }

    // Add segment to current day
    currentDay.segments.push(segment);
    currentDay.segmentIndices.push(index);
    currentDayDriveMinutes += segmentDriveMinutes;

    // Check for timezone changes
    if (segment.timezoneCrossing && segment.weather?.timezoneAbbr) {
      const prevTimezone = index > 0
        ? segments[index - 1].weather?.timezoneAbbr || 'Unknown'
        : 'CDT'; // Default assumption

      currentDay.timezoneChanges.push({
        afterSegmentIndex: currentDay.segments.length - 1,
        fromTimezone: prevTimezone,
        toTimezone: segment.weather.timezoneAbbr,
        offset: getTimezoneOffset(prevTimezone, segment.weather.timezoneAbbr),
        message: `Enter ${getTimezoneName(segment.weather.timezoneAbbr)} (${
          getTimezoneOffset(prevTimezone, segment.weather.timezoneAbbr) > 0 ? 'gain' : 'lose'
        } 1 hour)`,
      });
    }

    // Check for overnight stop type
    if (segment.stopType === 'overnight') {
      const roomsNeeded = Math.ceil(settings.numTravelers / 2);
      currentDay.overnight = {
        location: segment.to,
        cost: roomsNeeded * settings.hotelPricePerNight,
        roomsNeeded,
      };
    }
  }

  // Finalize last day
  if (currentDay && currentDay.segments.length > 0) {
    finalizeTripDay(currentDay, gasRemaining, hotelRemaining, foodRemaining, settings);
    days.push(currentDay);
  }

  return days;
}

/**
 * Create an empty day structure
 */
function createEmptyDay(dayNumber: number, date: Date, _settings: TripSettings): TripDay {
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
 * Finalize a trip day with calculated totals
 */
function finalizeTripDay(
  day: TripDay,
  gasRemaining: number,
  hotelRemaining: number,
  foodRemaining: number,
  settings: TripSettings
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

  if (firstSegment?.departureTime) {
    day.totals.departureTime = firstSegment.departureTime;
  }
  if (lastSegment?.arrivalTime) {
    day.totals.arrivalTime = lastSegment.arrivalTime;
  }

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
 * Estimate number of meals needed for a day based on drive time and stops
 */
function estimateMealsForDay(day: TripDay, settings: TripSettings): number {
  const mealStops = day.segments.filter(s =>
    s.stopType === 'meal' || s.stopType === 'quickMeal'
  ).length;

  // At least count meal stops, plus estimate based on day length
  const driveHours = day.totals.driveTimeMinutes / 60;
  const estimatedMeals = Math.ceil(driveHours / 4); // One meal per 4 hours of travel

  return Math.max(mealStops, estimatedMeals) * settings.numTravelers;
}

/**
 * Calculate overall cost breakdown for the trip
 */
export function calculateCostBreakdown(
  days: TripDay[],
  numTravelers: number
): CostBreakdown {
  const fuel = days.reduce((sum, d) => sum + d.budget.gasUsed, 0);
  const accommodation = days.reduce((sum, d) => sum + d.budget.hotelCost, 0);
  const meals = days.reduce((sum, d) => sum + d.budget.foodEstimate, 0);
  const misc = days.reduce((sum, d) => sum + d.budget.miscCost, 0);
  const total = fuel + accommodation + meals + misc;

  return {
    fuel: Math.round(fuel * 100) / 100,
    accommodation: Math.round(accommodation * 100) / 100,
    meals: Math.round(meals * 100) / 100,
    misc: Math.round(misc * 100) / 100,
    total: Math.round(total * 100) / 100,
    perPerson: Math.round((total / numTravelers) * 100) / 100,
  };
}

/**
 * Determine budget status based on planned vs actual
 */
export function getBudgetStatus(
  budget: TripBudget,
  costBreakdown: CostBreakdown
): 'under' | 'at' | 'over' {
  if (budget.mode === 'open' || budget.total === 0) return 'under';

  const diff = budget.total - costBreakdown.total;
  if (diff > budget.total * 0.1) return 'under'; // More than 10% under
  if (diff < 0) return 'over';
  return 'at';
}

/**
 * Get timezone offset between two timezone abbreviations
 * Simplified for common North American timezones
 */
function getTimezoneOffset(from: string, to: string): number {
  const offsets: Record<string, number> = {
    'PST': -8, 'PDT': -7,
    'MST': -7, 'MDT': -6,
    'CST': -6, 'CDT': -5,
    'EST': -5, 'EDT': -4,
  };

  const fromOffset = offsets[from] || 0;
  const toOffset = offsets[to] || 0;
  return toOffset - fromOffset;
}

/**
 * Get full timezone name from abbreviation
 */
function getTimezoneName(abbr: string): string {
  const names: Record<string, string> = {
    'PST': 'Pacific Standard Time',
    'PDT': 'Pacific Daylight Time',
    'MST': 'Mountain Standard Time',
    'MDT': 'Mountain Daylight Time',
    'CST': 'Central Standard Time',
    'CDT': 'Central Daylight Time',
    'EST': 'Eastern Standard Time',
    'EDT': 'Eastern Daylight Time',
  };
  return names[abbr] || `${abbr} Time Zone`;
}

/**
 * Format currency amount with proper symbol
 */
export function formatCurrency(amount: number, _currency: 'CAD' | 'USD'): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Format budget remaining with status indicator
 */
export function formatBudgetRemaining(remaining: number): {
  text: string;
  status: 'good' | 'warning' | 'over';
} {
  if (remaining > 0) {
    return { text: `$${remaining.toFixed(0)} remaining`, status: 'good' };
  } else if (remaining === 0) {
    return { text: 'Budget reached', status: 'warning' };
  } else {
    return { text: `$${Math.abs(remaining).toFixed(0)} over`, status: 'over' };
  }
}
