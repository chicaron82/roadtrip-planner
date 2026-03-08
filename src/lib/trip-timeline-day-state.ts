import type { ProcessedSegment, RouteSegment, TripDay, TripSettings } from '../types';
import type { SuggestedStop } from './stop-suggestions';
import type { TimedEvent } from './trip-timeline-types';
import { findPreferredHubInWindow } from './hub-cache';
import { formatDateInZone, parseLocalDateInTZ } from './trip-timezone';

export interface TimelineIterationPlan {
  iterSegments: ProcessedSegment[];
  useDayFiltering: boolean;
  dayStartMap: Map<number, TripDay>;
  currentDayNumber: number;
}

export interface DrivingDayMetadata {
  drivingDayDates: string[];
  drivingDayDepartures: Map<string, string>;
}

export function buildDrivingDayMetadata(tripDays?: TripDay[]): DrivingDayMetadata {
  const drivingDayDates: string[] = [];
  const drivingDayDepartures = new Map<string, string>();

  if (tripDays) {
    for (const day of tripDays) {
      if (day.segmentIndices.length > 0) {
        drivingDayDates.push(day.date);
        if (day.totals?.departureTime) {
          drivingDayDepartures.set(day.date, day.totals.departureTime);
        }
      }
    }
  }

  return { drivingDayDates, drivingDayDepartures };
}

export function buildTimelineIterationPlan(
  segments: RouteSegment[],
  tripDays?: TripDay[],
): TimelineIterationPlan {
  let iterSegments: ProcessedSegment[];
  let useDayFiltering = false;
  const dayStartMap = new Map<number, TripDay>();
  let currentDayNumber = 1;

  if (tripDays) {
    const drivingDays = tripDays.filter(day => day.segmentIndices.length > 0);
    const hasPopulatedSegments = drivingDays.some(day => day.segments.length > 0);

    if (drivingDays.length > 0 && hasPopulatedSegments) {
      iterSegments = drivingDays.flatMap(day => day.segments);
      useDayFiltering = true;
      currentDayNumber = drivingDays[0].dayNumber;

      let flatIdx = 0;
      drivingDays.forEach((day, dayIndex) => {
        if (dayIndex > 0) dayStartMap.set(flatIdx, day);
        flatIdx += day.segments.length;
      });
    } else {
      iterSegments = segments.map((segment, idx) => ({ ...segment, _originalIndex: idx }));
    }
  } else {
    iterSegments = segments.map((segment, idx) => ({ ...segment, _originalIndex: idx }));
  }

  return { iterSegments, useDayFiltering, dayStartMap, currentDayNumber };
}

interface DayBoundaryParams {
  newDay: TripDay;
  currentTime: Date;
  cumulativeKm: number;
  activeTimezone: string;
  tripDays: TripDay[] | undefined;
  suggestions: SuggestedStop[];
  events: TimedEvent[];
  iterSegments: ProcessedSegment[];
  segmentIndex: number;
  settings: TripSettings;
  drivingDayDepartures: Map<string, string>;
}

export interface DayBoundaryResult {
  currentDayNumber: number;
  currentTime: Date;
  departureEvent: TimedEvent;
}

export function applyDayBoundary({
  newDay,
  currentTime,
  cumulativeKm,
  activeTimezone,
  tripDays,
  suggestions,
  events,
  iterSegments,
  segmentIndex,
  settings,
  drivingDayDepartures,
}: DayBoundaryParams): DayBoundaryResult {
  const nextTime = syncCurrentTimeToDayDeparture(
    newDay,
    currentTime,
    activeTimezone,
    settings,
    drivingDayDepartures,
  );

  const departLocation = resolveDayDepartureLocation({
    newDay,
    tripDays,
    suggestions,
    events,
    iterSegments,
    segmentIndex,
  });

  return {
    currentDayNumber: newDay.dayNumber,
    currentTime: nextTime,
    departureEvent: {
      id: `departure-day${newDay.dayNumber}`,
      type: 'departure',
      arrivalTime: new Date(nextTime),
      departureTime: new Date(nextTime),
      durationMinutes: 0,
      distanceFromOriginKm: cumulativeKm,
      locationHint: departLocation,
      stops: [],
      timezone: activeTimezone,
    },
  };
}

function syncCurrentTimeToDayDeparture(
  newDay: TripDay,
  currentTime: Date,
  activeTimezone: string,
  settings: TripSettings,
  drivingDayDepartures: Map<string, string>,
): Date {
  const plannedDeparture = drivingDayDepartures.get(newDay.date);
  if (plannedDeparture) {
    const departureTime = new Date(plannedDeparture);
    return departureTime > currentTime ? departureTime : currentTime;
  }

  const departureTime = parseLocalDateInTZ(newDay.date, settings.departureTime, activeTimezone);
  return departureTime > currentTime ? departureTime : currentTime;
}

interface ResolveDayDepartureLocationParams {
  newDay: TripDay;
  tripDays?: TripDay[];
  suggestions: SuggestedStop[];
  events: TimedEvent[];
  iterSegments: ProcessedSegment[];
  segmentIndex: number;
}

function isUsableNamedLocation(name?: string | null): name is string {
  if (!name) return false;
  const trimmed = name.trim();
  return !!trimmed && !trimmed.includes('(transit)') && !trimmed.includes(' → ');
}

function resolveDayDepartureLocation({
  newDay,
  tripDays,
  suggestions,
  events,
  iterSegments,
  segmentIndex,
}: ResolveDayDepartureLocationParams): string {
  const previousOvernight = suggestions.find(
    suggestion => suggestion.type === 'overnight' && suggestion.dayNumber === newDay.dayNumber - 1,
  );
  const previousSegment = segmentIndex > 0 ? iterSegments[segmentIndex - 1] : null;
  const previousToClean = previousSegment?.to.name
    && !previousSegment.to.name.includes('(transit)')
    && !previousSegment.to.name.includes(' → ');
  const previousOvernightEvent = [...events].reverse().find(event => event.type === 'overnight');

  const previousFreeDayLocation = (() => {
    if (!tripDays) return null;
    const lastFreeDay = [...tripDays]
      .filter(day => day.dayType === 'free' && day.dayNumber < newDay.dayNumber && day.overnight)
      .at(-1);
    return lastFreeDay?.overnight?.location?.name ?? null;
  })();

  const rawOvernight = previousOvernightEvent?.locationHint?.replace(/^near\s+/, '')
    ?? previousOvernight?.hubName
    ?? previousFreeDayLocation
    ?? (previousToClean ? previousSegment!.to.name : null);

  let departLocation = rawOvernight ?? null;
  if (!departLocation || departLocation.includes('(transit)') || departLocation.includes(' → ')) {
    const fromSegment = iterSegments[segmentIndex];
    const exactFromName = isUsableNamedLocation(fromSegment.from.name)
      ? fromSegment.from.name.trim()
      : null;
    if (exactFromName) {
      departLocation = exactFromName;
    } else {
      const fromHub = findPreferredHubInWindow(fromSegment.from.lat, fromSegment.from.lng, 40);
      departLocation = fromHub?.name ?? departLocation ?? fromSegment.from.name;
    }
  }

  if (departLocation.includes(' → ')) departLocation = departLocation.split(' → ')[0].trim();
  return departLocation.replace(/\s*\(transit\)/, '');
}

export function advanceOvernightClock(
  arrivalTime: Date,
  activeTimezone: string,
  settings: TripSettings,
  drivingDayDates: string[],
  drivingDayDepartures: Map<string, string>,
): Date {
  const overnightLocal = formatDateInZone(arrivalTime, activeTimezone);
  let daysToAdvance = 1;
  let nextDrivingDate: string | undefined;

  if (drivingDayDates.length > 0) {
    nextDrivingDate = drivingDayDates.find(day => day > overnightLocal);
    if (nextDrivingDate) {
      const overnightDay = new Date(overnightLocal + 'T00:00:00');
      const nextDay = new Date(nextDrivingDate + 'T00:00:00');
      daysToAdvance = Math.round((nextDay.getTime() - overnightDay.getTime()) / 86_400_000);
    }
  }

  const plannedDeparture = nextDrivingDate ? drivingDayDepartures.get(nextDrivingDate) : undefined;
  if (plannedDeparture) {
    return new Date(plannedDeparture);
  }

  const [departureHour, departureMinute] = settings.departureTime.split(':').map(Number);
  const nextDateParts = overnightLocal.split('-').map(Number);
  const nextDate = new Date(Date.UTC(nextDateParts[0], nextDateParts[1] - 1, nextDateParts[2] + daysToAdvance));
  const pad = (value: number) => String(value).padStart(2, '0');
  const nextDateStr = `${nextDate.getUTCFullYear()}-${pad(nextDate.getUTCMonth() + 1)}-${pad(nextDate.getUTCDate())}`;
  const nextTimeStr = `${pad(departureHour ?? 9)}:${pad(departureMinute ?? 0)}`;
  return parseLocalDateInTZ(nextDateStr, nextTimeStr, activeTimezone);
}