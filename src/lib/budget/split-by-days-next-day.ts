import type { TripDay, TripSettings } from '../../types';
import type { ProcessedSegment } from './segment-processor';
import { createEmptyDay } from './day-builder';
import { lngToIANA, parseLocalDateInTZ } from '../trip-timezone';
import {
  computeSmartDepartureHour,
  formatHour,
  getNextDayDriveMinutes,
  MIN_REST_HOURS,
} from './split-by-days-policies';

interface NextDrivingDayParams {
  currentDay: TripDay;
  currentDate: Date;
  currentDayDriveMinutes: number;
  processedSegments: ProcessedSegment[];
  segmentIndex: number;
  maxDriveMinutes: number;
  settings: TripSettings;
  dayNumber: number;
}

export function buildNextDrivingDay({
  currentDay,
  currentDate,
  currentDayDriveMinutes,
  processedSegments,
  segmentIndex,
  maxDriveMinutes,
  settings,
  dayNumber,
}: NextDrivingDayParams) {
  const estimatedDayArrival = new Date(currentDate.getTime() + currentDayDriveMinutes * 60 * 1000);
  const nextDayHours = getNextDayDriveMinutes(processedSegments, segmentIndex, maxDriveMinutes) / 60;
  const depHour = computeSmartDepartureHour(settings, nextDayHours);
  const overnightSeg = currentDay.segments[currentDay.segments.length - 1];
  const depTz = overnightSeg ? lngToIANA(overnightSeg.to.lng) : undefined;
  const arrivalDateStr = estimatedDayArrival.toISOString().split('T')[0];
  let nextDayCandidate = depTz
    ? parseLocalDateInTZ(arrivalDateStr, formatHour(depHour), depTz)
    : (() => {
        const date = new Date(estimatedDayArrival);
        date.setHours(depHour, 0, 0, 0);
        return date;
      })();

  const earliestDeparture = new Date(estimatedDayArrival.getTime() + MIN_REST_HOURS * 60 * 60 * 1000);
  if (nextDayCandidate < earliestDeparture) {
    const nextDateObj = new Date(nextDayCandidate.getTime() + 24 * 60 * 60 * 1000);
    const nextDateStr = nextDateObj.toISOString().split('T')[0];
    nextDayCandidate = depTz
      ? parseLocalDateInTZ(nextDateStr, formatHour(depHour), depTz)
      : (() => {
          nextDateObj.setHours(depHour, 0, 0, 0);
          return nextDateObj;
        })();
  }

  const nextDayNumber = dayNumber + 1;
  const nextDay = createEmptyDay(nextDayNumber, nextDayCandidate);
  nextDay.totals.departureTime = nextDayCandidate.toISOString();

  return {
    currentDate: nextDayCandidate,
    currentDay: nextDay,
    currentDayDriveMinutes: 0,
    dayNumber: nextDayNumber,
  };
}