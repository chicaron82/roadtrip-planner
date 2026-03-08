// ==================== ROUTE & SEGMENT TYPES ====================
// Covers weather, stops, activities, day planning, and trip aggregates.

import type { Location, AccommodationType } from './core';

export interface WeatherData {
  temperatureMax: number;
  temperatureMin: number;
  precipitationProb: number;
  weatherCode: number;
  timezone: string;
  timezoneAbbr: string;
}

export type StopType = 'drive' | 'fuel' | 'break' | 'quickMeal' | 'meal' | 'overnight';

// Activity categories for planned stops
export type ActivityCategory = 'photo' | 'meal' | 'attraction' | 'museum' | 'shopping' | 'nature' | 'rest' | 'fuel' | 'other';

// Activity details for a stop (optional enhancement to stops)
export interface Activity {
  name: string;                    // "Visit Covent Garden Market"
  description?: string;            // "Great for lunch, try the peameal bacon"
  category: ActivityCategory;      // 'meal', 'attraction', etc.
  plannedStartTime?: string;       // "10:30" (HH:mm format)
  plannedEndTime?: string;         // "12:00" (HH:mm format)
  durationMinutes?: number;        // 90 (can differ from time window)
  cost?: number;                   // Optional activity cost
  notes?: string;                  // "Cash only", "Closed Mondays"
  url?: string;                    // Website or booking link
  isRequired?: boolean;            // Must-do vs optional
}

// Day types for flexible planning
export type DayType = 'planned' | 'flexible' | 'free';

// Alternative option for a flexible day
export interface DayOption {
  id: string;
  name: string;                    // "Option A: Gros Morne"
  description?: string;            // "Full day hiking in the national park"
  segments: RouteSegment[];        // Route segments for this option
  estimatedCost?: number;          // Total cost for this option
  estimatedDuration?: number;      // Total time in minutes
  highlights?: string[];           // ["Tablelands", "Western Brook Pond"]
}

export interface RouteSegment {
  from: Location;
  to: Location;
  distanceKm: number;
  durationMinutes: number;
  fuelNeededLitres: number;
  fuelCost: number;
  weather?: WeatherData;
  timezone?: string; // IANA timezone (e.g., "America/Toronto")
  timezoneCrossing?: boolean; // True if this segment crosses a timezone boundary
  warnings?: SegmentWarning[];
  suggestedBreak?: boolean; // Auto-suggest break if segment > 3 hours

  // Time intelligence fields
  departureTime?: string; // ISO 8601 datetime string
  arrivalTime?: string; // ISO 8601 datetime string
  stopDuration?: number; // Stop duration at destination in minutes
  stopType?: StopType; // Type of stop at destination

  // Activity planning (optional - for bougie planners)
  activity?: Activity; // Planned activity at this stop
}

export type ProcessedSegment = RouteSegment & {
  /** Index into the original `segments` array this sub-segment was derived from. */
  _originalIndex: number;
  /** Populated when the original segment was split; tracks which part this is. */
  _transitPart?: { index: number; total: number };
  /** Absolute distance from the very start of the route. */
  distanceFromStart?: number;
};

export type WarningType = 'long_drive' | 'weather' | 'border_crossing' | 'fuel_stop' | 'timezone';

export interface SegmentWarning {
  type: WarningType;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  icon?: string;
}

// Timezone crossing event
export interface TimezoneChange {
  afterSegmentIndex: number;
  fromTimezone: string; // e.g., "CDT"
  toTimezone: string; // e.g., "EDT"
  offset: number; // +1 (gain hour) or -1 (lose hour)
  message: string; // "Enter Eastern Time Zone (lose 1 hour)"
}

// Overnight accommodation details
export interface OvernightStop {
  location: Location;
  accommodationType?: AccommodationType; // defaults to 'hotel'
  hotelName?: string;
  address?: string;
  cost: number;
  roomsNeeded: number;
  amenities?: string[]; // ['breakfast', 'pool', 'wifi']
  checkIn?: string; // "3:00 PM"
  checkOut?: string; // "11:00 AM"
  notes?: string;
}

// Daily budget tracking with running totals
export interface DayBudget {
  gasUsed: number;
  hotelCost: number;
  foodEstimate: number;
  miscCost: number;
  dayTotal: number;
  // Running totals (remaining from initial budget)
  gasRemaining: number;
  hotelRemaining: number;
  foodRemaining: number;
}

// Per-day itinerary breakdown
export interface TripDay {
  dayNumber: number;
  date: string; // "2025-08-16"
  dateFormatted: string; // "Sat, Aug 16"
  title?: string; // "Let's Get Outta Here"
  route: string; // "Winnipeg → Sault Ste. Marie"
  segments: ProcessedSegment[];
  segmentIndices: number[]; // Original indices in full segments array
  overnight?: OvernightStop;
  timezoneChanges: TimezoneChange[];
  budget: DayBudget;
  totals: {
    distanceKm: number;
    driveTimeMinutes: number;
    stopTimeMinutes: number;
    departureTime: string; // ISO 8601
    arrivalTime: string; // ISO 8601
  };

  // Flexible day planning
  dayType?: DayType;              // 'planned' | 'flexible' | 'free'
  options?: DayOption[];          // Alternative plans for flexible days
  selectedOption?: number;        // Index of currently selected option
  notes?: string;                 // "Depends on weather" or "No plans yet"
  plannedActivities?: Activity[]; // Standalone activities
}

// Cost breakdown by category
export interface CostBreakdown {
  fuel: number;
  accommodation: number;
  meals: number;
  misc: number;
  total: number;
  perPerson: number;
}

export interface TripSummary {
  totalDistanceKm: number;
  totalDurationMinutes: number;
  totalFuelLitres: number;
  totalFuelCost: number;
  gasStops: number;
  costPerPerson: number;
  drivingDays: number;
  segments: RouteSegment[];
  fullGeometry: [number, number][]; // [lat, lng][]
  displayDate?: string;
  // Phase C: Multi-day & budget tracking
  days?: TripDay[];
  costBreakdown?: CostBreakdown;
  budgetStatus?: 'under' | 'at' | 'over';
  budgetRemaining?: number;
  /** Segment index where the return leg begins (round trips only). Used by SmartTimeline
   *  to inject the destination dwell time stop at the correct position. */
  roundTripMidpoint?: number;
}

export interface RouteStrategy {
  id: 'fastest' | 'canada-only' | 'scenic';
  label: string;
  emoji: string;
  distanceKm: number;
  durationMinutes: number;
  geometry: [number, number][];
  segments: RouteSegment[];
}

