import type { RouteSegment, TripDay, TripSettings } from '../../types';
import type { StrategicFuelStop } from '../fuel-stops';
import type { BudgetRemaining } from './split-by-days-policies';
import type { ProcessedSegment } from './segment-processor';
import { createEmptyDay, finalizeTripDay, ceilToNearest, labelTransitDay } from './day-builder';
import { lngToIANA, parseLocalDateInTZ } from '../trip-timezone';
import {
  computeSmartDepartureHour,
  createDefaultOvernight,
  formatHour,
  getNextDayDriveMinutes,
  MIN_REST_HOURS,
} from './split-by-days-policies';

interface RoundTripMidpointParams {
  processedSegments: ProcessedSegment[];
  segmentIndex: number;
  roundTripMidpoint?: number;
  originalSegments: RouteSegment[];
  settings: TripSettings;
  maxDriveMinutes: number;
  effectiveMaxDriveMinutes: number;
  fuelStops?: StrategicFuelStop[];
  days: TripDay[];
  currentDay: TripDay | null;
  currentDayDriveMinutes: number;
  currentDate: Date;
  dayNumber: number;
  insertedFreeDays: boolean;
  budget: BudgetRemaining;
}

interface RoundTripMidpointResult {
  currentDay: TripDay | null;
  currentDayDriveMinutes: number;
  currentDate: Date;
  dayNumber: number;
  insertedFreeDays: boolean;
  budget: BudgetRemaining;
}

function isRoundTripDayTrip(
  processedSegments: ProcessedSegment[],
  effectiveMaxDriveMinutes: number,
  settings: TripSettings,
): boolean {
  const totalRoundTripMinutes = processedSegments.reduce((sum, segment) => sum + segment.durationMinutes, 0);
  const calendarDays = (settings.returnDate && settings.departureDate)
    ? Math.max(1, Math.round(
        (new Date(settings.returnDate + 'T00:00:00').getTime() -
         new Date(settings.departureDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : 1;

  return totalRoundTripMinutes <= effectiveMaxDriveMinutes && calendarDays <= 1;
}

export function maybeInsertRoundTripMidpointDays({
  processedSegments,
  segmentIndex,
  roundTripMidpoint,
  originalSegments,
  settings,
  maxDriveMinutes,
  effectiveMaxDriveMinutes,
  fuelStops,
  days,
  currentDay,
  currentDayDriveMinutes,
  currentDate,
  dayNumber,
  insertedFreeDays,
  budget,
}: RoundTripMidpointParams): RoundTripMidpointResult {
  const segment = processedSegments[segmentIndex];

  if (
    insertedFreeDays ||
    roundTripMidpoint === undefined ||
    isRoundTripDayTrip(processedSegments, effectiveMaxDriveMinutes, settings) ||
    segment._originalIndex !== roundTripMidpoint ||
    (segmentIndex > 0 && processedSegments[segmentIndex - 1]._originalIndex >= roundTripMidpoint)
  ) {
    return {
      currentDay,
      currentDayDriveMinutes,
      currentDate,
      dayNumber,
      insertedFreeDays,
      budget,
    };
  }

  const outboundDriveMinutesSnapshot = currentDayDriveMinutes;
  let nextBudget = { ...budget };

  if (currentDay && currentDay.segments.length > 0) {
    const lastSeg = currentDay.segments[currentDay.segments.length - 1];
    if (!currentDay.overnight && lastSeg) {
      currentDay.overnight = createDefaultOvernight(lastSeg.to, settings);
    }

    finalizeTripDay(
      currentDay,
      nextBudget.gasRemaining,
      nextBudget.hotelRemaining,
      nextBudget.foodRemaining,
      settings,
      fuelStops,
    );
    labelTransitDay(currentDay, originalSegments);
    nextBudget = {
      gasRemaining: currentDay.budget.gasRemaining,
      hotelRemaining: currentDay.budget.hotelRemaining,
      foodRemaining: currentDay.budget.foodRemaining,
    };
    days.push(currentDay);
    currentDay = null;
    currentDayDriveMinutes = 0;
  }

  const outboundArrivalMs = currentDate.getTime() + outboundDriveMinutesSnapshot * 60 * 1000;
  const arrivalLocalDate = new Date(outboundArrivalMs);
  const outboundArrivalDateStr = [
    arrivalLocalDate.getFullYear(),
    String(arrivalLocalDate.getMonth() + 1).padStart(2, '0'),
    String(arrivalLocalDate.getDate()).padStart(2, '0'),
  ].join('-');
  const outboundArrivalBase = new Date(outboundArrivalDateStr + 'T09:00:00');

  const arrivalHour = new Date(outboundArrivalMs).getHours();
  const arrivalDayIsFree = arrivalHour < 12 && outboundArrivalDateStr > (settings.departureDate ?? '');
  const departureDateMidnight = new Date((settings.departureDate ?? outboundArrivalDateStr) + 'T00:00:00');
  const arrivalDateMidnight = new Date(outboundArrivalDateStr + 'T00:00:00');
  const calendarDaySpan = Math.round((arrivalDateMidnight.getTime() - departureDateMidnight.getTime()) / (1000 * 60 * 60 * 24));
  const outboundCalendarDays = arrivalDayIsFree ? calendarDaySpan : Math.max(days.length, calendarDaySpan + 1);
  const freeDayOffset = arrivalDayIsFree ? 0 : 1;

  const freeDaysCount = (settings.returnDate && settings.departureDate)
    ? (() => {
        const returnDateObj = new Date(settings.returnDate + 'T00:00:00');
        const totalTripDays = Math.max(1, Math.round(
          (returnDateObj.getTime() - departureDateMidnight.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1);
        const returnSegments = processedSegments.slice(segmentIndex);
        const returnTotalMinutes = returnSegments.reduce((sum, part) => sum + part.durationMinutes, 0);
        const returnDrivingDays = Math.max(1, Math.ceil(returnTotalMinutes / effectiveMaxDriveMinutes));
        return Math.max(0, totalTripDays - outboundCalendarDays - returnDrivingDays);
      })()
    : 0;

  if (freeDaysCount > 0) {
    const lastOutboundDay = days[days.length - 1];
    const destination = lastOutboundDay.segments.length > 0
      ? lastOutboundDay.segments[lastOutboundDay.segments.length - 1].to
      : null;
    const destName = destination?.name || 'Destination';

    for (let j = 0; j < freeDaysCount; j++) {
      dayNumber++;
      const freeDate = new Date(outboundArrivalBase.getTime() + (j + freeDayOffset) * 24 * 60 * 60 * 1000);
      const freeDay = createEmptyDay(dayNumber, freeDate);
      const hotel = destination ? createDefaultOvernight(destination, settings) : undefined;
      const foodCost = settings.mealPricePerDay * settings.numTravelers;
      const roundedHotel = ceilToNearest(hotel?.cost ?? 0, 5);
      const roundedFood = ceilToNearest(foodCost, 5);

      freeDay.route = `📍 ${destName}`;
      freeDay.dayType = 'free';
      freeDay.title = `Day ${j + 1} at ${destName}`;
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
      currentDate = freeDate;
    }
  }

  dayNumber++;
  const returnLegHours = getNextDayDriveMinutes(processedSegments, segmentIndex, maxDriveMinutes) / 60;
  const returnDepHour = computeSmartDepartureHour(settings, returnLegHours);
  const returnDepTz = lngToIANA(processedSegments[segmentIndex].from.lng);
  const returnDateStr = (() => {
    const d = new Date(outboundArrivalBase.getTime() + (freeDaysCount + freeDayOffset) * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  })();
  currentDate = parseLocalDateInTZ(returnDateStr, formatHour(returnDepHour), returnDepTz);

  const earliestReturnDep = new Date(outboundArrivalMs + MIN_REST_HOURS * 60 * 60 * 1000);
  if (currentDate < earliestReturnDep) {
    const nextReturnDateStr = (() => {
      const d = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      return d.toISOString().split('T')[0];
    })();
    currentDate = parseLocalDateInTZ(nextReturnDateStr, formatHour(returnDepHour), returnDepTz);
  }

  currentDay = createEmptyDay(dayNumber, currentDate);
  currentDay.totals.departureTime = currentDate.toISOString();

  return {
    currentDay,
    currentDayDriveMinutes: 0,
    currentDate,
    dayNumber,
    insertedFreeDays: true,
    budget: nextBudget,
  };
}