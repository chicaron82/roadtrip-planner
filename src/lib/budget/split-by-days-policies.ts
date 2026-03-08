import type { Location, OvernightStop, TripDay, TripSettings } from '../../types';
import type { ProcessedSegment } from './segment-processor';
import { TRIP_CONSTANTS } from '../trip-constants';
import { getHotelMultiplier } from '../regional-costs';

export interface BudgetRemaining {
  gasRemaining: number;
  hotelRemaining: number;
  foodRemaining: number;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatHour(hour: number): string {
  return `${pad2(hour)}:00`;
}

export function deriveBudgetRemaining(settings: TripSettings): BudgetRemaining {
  const { budget } = settings;
  const hasExplicitCategoryBudgets = budget.gas > 0 || budget.hotel > 0 || budget.food > 0;

  return {
    gasRemaining: hasExplicitCategoryBudgets
      ? budget.gas
      : budget.total > 0 ? budget.total * budget.weights.gas / 100 : 0,
    hotelRemaining: hasExplicitCategoryBudgets
      ? budget.hotel
      : budget.total > 0 ? budget.total * budget.weights.hotel / 100 : 0,
    foodRemaining: hasExplicitCategoryBudgets
      ? budget.food
      : budget.total > 0 ? budget.total * budget.weights.food / 100 : 0,
  };
}

export function getEffectiveMaxDriveMinutes(maxDriveMinutes: number): number {
  return maxDriveMinutes + TRIP_CONSTANTS.dayOverflow.toleranceHours * 60;
}

/**
 * Compute the ideal departure hour for a transit day so the crew arrives by
 * `settings.targetArrivalHour`, scaled to how much driving is actually left.
 */
export function computeSmartDepartureHour(settings: TripSettings, actualDriveHours: number): number {
  const { targetArrivalHour = 21, maxDriveHours } = settings;
  const isFullDay = actualDriveHours >= maxDriveHours * TRIP_CONSTANTS.departure.fullDayThreshold;
  const maxDeparture = isFullDay
    ? TRIP_CONSTANTS.departure.maxHourFullDay
    : TRIP_CONSTANTS.departure.maxHourShortLeg;

  return Math.max(
    TRIP_CONSTANTS.departure.minHour,
    Math.min(maxDeparture, Math.floor(targetArrivalHour - actualDriveHours)),
  );
}

export function getNextDayDriveMinutes(
  segments: ProcessedSegment[],
  fromIndex: number,
  maxDriveMinutes: number,
): number {
  let accumulated = 0;
  for (let i = fromIndex; i < segments.length; i++) {
    const minutes = segments[i].durationMinutes;
    if (accumulated > 0 && accumulated + minutes > maxDriveMinutes) break;
    accumulated += minutes;
  }
  return accumulated;
}

export function getOverflowToleranceMinutes(
  settings: TripSettings,
  isLastLeg: boolean,
  completedDays: TripDay[],
): number {
  const { dayOverflow } = TRIP_CONSTANTS;
  const base = dayOverflow.toleranceHours * 60;
  const driverBonus = settings.numDrivers >= 2 ? dayOverflow.multiDriverBonusMinutes : 0;
  const lastLegBonus = isLastLeg ? dayOverflow.lastLegBonusMinutes : 0;

  let streak = 1;
  for (let j = completedDays.length - 1; j >= 0; j--) {
    if (completedDays[j].dayType === 'free') break;
    streak++;
  }

  const fatiguePenalty = streak >= dayOverflow.fatigueDayThreshold
    ? dayOverflow.fatiguePenaltyMinutes
    : 0;

  return Math.min(
    dayOverflow.maxToleranceMinutes,
    base + driverBonus + lastLegBonus - fatiguePenalty,
  );
}

export function createDefaultOvernight(location: Location, settings: TripSettings): OvernightStop {
  const roomsNeeded = Math.ceil(settings.numTravelers / 2);
  return {
    location,
    accommodationType: 'hotel',
    cost: roomsNeeded * getHotelMultiplier(location.name) * settings.hotelPricePerNight,
    roomsNeeded,
  };
}

/** Minimum hours of rest guaranteed between estimated Day-N arrival and Day-(N+1) departure. */
export const MIN_REST_HOURS = TRIP_CONSTANTS.rest.minHours;