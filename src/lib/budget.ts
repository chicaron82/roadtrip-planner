import type {
  TripBudget,
  TripDay,
  TripSettings,
  RouteSegment,
  CostBreakdown,
  BudgetProfile,
  BudgetWeights,
} from '../types';

// ==================== BUDGET WEIGHT PROFILES ====================
// Each profile shifts where your money goes

export const BUDGET_PROFILES: Record<BudgetProfile, { weights: BudgetWeights; label: string; emoji: string; description: string }> = {
  balanced: {
    weights: { gas: 25, hotel: 35, food: 30, misc: 10 },
    label: 'Balanced',
    emoji: '⚖️',
    description: 'Even split across all categories',
  },
  foodie: {
    weights: { gas: 20, hotel: 20, food: 50, misc: 10 },
    label: 'Foodie',
    emoji: '🍜',
    description: 'Eat like royalty, sleep like a backpacker',
  },
  scenic: {
    weights: { gas: 35, hotel: 35, food: 20, misc: 10 },
    label: 'Scenic',
    emoji: '🏔️',
    description: 'More driving, nicer views, cozy stays',
  },
  backpacker: {
    weights: { gas: 35, hotel: 25, food: 25, misc: 15 },
    label: 'Backpacker',
    emoji: '🎒',
    description: 'Stretch every dollar, maximize adventure',
  },
  comfort: {
    weights: { gas: 20, hotel: 45, food: 25, misc: 10 },
    label: 'Comfort',
    emoji: '✨',
    description: 'Splurge on nice hotels, relax in style',
  },
  custom: {
    weights: { gas: 25, hotel: 35, food: 30, misc: 10 },
    label: 'Custom',
    emoji: '🎛️',
    description: 'Set your own priorities',
  },
};

// Default budget values (CAD)
export const DEFAULT_BUDGET: TripBudget = {
  mode: 'open',
  allocation: 'flexible',
  profile: 'balanced',
  weights: BUDGET_PROFILES.balanced.weights,
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
 * Apply weight profile to a total budget amount
 * Returns category amounts based on percentage weights
 */
export function applyBudgetWeights(total: number, weights: BudgetWeights): Pick<TripBudget, 'gas' | 'hotel' | 'food' | 'misc'> {
  const gas = Math.round(total * (weights.gas / 100));
  const hotel = Math.round(total * (weights.hotel / 100));
  const food = Math.round(total * (weights.food / 100));
  const misc = total - gas - hotel - food; // Absorb rounding remainder
  return { gas, hotel, food, misc };
}

/**
 * Calculate per-person cost
 */
export function getPerPersonCost(total: number, numTravelers: number): number {
  return numTravelers > 0 ? Math.round(total / numTravelers) : 0;
}

/**
 * Create a budget with smart defaults based on trip parameters
 */
export function createSmartBudget(
  totalDays: number,
  totalDistanceKm: number,
  numTravelers: number,
  settings: TripSettings,
  plannedNights?: number, // explicit overnight stops; defaults to totalDays - 1 if omitted
): TripBudget {
  const nights = plannedNights !== undefined
    ? plannedNights
    : Math.max(0, totalDays - 1);
  const roomsNeeded = Math.ceil(numTravelers / 2);

  // Estimate costs
  const gasEstimate = totalDistanceKm * COST_ESTIMATES.gasPerKm;
  const hotelEstimate = nights * roomsNeeded * settings.hotelPricePerNight;
  const foodEstimate = totalDays * numTravelers * settings.mealPricePerDay;
  const total = Math.round(gasEstimate + hotelEstimate + foodEstimate);

  // Calculate actual weights based on estimates (misc absorbs rounding remainder)
  let weights: BudgetWeights;
  if (total > 0) {
    const gasW = Math.round((gasEstimate / total) * 100);
    const hotelW = Math.round((hotelEstimate / total) * 100);
    const foodW = Math.round((foodEstimate / total) * 100);
    weights = { gas: gasW, hotel: hotelW, food: foodW, misc: 100 - gasW - hotelW - foodW };
  } else {
    weights = BUDGET_PROFILES.balanced.weights;
  }

  return {
    mode: 'open',
    allocation: 'flexible',
    profile: 'balanced',
    weights,
    gas: Math.round(gasEstimate),
    hotel: Math.round(hotelEstimate),
    food: Math.round(foodEstimate),
    misc: 0,
    total,
  };
}

/**
 * Split a trip into days based on max drive hours and overnight stops.
 * For round trips with a returnDate, free days are inserted at the destination
 * (between outbound and return legs) rather than at the end.
 *
 * @param roundTripMidpoint - Segment index where outbound ends and return begins.
 *   When set, free days are inserted at this boundary.
 */
export function splitTripByDays(
  segments: RouteSegment[],
  settings: TripSettings,
  departureDate: string,
  departureTime: string,
  roundTripMidpoint?: number
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

  // Track whether we've inserted the destination free days
  let insertedFreeDays = false;

  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];

    // === INSERT FREE DAYS AT ROUND-TRIP MIDPOINT ===
    if (
      !insertedFreeDays &&
      roundTripMidpoint !== undefined &&
      index === roundTripMidpoint &&
      settings.returnDate &&
      settings.departureDate
    ) {
      // Finalize outbound's last day before inserting free days
      if (currentDay && currentDay.segments.length > 0) {
        finalizeTripDay(currentDay, gasRemaining, hotelRemaining, foodRemaining, settings);
        gasRemaining -= currentDay.budget.gasUsed;
        hotelRemaining -= currentDay.budget.hotelCost;
        foodRemaining -= currentDay.budget.foodEstimate;
        days.push(currentDay);
        currentDay = null;
        currentDayDriveMinutes = 0;
      }

      // Calculate how many total calendar days the trip spans (inclusive of departure and return)
      const departureDateObj = new Date(settings.departureDate + 'T00:00:00');
      const returnDateObj = new Date(settings.returnDate + 'T00:00:00');
      const totalTripDays = Math.max(1, Math.round((returnDateObj.getTime() - departureDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      // Outbound driving days already consumed
      const outboundDrivingDays = days.length;
      // Return driving will be approximately the same as outbound
      const returnDrivingDays = outboundDrivingDays;
      // Free days = total trip days - outbound driving - return driving
      const freeDaysCount = Math.max(0, totalTripDays - outboundDrivingDays - returnDrivingDays);

      if (freeDaysCount > 0) {
        // Destination is the last stop of the outbound leg
        const lastOutboundDay = days[days.length - 1];
        const destination = lastOutboundDay.segments.length > 0
          ? lastOutboundDay.segments[lastOutboundDay.segments.length - 1].to
          : null;
        const destName = destination?.name || 'Destination';

        for (let i = 0; i < freeDaysCount; i++) {
          dayNumber++;
          const lastDay = days[days.length - 1];
          const freeDate = new Date(new Date(lastDay.date + 'T09:00:00').getTime() + 24 * 60 * 60 * 1000);
          const freeDay = createEmptyDay(dayNumber, freeDate);
          freeDay.route = `📍 ${destName}`;
          freeDay.dayType = 'free';
          freeDay.title = i === 0 ? 'Explore!' : `Day ${i + 1} at ${destName}`;

          const roomsNeeded = Math.ceil(settings.numTravelers / 2);
          const hotelCost = roomsNeeded * settings.hotelPricePerNight;
          const foodCost = settings.mealPricePerDay * settings.numTravelers;

          hotelRemaining -= hotelCost;
          foodRemaining -= foodCost;

          freeDay.budget = {
            gasUsed: 0,
            hotelCost,
            foodEstimate: Math.round(foodCost * 100) / 100,
            miscCost: 0,
            dayTotal: Math.round((hotelCost + foodCost) * 100) / 100,
            gasRemaining: Math.round(gasRemaining * 100) / 100,
            hotelRemaining: Math.round(hotelRemaining * 100) / 100,
            foodRemaining: Math.round(foodRemaining * 100) / 100,
          };

          if (destination) {
            freeDay.overnight = {
              location: destination,
              cost: hotelCost,
              roomsNeeded,
            };
          }

          days.push(freeDay);
          currentDate = freeDate;
        }
      }

      insertedFreeDays = true;

      // Set up for the return leg — next morning after free days
      dayNumber++;
      currentDate = new Date(new Date(days[days.length - 1].date + 'T09:00:00').getTime() + 24 * 60 * 60 * 1000);
      currentDate.setHours(9, 0, 0, 0);
      currentDay = createEmptyDay(dayNumber, currentDate);
      currentDay.totals.departureTime = currentDate.toISOString(); // Stamp 9 AM — return leg departure
      currentDayDriveMinutes = 0;
    }

    // Start a new day if needed
    if (!currentDay) {
      currentDay = createEmptyDay(dayNumber, currentDate);
    }

    const segmentDriveMinutes = segment.durationMinutes;
    const wouldExceedMaxDrive = currentDayDriveMinutes + segmentDriveMinutes > maxDriveMinutes;
    // We also trigger a new day *after* this segment if it's an explicit overnight stop
    const isOvernightStop = segment.stopType === 'overnight';

    // Check for overnight stop type BEFORE adding to day, but wait wait wait
    // We add it to the CURRENT day, so the segment belongs to this day.
    
    // Check if we need to start a new day (max drive hours exceeded)
    // However, if the CURRENT segment is an overnight stop, we add it to THIS day, and then force a new day AFTER.
    // The overnight belongs to the day you drove — you check in at end of Day 1, so Day 1 pays for it.
    if (wouldExceedMaxDrive && currentDay.segments.length > 0 && !isOvernightStop) {
      // Finalize current day
      finalizeTripDay(currentDay, gasRemaining, hotelRemaining, foodRemaining, settings);

      // Update running totals
      gasRemaining -= currentDay.budget.gasUsed;
      hotelRemaining -= currentDay.budget.hotelCost;
      foodRemaining -= currentDay.budget.foodEstimate;

      days.push(currentDay);

      // Start new day — stamp intended 9 AM departure before any segments are added
      dayNumber++;
      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000); // Next day
      currentDate.setHours(9, 0, 0, 0); // Default 9 AM departure
      currentDay = createEmptyDay(dayNumber, currentDate);
      currentDay.totals.departureTime = currentDate.toISOString(); // Override segment chain time
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
    if (isOvernightStop) {
      const roomsNeeded = Math.ceil(settings.numTravelers / 2);
      currentDay.overnight = {
        location: segment.to,
        cost: roomsNeeded * settings.hotelPricePerNight,
        roomsNeeded,
      };

      // Force a day boundary AFTER this segment
      // Finalize current day consisting of segments up to this overnight stop
      finalizeTripDay(currentDay, gasRemaining, hotelRemaining, foodRemaining, settings);

      gasRemaining -= currentDay.budget.gasUsed;
      hotelRemaining -= currentDay.budget.hotelCost;
      foodRemaining -= currentDay.budget.foodEstimate;

      days.push(currentDay);

      // Set up next day
      dayNumber++;
      // If the segment has an arrival time, the next day starts the morning after
      const arrivalBase = segment.arrivalTime ? new Date(segment.arrivalTime) : currentDate;
      currentDate = new Date(arrivalBase.getTime());
      
      // If it's earlier than 9 AM, maybe it's the same morning. Generally, advance 1 day if we stopped overnight.
      // But `calculateArrivalTimes` already factored in the 8 hour stop.
      // Easiest is to force it to the next calendar morning.
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(9, 0, 0, 0); 
      
      currentDay = createEmptyDay(dayNumber, currentDate);
      currentDay.totals.departureTime = currentDate.toISOString();
      currentDayDriveMinutes = 0;
    }
  }

  // Finalize last day
  if (currentDay && currentDay.segments.length > 0) {
    finalizeTripDay(currentDay, gasRemaining, hotelRemaining, foodRemaining, settings);
    days.push(currentDay);
  }

  // Insert free days at destination for ONE-WAY trips only
  // (Round trips handle free days at the midpoint above)
  if (!insertedFreeDays && settings.returnDate && settings.departureDate && days.length > 0) {
    const lastDrivingDay = days[days.length - 1];
    const lastDriveDate = new Date(lastDrivingDay.date + 'T00:00:00');
    const returnDate = new Date(settings.returnDate + 'T00:00:00');
    const gapDays = Math.round((returnDate.getTime() - lastDriveDate.getTime()) / (1000 * 60 * 60 * 24));

    if (gapDays > 1) {
      // Determine destination name from the last segment's endpoint
      const destination = lastDrivingDay.segments.length > 0
        ? lastDrivingDay.segments[lastDrivingDay.segments.length - 1].to
        : null;
      const destName = destination?.name || 'Destination';

      for (let i = 1; i < gapDays; i++) {
        dayNumber++;
        const freeDate = new Date(lastDriveDate.getTime() + i * 24 * 60 * 60 * 1000);
        const freeDay = createEmptyDay(dayNumber, freeDate);
        freeDay.route = `📍 ${destName}`;
        freeDay.dayType = 'free';
        freeDay.title = i === 1 ? 'Explore!' : `Day ${i} at ${destName}`;

        // Budget: food + hotel for free days (no gas)
        const roomsNeeded = Math.ceil(settings.numTravelers / 2);
        const hotelCost = roomsNeeded * settings.hotelPricePerNight;
        const foodCost = settings.mealPricePerDay * settings.numTravelers;

        hotelRemaining -= hotelCost;
        foodRemaining -= foodCost;

        freeDay.budget = {
          gasUsed: 0,
          hotelCost,
          foodEstimate: Math.round(foodCost * 100) / 100,
          miscCost: 0,
          dayTotal: Math.round((hotelCost + foodCost) * 100) / 100,
          gasRemaining: Math.round(gasRemaining * 100) / 100,
          hotelRemaining: Math.round(hotelRemaining * 100) / 100,
          foodRemaining: Math.round(foodRemaining * 100) / 100,
        };

        if (destination) {
          freeDay.overnight = {
            location: destination,
            cost: hotelCost,
            roomsNeeded,
          };
        }

        days.push(freeDay);
      }
    }
  }

  return days;
}

/**
 * Create an empty day structure
 */
function createEmptyDay(dayNumber: number, date: Date): TripDay {
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

  // Use segment times only if not already stamped (day-splits stamp intended departure above)
  if (firstSegment?.departureTime && !day.totals.departureTime) {
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
    perPerson: numTravelers > 0 ? Math.round((total / numTravelers) * 100) / 100 : Math.round(total * 100) / 100,
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
