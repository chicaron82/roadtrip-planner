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
    // Re-finalize the last driving day now that it has an overnight stop,
    // restoring the bank to what it was before this day ran (add back dayTotal).
    finalizeTripDay(
      lastDrivingDay,
      nextBudget.bankRemaining + lastDrivingDay.budget.dayTotal,
      settings,
      fuelStops,
    );
    nextBudget = { bankRemaining: lastDrivingDay.budget.bankRemaining };
  }

  for (let k = 1; k < gapDays; k++) {
    dayNumber++;
    const freeDate = new Date(lastDriveDate.getTime() + k * 24 * 60 * 60 * 1000);
    const freeDay = createEmptyDay(dayNumber, freeDate);
    const hotel = destination ? createDefaultOvernight(destination, settings) : undefined;
    const roundedHotel = ceilToNearest(hotel?.cost ?? 0, 5);
    const roundedFood = ceilToNearest(settings.mealPricePerDay * settings.numTravelers, 5);
    const dayTotal = roundedHotel + roundedFood;

    freeDay.route = `📍 ${destName}`;
    freeDay.dayType = 'free';
    freeDay.title = k === 1 ? 'Explore!' : `Day ${k} at ${destName}`;
    freeDay.budget = {
      gasUsed: 0,
      hotelCost: roundedHotel,
      foodEstimate: roundedFood,
      miscCost: 0,
      dayTotal,
      bankRemaining: Math.round((nextBudget.bankRemaining - dayTotal) * 100) / 100,
    };

    nextBudget = { bankRemaining: freeDay.budget.bankRemaining };
    if (hotel) {
      freeDay.overnight = { ...hotel, cost: roundedHotel };
    }

    days.push(freeDay);
  }

  return { dayNumber, budget: nextBudget };
}