import type { RouteSegment, Vehicle, TripSettings } from '../types';

export type StopType = 'fuel' | 'rest' | 'meal' | 'overnight';

export interface SuggestedStop {
  id: string;
  type: StopType;
  reason: string;
  afterSegmentIndex: number; // Insert after this segment
  estimatedTime: Date;
  duration: number; // minutes
  priority: 'required' | 'recommended' | 'optional';
  details: {
    fuelNeeded?: number; // litres
    fuelCost?: number;
    hoursOnRoad?: number; // hours driven before this stop
  };
  dismissed?: boolean;
  accepted?: boolean;
}

export interface StopSuggestionConfig {
  tankSizeLitres: number;
  fuelEconomyL100km: number;
  maxDriveHoursPerDay: number;
  numDrivers: number;
  departureTime: Date;
  gasPrice: number;
}

/**
 * Generate smart stop suggestions based on route, vehicle, and settings
 */
export function generateSmartStops(
  segments: RouteSegment[],
  config: StopSuggestionConfig
): SuggestedStop[] {
  const suggestions: SuggestedStop[] = [];

  // Track simulation state
  let currentFuel = config.tankSizeLitres;
  let currentTime = new Date(config.departureTime);
  let hoursOnRoad = 0;
  let totalDrivingToday = 0;
  let lastBreakTime = new Date(config.departureTime);

  const FUEL_WARNING_THRESHOLD = config.tankSizeLitres * 0.20; // 20% remaining
  const REST_BREAK_INTERVAL = 2; // hours
  const MEAL_TIMES = { breakfast: 8, lunch: 12, dinner: 18 }; // 24h format

  segments.forEach((segment, index) => {
    const segmentHours = segment.durationMinutes / 60;
    const fuelNeeded = segment.fuelNeededLitres || (segment.distanceKm / 100) * config.fuelEconomyL100km;

    // === FUEL STOP CHECK ===
    if (currentFuel - fuelNeeded < FUEL_WARNING_THRESHOLD) {
      const refillAmount = config.tankSizeLitres - currentFuel;
      const refillCost = refillAmount * config.gasPrice;

      suggestions.push({
        id: `fuel-${index}`,
        type: 'fuel',
        reason: `Tank will be at ${Math.round((currentFuel / config.tankSizeLitres) * 100)}% - refuel needed before ${segment.to.name}`,
        afterSegmentIndex: index - 1, // Stop before this segment
        estimatedTime: new Date(currentTime),
        duration: 15,
        priority: 'required',
        details: {
          fuelNeeded: refillAmount,
          fuelCost: refillCost,
        },
      });

      currentFuel = config.tankSizeLitres; // Simulated refill
      currentTime = new Date(currentTime.getTime() + 15 * 60 * 1000); // Add 15 min
    }

    // === REST BREAK CHECK (every 2-3 hours) ===
    const hoursSinceBreak = (currentTime.getTime() - lastBreakTime.getTime()) / (1000 * 60 * 60);
    if (hoursSinceBreak >= REST_BREAK_INTERVAL && segmentHours > 0.5) {
      suggestions.push({
        id: `rest-${index}`,
        type: 'rest',
        reason: `${hoursSinceBreak.toFixed(1)} hours since last break - stretch and refresh`,
        afterSegmentIndex: index - 1,
        estimatedTime: new Date(currentTime),
        duration: 15,
        priority: 'recommended',
        details: {
          hoursOnRoad: hoursOnRoad,
        },
      });

      lastBreakTime = new Date(currentTime);
      currentTime = new Date(currentTime.getTime() + 15 * 60 * 1000);
    }

    // === MEAL STOP CHECK ===
    const currentHour = currentTime.getHours();
    const nextHour = new Date(currentTime.getTime() + segment.durationMinutes * 60 * 1000).getHours();

    // Check if we'll pass through a meal time during this segment
    if (
      (currentHour < MEAL_TIMES.lunch && nextHour >= MEAL_TIMES.lunch) ||
      (currentHour < MEAL_TIMES.dinner && nextHour >= MEAL_TIMES.dinner)
    ) {
      const mealType = currentHour < MEAL_TIMES.lunch ? 'Lunch' : 'Dinner';
      suggestions.push({
        id: `meal-${mealType.toLowerCase()}-${index}`,
        type: 'meal',
        reason: `${mealType} time - good opportunity to eat and recharge`,
        afterSegmentIndex: index,
        estimatedTime: new Date(currentTime.getTime() + segment.durationMinutes * 60 * 1000),
        duration: 45,
        priority: 'optional',
        details: {
          hoursOnRoad: hoursOnRoad + segmentHours,
        },
      });
    }

    // === OVERNIGHT STOP CHECK ===
    totalDrivingToday += segmentHours;
    if (totalDrivingToday >= config.maxDriveHoursPerDay) {
      suggestions.push({
        id: `overnight-${index}`,
        type: 'overnight',
        reason: `${totalDrivingToday.toFixed(1)} hours of driving today - time to rest for the night`,
        afterSegmentIndex: index,
        estimatedTime: new Date(currentTime.getTime() + segment.durationMinutes * 60 * 1000),
        duration: 8 * 60, // 8 hours
        priority: 'required',
        details: {
          hoursOnRoad: hoursOnRoad + segmentHours,
        },
      });

      totalDrivingToday = 0; // Reset for next day
      // Move to next morning (8 AM)
      const nextDay = new Date(currentTime);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(8, 0, 0, 0);
      currentTime = nextDay;
      lastBreakTime = new Date(currentTime);
    }

    // Update state for next segment
    currentFuel -= fuelNeeded;
    hoursOnRoad += segmentHours;
    currentTime = new Date(currentTime.getTime() + segment.durationMinutes * 60 * 1000);
  });

  // Deduplicate and consolidate stops that are too close together
  return consolidateStops(suggestions);
}

/**
 * Consolidate stops that are too close together (within 30 minutes)
 */
function consolidateStops(stops: SuggestedStop[]): SuggestedStop[] {
  if (stops.length <= 1) return stops;

  const consolidated: SuggestedStop[] = [];
  let i = 0;

  while (i < stops.length) {
    const current = stops[i];
    const next = stops[i + 1];

    if (next && current.afterSegmentIndex === next.afterSegmentIndex) {
      // Merge stops at the same location - prioritize fuel and overnight
      const merged: SuggestedStop = {
        ...current,
        id: `merged-${current.id}-${next.id}`,
        type: current.type === 'fuel' || next.type === 'fuel' ? 'fuel' :
              current.type === 'overnight' || next.type === 'overnight' ? 'overnight' : current.type,
        reason: `${current.reason}. Also: ${next.reason}`,
        duration: Math.max(current.duration, next.duration),
        priority: current.priority === 'required' || next.priority === 'required' ? 'required' :
                  current.priority === 'recommended' || next.priority === 'recommended' ? 'recommended' : 'optional',
        details: { ...current.details, ...next.details },
      };
      consolidated.push(merged);
      i += 2;
    } else {
      consolidated.push(current);
      i++;
    }
  }

  return consolidated;
}

/**
 * Get stop icon emoji
 */
export function getStopIcon(type: StopType): string {
  switch (type) {
    case 'fuel': return '⛽';
    case 'rest': return '☕';
    case 'meal': return '🍽️';
    case 'overnight': return '🏨';
    default: return '📍';
  }
}

/**
 * Get stop color scheme
 */
export function getStopColors(type: StopType): { bg: string; border: string; text: string } {
  switch (type) {
    case 'fuel':
      return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' };
    case 'rest':
      return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' };
    case 'meal':
      return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' };
    case 'overnight':
      return { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' };
    default:
      return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700' };
  }
}

/**
 * Convert settings to config
 */
export function createStopConfig(
  vehicle: Vehicle,
  settings: TripSettings
): StopSuggestionConfig {
  // Convert to metric if needed
  const tankSizeLitres = settings.units === 'metric'
    ? vehicle.tankSize
    : vehicle.tankSize * 3.78541;

  const fuelEconomyL100km = settings.units === 'metric'
    ? vehicle.fuelEconomyHwy * 0.8 + vehicle.fuelEconomyCity * 0.2
    : (235.215 / vehicle.fuelEconomyHwy) * 0.8 + (235.215 / vehicle.fuelEconomyCity) * 0.2;

  return {
    tankSizeLitres,
    fuelEconomyL100km,
    maxDriveHoursPerDay: settings.maxDriveHours,
    numDrivers: settings.numDrivers,
    departureTime: new Date(`${settings.departureDate}T${settings.departureTime}`),
    gasPrice: settings.gasPrice,
  };
}
