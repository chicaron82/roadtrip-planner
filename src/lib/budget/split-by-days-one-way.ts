import type { TripDay, TripSettings } from '../../types';
import type { StrategicFuelStop } from '../fuel-stops';
import type { BudgetRemaining } from './split-by-days-policies';
import { createEmptyDay, finalizeTripDay, ceilToNearest } from './day-builder';
import { createDefaultOvernight } from './split-by-days-policies';

interface OneWayFreeDayParams {
  settings: TripSettings;
  fuelStops?: StrategicFuelStop[];
  dayNumber: number;
  days: TripDay[];
  budget: BudgetRemaining;
}

interface OneWayFreeDayResult {
  dayNumber: number;
  budget: BudgetRemaining;
}

export function insertOneWayDestinationFreeDays({
  settings,
  fuelStops,
  dayNumber,
  days,
  budget,
}: OneWayFreeDayParams): OneWayFreeDayResult {
  if (!settings.returnDate || !settings.departureDate || days.length === 0) {
    return { dayNumber, budget };
  }

  const lastDrivingDay = days[days.length - 1];
  const lastDriveDate = new Date(lastDrivingDay.date + 'T00:00:00');
  const returnDate = new Date(settings.returnDate + 'T00:00:00');
  const gapDays = Math.round((returnDate.getTime() - lastDriveDate.getTime()) / (1000 * 60 * 60 * 24));

  if (gapDays <= 1) {
    return { dayNumber, budget };
  }

  let nextBudget = { ...budget };
  const destination = lastDrivingDay.segments.length > 0
    ? lastDrivingDay.segments[lastDrivingDay.segments.length - 1].to
    : null;
  const destName = destination?.name || 'Destination';

  if (!lastDrivingDay.overnight && destination) {
    lastDrivingDay.overnight = createDefaultOvernight(destination, settings);
    nextBudget.hotelRemaining += lastDrivingDay.budget.hotelCost;
    nextBudget.gasRemaining += lastDrivingDay.budget.gasUsed;
    nextBudget.foodRemaining += lastDrivingDay.budget.foodEstimate;
    finalizeTripDay(
      lastDrivingDay,
      nextBudget.gasRemaining,
      nextBudget.hotelRemaining,
      nextBudget.foodRemaining,
      settings,
      fuelStops,
    );
    nextBudget = {
      gasRemaining: lastDrivingDay.budget.gasRemaining,
      hotelRemaining: lastDrivingDay.budget.hotelRemaining,
      foodRemaining: lastDrivingDay.budget.foodRemaining,
    };
  }

  for (let k = 1; k < gapDays; k++) {
    dayNumber++;
    const freeDate = new Date(lastDriveDate.getTime() + k * 24 * 60 * 60 * 1000);
    const freeDay = createEmptyDay(dayNumber, freeDate);
    const hotel = destination ? createDefaultOvernight(destination, settings) : undefined;
    const roundedHotel = ceilToNearest(hotel?.cost ?? 0, 5);
    const roundedFood = ceilToNearest(settings.mealPricePerDay * settings.numTravelers, 5);

    freeDay.route = `📍 ${destName}`;
    freeDay.dayType = 'free';
    freeDay.title = k === 1 ? 'Explore!' : `Day ${k} at ${destName}`;
    freeDay.budget = {
      gasUsed: 0,
      hotelCost: roundedHotel,
      foodEstimate: roundedFood,
      miscCost: 0,
      dayTotal: roundedHotel + roundedFood,
      gasRemaining: Math.round(nextBudget.gasRemaining * 100) / 100,
      hotelRemaining: Math.round((nextBudget.hotelRemaining - roundedHotel) * 100) / 100,
      foodRemaining: Math.round((nextBudget.foodRemaining - roundedFood) * 100) / 100,
    };

    nextBudget.hotelRemaining = freeDay.budget.hotelRemaining;
    nextBudget.foodRemaining = freeDay.budget.foodRemaining;
    if (hotel) {
      freeDay.overnight = { ...hotel, cost: roundedHotel };
    }

    days.push(freeDay);
  }

  return { dayNumber, budget: nextBudget };
}