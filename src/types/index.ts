export type LocationType = 'origin' | 'destination' | 'waypoint';

export interface Location {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  type: LocationType;
}

export interface Vehicle {
  year: string;
  make: string;
  model: string;
  fuelEconomyCity: number; // L/100km or MPG
  fuelEconomyHwy: number; // L/100km or MPG
  tankSize: number; // Litres or Gallons
}

export type UnitSystem = 'metric' | 'imperial';
export type Currency = 'CAD' | 'USD';
export type BudgetMode = 'open' | 'plan-to-budget';
export type RoutePreference = 'fastest' | 'scenic' | 'economical';
export type StopFrequency = 'conservative' | 'balanced' | 'aggressive';
export type TripPreference = 'scenic' | 'family' | 'budget' | 'foodie';

// Enhanced budget system with per-category tracking
export interface TripBudget {
  mode: BudgetMode;
  gas: number;
  hotel: number;
  food: number;
  misc: number;
  total: number; // Computed: gas + hotel + food + misc
}

export interface TripSettings {
  units: UnitSystem;
  currency: Currency;
  maxDriveHours: number;
  numTravelers: number;
  numDrivers: number;
  budgetMode: BudgetMode;
  budget: TripBudget; // Enhanced from single number
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  useArrivalTime: boolean;
  gasPrice: number;
  hotelPricePerNight: number; // Average hotel cost estimate
  mealPricePerDay: number; // Average meal budget per day
  isRoundTrip: boolean;
  avoidTolls: boolean;
  scenicMode: boolean;
  routePreference: RoutePreference;
  stopFrequency: StopFrequency;
  tripPreferences: TripPreference[]; // User's trip style preferences
}

export interface WeatherData {
  temperatureMax: number;
  temperatureMin: number;
  precipitationProb: number;
  weatherCode: number;
  timezone: string;
  timezoneAbbr: string;
}

export type StopType = 'drive' | 'fuel' | 'break' | 'quickMeal' | 'meal' | 'overnight';

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
}

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
  segments: RouteSegment[];
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
  fullGeometry: number[][]; // [lat, lng][]
  displayDate?: string;
  // Phase C: Multi-day & budget tracking
  days?: TripDay[];
  costBreakdown?: CostBreakdown;
  budgetStatus?: 'under' | 'at' | 'over';
  budgetRemaining?: number;
}

export type POICategory = 'gas' | 'food' | 'hotel' | 'attraction';

export interface POI {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: POICategory;
  address?: string;
}

export interface MarkerCategory {
  id: POICategory;
  label: string;
  emoji: string;
  color: string;
  visible: boolean;
}
