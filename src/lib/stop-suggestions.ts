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
  warning?: string; // Sparse stretch warning
  dismissed?: boolean;
  accepted?: boolean;
}

export type StopFrequency = 'conservative' | 'balanced' | 'aggressive';

export interface StopSuggestionConfig {
  tankSizeLitres: number;
  fuelEconomyL100km: number;
  maxDriveHoursPerDay: number;
  numDrivers: number;
  departureTime: Date;
  gasPrice: number;
  fuelBuffer?: number; // Percent to keep in reserve (default 0.25)
  stopFrequency?: StopFrequency; // How often to suggest stops (default 'balanced')
}

/**
 * Generate smart stop suggestions based on route, vehicle, and settings
 */
export function generateSmartStops(
  segments: RouteSegment[],
  config: StopSuggestionConfig
): SuggestedStop[] {
  const suggestions: SuggestedStop[] = [];

  // Configuration based on stop frequency
  const stopFrequency = config.stopFrequency || 'balanced';

  const bufferMultipliers = {
    conservative: 0.30, // 30% buffer, stop earlier
    balanced: 0.25,     // 25% buffer
    aggressive: 0.20,   // 20% buffer, push further
  };

  const actualBuffer = bufferMultipliers[stopFrequency];

  // Calculate safe range (distance we can travel before needing fuel)
  const vehicleRangeKm = (config.tankSizeLitres / config.fuelEconomyL100km) * 100;
  const safeRangeKm = vehicleRangeKm * (1 - actualBuffer);

  // Track simulation state
  let currentFuel = config.tankSizeLitres;
  let distanceSinceLastFill = 0;
  let currentTime = new Date(config.departureTime);
  let hoursOnRoad = 0;
  let totalDrivingToday = 0;
  let lastBreakTime = new Date(config.departureTime);

  const REST_BREAK_INTERVAL = stopFrequency === 'conservative' ? 1.5 : stopFrequency === 'balanced' ? 2 : 2.5;
  const MEAL_TIMES = { breakfast: 8, lunch: 12, dinner: 18 }; // 24h format

  segments.forEach((segment, index) => {
    const segmentHours = segment.durationMinutes / 60;
    const fuelNeeded = segment.fuelNeededLitres || (segment.distanceKm / 100) * config.fuelEconomyL100km;

    // === FUEL STOP CHECK (using safe range approach) ===
    distanceSinceLastFill += segment.distanceKm;

    // Check if we've exceeded safe range OR will run critically low
    const wouldRunCriticallyLow = (currentFuel - fuelNeeded) < (config.tankSizeLitres * 0.15); // Critical: below 15%
    const exceededSafeRange = distanceSinceLastFill >= safeRangeKm;

    if (exceededSafeRange || wouldRunCriticallyLow) {
      const refillAmount = config.tankSizeLitres - currentFuel;
      const refillCost = refillAmount * config.gasPrice;
      const tankPercent = Math.round((currentFuel / config.tankSizeLitres) * 100);
      const litresRemaining = currentFuel.toFixed(1);

      let reason = '';
      if (wouldRunCriticallyLow) {
        reason = `Tank at ${tankPercent}% (${litresRemaining}L remaining). ~$${refillCost.toFixed(2)} to refill. Critical: refuel before continuing to ${segment.to.name}.`;
      } else {
        reason = `Tank at ${tankPercent}% (${litresRemaining}L remaining). ~$${refillCost.toFixed(2)} to refill. You've driven ${distanceSinceLastFill.toFixed(0)} km since last fill.`;
      }

      // Check if the next segment is a sparse stretch (> 150km)
      let sparseWarning: string | undefined;
      if (segment.distanceKm > 150) {
        const hoursForSegment = segment.durationMinutes / 60;
        sparseWarning = `⚠️ Heads up: Limited services for next ${segment.distanceKm.toFixed(0)} km (${hoursForSegment.toFixed(1)} hours). Fuel up and take a break before continuing.`;
      }

      suggestions.push({
        id: `fuel-${index}`,
        type: 'fuel',
        reason,
        afterSegmentIndex: index - 1, // Stop before this segment
        estimatedTime: new Date(currentTime),
        duration: 15,
        priority: wouldRunCriticallyLow ? 'required' : 'recommended',
        details: {
          fuelNeeded: refillAmount,
          fuelCost: refillCost,
        },
        warning: sparseWarning,
      });

      currentFuel = config.tankSizeLitres; // Simulated refill
      distanceSinceLastFill = 0; // Reset distance tracker
      currentTime = new Date(currentTime.getTime() + 15 * 60 * 1000); // Add 15 min
    }

    // === REST BREAK CHECK (every 2-3 hours) ===
    const hoursSinceBreak = (currentTime.getTime() - lastBreakTime.getTime()) / (1000 * 60 * 60);
    if (hoursSinceBreak >= REST_BREAK_INTERVAL && segmentHours > 0.5) {
      const numDriversText = config.numDrivers > 1 ? `${config.numDrivers} drivers` : 'solo driver';
      suggestions.push({
        id: `rest-${index}`,
        type: 'rest',
        reason: `${hoursSinceBreak.toFixed(1)} hours behind the wheel (${numDriversText}). Take a 15-minute break to stretch, use the restroom, and stay alert.`,
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
      const mealTime = currentHour < MEAL_TIMES.lunch ? '12:00 PM' : '6:00 PM';
      const totalHoursOnRoad = (hoursOnRoad + segmentHours).toFixed(1);
      suggestions.push({
        id: `meal-${mealType.toLowerCase()}-${index}`,
        type: 'meal',
        reason: `${mealType} break around ${mealTime}. You'll have driven ${totalHoursOnRoad} hours. Refuel yourself and your vehicle with a proper meal.`,
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
      const maxHoursText = config.maxDriveHoursPerDay === 1 ? '1 hour' : `${config.maxDriveHoursPerDay} hours`;
      suggestions.push({
        id: `overnight-${index}`,
        type: 'overnight',
        reason: `You've reached your daily driving limit (${totalDrivingToday.toFixed(1)} hours driven, max ${maxHoursText}/day). Find a hotel, get dinner, and recharge for tomorrow.`,
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
    stopFrequency: settings.stopFrequency,
  };
}
