import * as SunCalc from 'suncalc';
import type { TripSummary } from '../../types';

export interface JourneyContextSegment {
  segmentIndex: number;
  dayIndex: number;
  cumulativeDriveMinutesBefore: number;
  cumulativeDriveMinutesAfter: number;
  fatigueBucket: 'fresh' | 'steady' | 'fatigued' | 'exhausted';
  estimatedArrivalTime?: string;
  isMealWindowLunch: boolean;
  isMealWindowDinner: boolean;
  isGoldenHourWindow: boolean;
  isOvernightBoundary: boolean;
}

export interface JourneyContext {
  segments: JourneyContextSegment[];
  totalDrivingDays: number;
  totalDetourBudgetMinutes: number;
  generatedAt: string;
}

/** Return fractional hour (0–23.99) in a specific IANA timezone, or fall back to local. */
function getLocalTod(date: Date, tz?: string): number {
  if (tz) {
    const parts = new Intl.DateTimeFormat('en', {
      hour: 'numeric', minute: 'numeric', hourCycle: 'h23', timeZone: tz,
    }).formatToParts(date);
    const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
    const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
    return h + m / 60;
  }
  return date.getHours() + date.getMinutes() / 60;
}

const FATIGUE_THRESHOLDS = {
  EXHAUSTED: 240, // 4 hours
  FATIGUED: 150,  // 2.5 hours
  STEADY: 60,     // 1 hour
};

export function buildJourneyContext(tripSummary: TripSummary): JourneyContext {
  const segments: JourneyContextSegment[] = [];
  
  let currentDriveStreak = 0;
  
  // Map segments to their driving day
  const segmentToDayMap = new Map<number, number>();
  if (tripSummary.days) {
    tripSummary.days.forEach(day => {
      day.segmentIndices.forEach(idx => {
        segmentToDayMap.set(idx, day.dayNumber);
      });
    });
  }

  for (let i = 0; i < tripSummary.segments.length; i++) {
    const seg = tripSummary.segments[i];
    
    // We compute fatigue BEFORE adding this segment's duration, because this
    // represents the driver's state *upon arriving* at the segment's destination.
    const cumulativeDriveMinutesBefore = currentDriveStreak;
    
    let fatigueBucket: JourneyContextSegment['fatigueBucket'] = 'fresh';
    if (cumulativeDriveMinutesBefore >= FATIGUE_THRESHOLDS.EXHAUSTED) fatigueBucket = 'exhausted';
    else if (cumulativeDriveMinutesBefore >= FATIGUE_THRESHOLDS.FATIGUED) fatigueBucket = 'fatigued';
    else if (cumulativeDriveMinutesBefore >= FATIGUE_THRESHOLDS.STEADY) fatigueBucket = 'steady';

    // Add this segment's duration
    currentDriveStreak += seg.durationMinutes || 0;
    
    // Reset streak if we hit a major rest stop (they leave fresh for the NEXT segment)
    if (seg.stopType === 'break' || seg.stopType === 'meal' || seg.stopType === 'overnight') {
      currentDriveStreak = 0;
    }

    let isMealWindowLunch = false;
    let isMealWindowDinner = false;
    let isGoldenHourWindow = false;
    
    if (seg.arrivalTime) {
      const arr = new Date(seg.arrivalTime);
      const tod = getLocalTod(arr, seg.timezone);
      
      // Prime meal constraints
      isMealWindowLunch = tod >= 11.5 && tod <= 13.5;
      isMealWindowDinner = tod >= 17.5 && tod <= 19.5;
      
      // Golden Hour (within 60m of sunrise or sunset)
      const sunTimes = SunCalc.getTimes(arr, seg.to.lat, seg.to.lng);
      const arrMs = arr.getTime();
      const sunsetDiff = Math.abs(arrMs - sunTimes.sunset.getTime());
      const sunriseDiff = Math.abs(arrMs - sunTimes.sunrise.getTime());
      const ONE_HOUR = 60 * 60 * 1000;
      isGoldenHourWindow = sunsetDiff <= ONE_HOUR || sunriseDiff <= ONE_HOUR;
    }
    
    segments.push({
      segmentIndex: i,
      dayIndex: segmentToDayMap.get(i) ?? 1,
      cumulativeDriveMinutesBefore,
      cumulativeDriveMinutesAfter: currentDriveStreak,
      fatigueBucket,
      estimatedArrivalTime: seg.arrivalTime,
      isMealWindowLunch,
      isMealWindowDinner,
      isGoldenHourWindow,
      isOvernightBoundary: seg.stopType === 'overnight',
    });
  }

  return {
    segments,
    totalDrivingDays: tripSummary.drivingDays || 1,
    totalDetourBudgetMinutes: 50, // Standard timeline protection budget
    generatedAt: new Date().toISOString(),
  };
}
