import type { RouteSegment, TripDay, TripSettings } from '../../types';
import type { StrategicFuelStop } from '../fuel-stops';
import { splitLongSegments } from './segment-processor';
import { createEmptyDay, finalizeTripDay, labelTransitDay } from './day-builder';
import { getTimezoneOffset, getTimezoneName } from './timezone';
import { findHubInWindow } from '../hub-cache';
import { getTripStartTime, lngToIANA, parseLocalDateInTZ } from '../trip-timezone';
import {
  type BudgetRemaining,
  computeSmartDepartureHour,
  createDefaultOvernight,
  deriveBudgetRemaining,
  formatHour,
  getEffectiveMaxDriveMinutes,
  getNextDayDriveMinutes,
  getOverflowToleranceMinutes,
} from './split-by-days-policies';
import { buildNextDrivingDay } from './split-by-days-next-day';
import { maybeInsertRoundTripMidpointDays } from './split-by-days-round-trip';
import { insertOneWayDestinationFreeDays } from './split-by-days-one-way';

function finalizeAndStoreDay(
  day: TripDay,
  days: TripDay[],
  budget: BudgetRemaining,
  settings: TripSettings,
  originalSegments: RouteSegment[],
  fuelStops?: StrategicFuelStop[],
): BudgetRemaining {
  finalizeTripDay(
    day,
    budget.gasRemaining,
    budget.hotelRemaining,
    budget.foodRemaining,
    settings,
    fuelStops,
  );
  labelTransitDay(day, originalSegments);
  days.push(day);

  return {
    gasRemaining: day.budget.gasRemaining,
    hotelRemaining: day.budget.hotelRemaining,
    foodRemaining: day.budget.foodRemaining,
  };
}

/**
 * Split a trip into days based on max drive hours and overnight stops.
 * For round trips with a returnDate, free days are inserted at the destination
 * (between outbound and return legs) rather than at the end.
 *
 * @param roundTripMidpoint - Segment index where outbound ends and return begins.
 *   When set, free days are inserted at this boundary.
 * @param fullGeometry - OSRM road polyline from calculateRoute ([lat,lng][]).
 *   Passed to splitLongSegments so transit overnight stops land on the real road.
 */
export function splitTripByDays(
  segments: RouteSegment[],
  settings: TripSettings,
  departureDate: string,
  departureTime: string,
  roundTripMidpoint?: number,
  fullGeometry?: [number, number][],
  fuelStops?: StrategicFuelStop[],
): TripDay[] {
  if (segments.length === 0) return [];

  const days: TripDay[] = [];
  let currentDay: TripDay | null = null;
  let currentDayDriveMinutes = 0;
  let currentDate = getTripStartTime(departureDate, departureTime, segments[0]?.from.lng);
  let dayNumber = 1;
  let budget = deriveBudgetRemaining(settings);

  const maxDriveMinutes = settings.maxDriveHours * 60;
  const effectiveMaxDriveMinutes = getEffectiveMaxDriveMinutes(maxDriveMinutes);

  // Build cumulative km-start offsets per segment for geometry interpolation.
  const segKmStarts: number[] = [];
  let cumulativeKm = 0;
  for (const seg of segments) {
    segKmStarts.push(cumulativeKm);
    cumulativeKm += seg.distanceKm;
  }
  // Outbound-only total: segments before roundTripMidpoint.
  // For one-way trips this is the full total.
  const outboundTotalKm = roundTripMidpoint !== undefined
    ? segments.slice(0, roundTripMidpoint).reduce((sum, s) => sum + s.distanceKm, 0)
    : cumulativeKm;

  // Parse departure time into minutes from midnight so splitLongSegments can
  // tighten the per-day cap to the user's targetArrivalHour.
  // "09:00" → 540, "14:30" → 870, etc.
  const [depHourStr = '9', depMinStr = '0'] = departureTime.split(':');
  const departureMinsFromMidnight = parseInt(depHourStr, 10) * 60 + parseInt(depMinStr, 10);

  // Pre-split any single segment that exceeds the max drive limit so that each
  // processed sub-segment always fits within one driving day.
  // Also honours targetArrivalHour: a 9 AM departure + 7 PM target constrains
  // the first day to 10 h regardless of the maxDriveHours setting.
  const processedSegments = splitLongSegments(
    segments,
    maxDriveMinutes,
    fullGeometry,
    segKmStarts,
    outboundTotalKm,
    settings.targetArrivalHour,
    departureMinsFromMidnight,
  );

  // Track whether we've inserted the destination free days
  let insertedFreeDays = false;

  for (let i = 0; i < processedSegments.length; i++) {
    const segment = processedSegments[i];
    const midpointResult = maybeInsertRoundTripMidpointDays({
      processedSegments,
      segmentIndex: i,
      roundTripMidpoint,
      originalSegments: segments,
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
    });

    currentDay = midpointResult.currentDay;
    currentDayDriveMinutes = midpointResult.currentDayDriveMinutes;
    currentDate = midpointResult.currentDate;
    dayNumber = midpointResult.dayNumber;
    insertedFreeDays = midpointResult.insertedFreeDays;
    budget = midpointResult.budget;

    // Start a new day if needed
    if (!currentDay) {
      currentDay = createEmptyDay(dayNumber, currentDate);
    }

    const segmentDriveMinutes = segment.durationMinutes;
    // We also trigger a new day *after* this segment if it's an explicit overnight stop
    const isOvernightStop = segment.stopType === 'overnight';

    // Context-aware overflow: adapts to driver count, last leg, and fatigue.
    const remainingMinutes = processedSegments.slice(i + 1).reduce((sum, s) => sum + s.durationMinutes, 0);
    const contextTolerance = getOverflowToleranceMinutes(settings, remainingMinutes <= maxDriveMinutes, days);
    const wouldExceedDailyMax = currentDayDriveMinutes + segmentDriveMinutes > maxDriveMinutes + contextTolerance;

    // Hub-snap: before splitting, check if extending the day by one segment would
    // land at a real city (hub). Humans prefer to push an extra hour to reach
    // Thunder Bay rather than stop at an anonymous highway km marker.
    let hubSnapExtend = false;
    if (wouldExceedDailyMax && currentDay.segments.length > 0 && !isOvernightStop) {
      const lastSeg = currentDay.segments[currentDay.segments.length - 1];
      const currentEndNearHub = findHubInWindow(lastSeg.to.lat, lastSeg.to.lng, 60);
      if (!currentEndNearHub && segmentDriveMinutes <= 90) {
        const nextEndHub = findHubInWindow(segment.to.lat, segment.to.lng, 60);
        if (nextEndHub) {
          hubSnapExtend = true; // Include this segment, split on the NEXT iteration
        }
      }
    }
    if (wouldExceedDailyMax && currentDay.segments.length > 0 && !isOvernightStop && !hubSnapExtend) {
      if (!currentDay.overnight) {
        const lastSeg = currentDay.segments[currentDay.segments.length - 1];
        if (lastSeg) {
          currentDay.overnight = createDefaultOvernight(lastSeg.to, settings);
        }
      }

      budget = finalizeAndStoreDay(currentDay, days, budget, settings, segments, fuelStops);

      const nextDay = buildNextDrivingDay({
        currentDay,
        currentDate,
        currentDayDriveMinutes,
        processedSegments,
        segmentIndex: i,
        maxDriveMinutes,
        settings,
        dayNumber,
      });
      currentDate = nextDay.currentDate;
      currentDay = nextDay.currentDay;
      currentDayDriveMinutes = nextDay.currentDayDriveMinutes;
      dayNumber = nextDay.dayNumber;
    }

    // Add segment to current day
    currentDay.segments.push(segment);
    // Store the original segment index (before any long-segment splitting) so
    // downstream consumers like stop-suggestions can map back correctly.
    // Deduplicate: multiple sub-segments from the same original segment should
    // only appear once in segmentIndices (avoids [0, 0] for split days).
    if (!currentDay.segmentIndices.includes(segment._originalIndex)) {
      currentDay.segmentIndices.push(segment._originalIndex);
    }
    currentDayDriveMinutes += segmentDriveMinutes;

    // Check for timezone changes using real weather API abbreviations.
    // Comparing consecutive segments' actual timezoneAbbr is more accurate than
    // the longitude heuristic (handles Saskatchewan CST, short diagonal segments, etc.)
    const toAbbr = segment.weather?.timezoneAbbr;
    const fromAbbr = i > 0 ? processedSegments[i - 1].weather?.timezoneAbbr : null;
    if (toAbbr && fromAbbr && toAbbr !== fromAbbr) {
      currentDay.timezoneChanges.push({
        afterSegmentIndex: currentDay.segments.length - 1,
        fromTimezone: fromAbbr,
        toTimezone: toAbbr,
        offset: getTimezoneOffset(fromAbbr, toAbbr),
        message: `Enter ${getTimezoneName(toAbbr)} (${
          getTimezoneOffset(fromAbbr, toAbbr) > 0 ? 'gain' : 'lose'
        } 1 hour)`,
      });
    }

    // Check for overnight stop type
    if (isOvernightStop) {
      currentDay.overnight = createDefaultOvernight(segment.to, settings);
      budget = finalizeAndStoreDay(currentDay, days, budget, settings, segments, fuelStops);

      // Set up next day
      dayNumber++;
      // If the segment has an arrival time, the next day starts the morning after
      const arrivalBase = segment.arrivalTime ? new Date(segment.arrivalTime) : currentDate;
      currentDate = new Date(arrivalBase.getTime());

      // If it's earlier than 9 AM, maybe it's the same morning. Generally, advance 1 day if we stopped overnight.
      // But `calculateArrivalTimes` already factored in the 8 hour stop.
      // Easiest is to force it to the next calendar morning.
      currentDate.setDate(currentDate.getDate() + 1);
      const overnightNextDayHours = getNextDayDriveMinutes(processedSegments, i + 1, maxDriveMinutes) / 60;
      const overnightDepHour = computeSmartDepartureHour(settings, overnightNextDayHours);
      // Use the overnight stop's timezone (not browser-local) for the departure time.
      const overnightDepTz = lngToIANA(segment.to.lng);
      const overnightDateStr = currentDate.toISOString().split('T')[0];
      currentDate = parseLocalDateInTZ(overnightDateStr, formatHour(overnightDepHour), overnightDepTz);

      currentDay = createEmptyDay(dayNumber, currentDate);
      currentDay.totals.departureTime = currentDate.toISOString();
      currentDayDriveMinutes = 0;
    }
  }

  // Finalize last day
  if (currentDay && currentDay.segments.length > 0) {
    finalizeAndStoreDay(currentDay, days, budget, settings, segments, fuelStops);
  }

  if (!insertedFreeDays) {
    const oneWayResult = insertOneWayDestinationFreeDays({
      settings,
      fuelStops,
      dayNumber,
      days,
      budget,
    });
    dayNumber = oneWayResult.dayNumber;
  }

  return days;
}
