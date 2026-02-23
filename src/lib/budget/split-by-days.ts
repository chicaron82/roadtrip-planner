import type { RouteSegment, TripDay, TripSettings } from '../../types';
import { splitLongSegments, type ProcessedSegment } from './segment-processor';
import { createEmptyDay, finalizeTripDay } from './day-builder';
import { getTimezoneOffset, getTimezoneName } from './timezone';

// ---------------------------------------------------------------------------

/**
 * Compute the ideal departure hour for a transit day so the crew arrives by
 * `settings.targetArrivalHour`, scaled to how much driving is *actually* left
 * for that specific day (not always the maximum).
 *
 * Full-day legs (≥75% of maxDriveHours): capped at 10 AM — can't dawdle.
 * Short final legs (<75%): allowed up to 6 PM — no sense waking at 5 AM for a 3h drive.
 *
 * Examples using the 9 PM default target:
 *   16h drive → clamp(21−16, 5, 10) =  5 AM → arrive 9 PM ✅
 *    8h drive → clamp(21− 8, 5, 10) = 10 AM → arrive 6 PM ✅
 *    3h drive → clamp(21− 3, 5, 18) =  6 PM → arrive 9 PM ✅ (was wrongly 5 AM)
 */
function computeSmartDepartureHour(settings: TripSettings, actualDriveHours: number): number {
  const { targetArrivalHour = 21, maxDriveHours } = settings;
  const isFullDay = actualDriveHours >= maxDriveHours * 0.75;
  const maxDeparture = isFullDay ? 10 : 18; // short legs: allow up to 6 PM start
  return Math.max(5, Math.min(maxDeparture, Math.round(targetArrivalHour - actualDriveHours)));
}

/**
 * Look ahead from `fromIndex` in the processed segments array and accumulate
 * drive minutes for the *next* day — stopping when a new day boundary would
 * be triggered (accumulated + next segment > maxDriveMinutes) or when segments
 * run out. Used to compute the smart departure hour for the upcoming day.
 */
function getNextDayDriveMinutes(
  segments: ProcessedSegment[],
  fromIndex: number,
  maxDriveMinutes: number,
): number {
  let accumulated = 0;
  for (let i = fromIndex; i < segments.length; i++) {
    const m = segments[i].durationMinutes;
    if (accumulated > 0 && accumulated + m > maxDriveMinutes) break;
    accumulated += m;
  }
  return accumulated;
}

/** Minimum hours of rest guaranteed between estimated Day-N arrival and Day-(N+1) departure. */
const MIN_REST_HOURS = 7;

// ---------------------------------------------------------------------------

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
): TripDay[] {
  if (segments.length === 0) return [];

  const days: TripDay[] = [];
  let currentDay: TripDay | null = null;
  let currentDayDriveMinutes = 0;
  let currentDate = new Date(`${departureDate}T${departureTime}`);
  let dayNumber = 1;

  // Initialize running budget totals.
  // In 'flexible' allocation mode the per-category fields are 0 (the user hasn't
  // allocated them manually), so derive from total × weight percentages instead.
  // In 'manual' / 'plan-to-budget' mode the explicit per-category values are used.
  const { budget } = settings;
  const hasExplicitCategoryBudgets = budget.gas > 0 || budget.hotel > 0 || budget.food > 0;
  const gasRemaining0 = hasExplicitCategoryBudgets
    ? budget.gas
    : budget.total > 0 ? budget.total * budget.weights.gas / 100 : 0;
  const hotelRemaining0 = hasExplicitCategoryBudgets
    ? budget.hotel
    : budget.total > 0 ? budget.total * budget.weights.hotel / 100 : 0;
  const foodRemaining0 = hasExplicitCategoryBudgets
    ? budget.food
    : budget.total > 0 ? budget.total * budget.weights.food / 100 : 0;
  let gasRemaining = gasRemaining0;
  let hotelRemaining = hotelRemaining0;
  let foodRemaining = foodRemaining0;

  const maxDriveMinutes = settings.maxDriveHours * 60;

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

  // Pre-split any single segment that exceeds the max drive limit so that each
  // processed sub-segment always fits within one driving day.
  const processedSegments = splitLongSegments(
    segments,
    maxDriveMinutes,
    fullGeometry,
    segKmStarts,
    outboundTotalKm,
  );

  // Track whether we've inserted the destination free days
  let insertedFreeDays = false;

  for (let i = 0; i < processedSegments.length; i++) {
    const segment = processedSegments[i];

    // === INSERT FREE DAYS AT ROUND-TRIP MIDPOINT ===
    // Use _originalIndex so we correctly detect the midpoint even when a long
    // segment was split into multiple sub-segments by splitLongSegments.
    if (
      !insertedFreeDays &&
      roundTripMidpoint !== undefined &&
      segment._originalIndex === roundTripMidpoint &&
      (i === 0 || processedSegments[i - 1]._originalIndex < roundTripMidpoint) &&
      settings.returnDate &&
      settings.departureDate
    ) {
      // Finalize outbound's last day before inserting free days
      if (currentDay && currentDay.segments.length > 0) {
        // Assign overnight to the last outbound driving day — you arrive and check in that evening.
        // Night 1 belongs to Day 1's budget (the day you drove, not the free day after).
        const lastSeg = currentDay.segments[currentDay.segments.length - 1];
        if (!currentDay.overnight && lastSeg) {
          const roomsNeeded = Math.ceil(settings.numTravelers / 2);
          currentDay.overnight = {
            location: lastSeg.to,
            cost: roomsNeeded * settings.hotelPricePerNight,
            roomsNeeded,
          };
        }

        finalizeTripDay(currentDay, gasRemaining, hotelRemaining, foodRemaining, settings);
        gasRemaining = currentDay.budget.gasRemaining;
        hotelRemaining = currentDay.budget.hotelRemaining;
        foodRemaining = currentDay.budget.foodRemaining;
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

        for (let j = 0; j < freeDaysCount; j++) {
          dayNumber++;
          const lastDay = days[days.length - 1];
          const freeDate = new Date(new Date(lastDay.date + 'T09:00:00').getTime() + 24 * 60 * 60 * 1000);
          const freeDay = createEmptyDay(dayNumber, freeDate);
          freeDay.route = `📍 ${destName}`;
          freeDay.dayType = 'free';
          freeDay.title = `Day ${j + 1} at ${destName}`;

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
      const returnLegHours = getNextDayDriveMinutes(processedSegments, i, maxDriveMinutes) / 60;
      currentDate.setHours(computeSmartDepartureHour(settings, returnLegHours), 0, 0, 0);
      currentDay = createEmptyDay(dayNumber, currentDate);
      currentDay.totals.departureTime = currentDate.toISOString(); // Auto-computed return leg departure
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

    // Check if we need to start a new day (max drive hours exceeded)
    // However, if the CURRENT segment is an overnight stop, we add it to THIS day, and then force a new day AFTER.
    // The overnight belongs to the day you drove — you check in at end of Day 1, so Day 1 pays for it.
    if (wouldExceedMaxDrive && currentDay.segments.length > 0 && !isOvernightStop) {
      // Assign overnight — driver stops at end of this driving day.
      if (!currentDay.overnight) {
        const lastSeg = currentDay.segments[currentDay.segments.length - 1];
        if (lastSeg) {
          const roomsNeeded = Math.ceil(settings.numTravelers / 2);
          currentDay.overnight = {
            location: lastSeg.to,
            cost: roomsNeeded * settings.hotelPricePerNight,
            roomsNeeded,
          };
        }
      }

      // Finalize current day
      finalizeTripDay(currentDay, gasRemaining, hotelRemaining, foodRemaining, settings);

      // Label transit days when the segment was split by splitLongSegments.
      const lastPS = currentDay.segments[currentDay.segments.length - 1] as ProcessedSegment;
      if (lastPS?._transitPart) {
        const destName = segments[lastPS._originalIndex].to.name.split(',')[0].trim();
        currentDay.title = `In Transit to ${destName} (Day ${lastPS._transitPart.index + 1}/${lastPS._transitPart.total})`;
      }

      // Update running totals for the NEXT day
      gasRemaining = currentDay.budget.gasRemaining;
      hotelRemaining = currentDay.budget.hotelRemaining;
      foodRemaining = currentDay.budget.foodRemaining;

      days.push(currentDay);

      // Start new day — stamp auto-computed departure before any segments are added
      dayNumber++;
      // Estimate actual arrival time for this driving day (departure + accumulated drive time).
      // This ensures the next-day departure always respects a minimum rest gap, even when
      // Day 1 departs late and drives through the night (e.g. 10 PM → arrives 8 AM → must
      // not depart 9 AM that same morning with only 1 h of rest).
      const estimatedDayArrival = new Date(currentDate.getTime() + currentDayDriveMinutes * 60 * 1000);
      // Try the smart departure hour on the same calendar day as arrival.
      // Use how much driving is actually left (not the max) so short final legs get later starts.
      const nextDayHours = getNextDayDriveMinutes(processedSegments, i, maxDriveMinutes) / 60;
      const nextDayCandidate = new Date(estimatedDayArrival);
      nextDayCandidate.setHours(computeSmartDepartureHour(settings, nextDayHours), 0, 0, 0);
      // Guard: departure must be ≥ MIN_REST_HOURS after estimated arrival.
      const earliestDeparture = new Date(estimatedDayArrival.getTime() + MIN_REST_HOURS * 60 * 60 * 1000);
      if (nextDayCandidate < earliestDeparture) {
        // Not enough rest this day — push to the next calendar day at the smart hour.
        nextDayCandidate.setDate(nextDayCandidate.getDate() + 1);
        nextDayCandidate.setHours(computeSmartDepartureHour(settings, nextDayHours), 0, 0, 0);
      }
      currentDate = nextDayCandidate;
      currentDay = createEmptyDay(dayNumber, currentDate);
      currentDay.totals.departureTime = currentDate.toISOString(); // Override segment chain time
      currentDayDriveMinutes = 0;
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

    // Check for timezone changes
    if (segment.timezoneCrossing && segment.weather?.timezoneAbbr) {
      const prevTimezone = i > 0
        ? processedSegments[i - 1].weather?.timezoneAbbr || 'Unknown'
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

      gasRemaining = currentDay.budget.gasRemaining;
      hotelRemaining = currentDay.budget.hotelRemaining;
      foodRemaining = currentDay.budget.foodRemaining;

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
      const overnightNextDayHours = getNextDayDriveMinutes(processedSegments, i + 1, maxDriveMinutes) / 60;
      currentDate.setHours(computeSmartDepartureHour(settings, overnightNextDayHours), 0, 0, 0); // Smart: based on remaining drive hours

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

      // Assign overnight to the last driving day if it doesn't have one yet.
      // You arrive and check in that evening — Night 1 belongs to the day you drove.
      if (!lastDrivingDay.overnight && destination) {
        const roomsNeeded = Math.ceil(settings.numTravelers / 2);
        const hotelCost = roomsNeeded * settings.hotelPricePerNight;
        lastDrivingDay.overnight = {
          location: destination,
          cost: hotelCost,
          roomsNeeded,
        };
        // Re-finalize so the budget includes the hotel cost
        hotelRemaining += lastDrivingDay.budget.hotelCost; // undo old
        gasRemaining += lastDrivingDay.budget.gasUsed;
        foodRemaining += lastDrivingDay.budget.foodEstimate;
        finalizeTripDay(lastDrivingDay, gasRemaining, hotelRemaining, foodRemaining, settings);
      }

      for (let k = 1; k < gapDays; k++) {
        dayNumber++;
        const freeDate = new Date(lastDriveDate.getTime() + k * 24 * 60 * 60 * 1000);
        const freeDay = createEmptyDay(dayNumber, freeDate);
        freeDay.route = `📍 ${destName}`;
        freeDay.dayType = 'free';
        freeDay.title = k === 1 ? 'Explore!' : `Day ${k} at ${destName}`;

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
