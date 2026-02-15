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
export type BudgetMode = 'open' | 'fixed';
export type RoutePreference = 'fastest' | 'scenic' | 'economical';

export interface TripSettings {
  units: UnitSystem;
  currency: Currency;
  maxDriveHours: number;
  numTravelers: number;
  numDrivers: number;
  budgetMode: BudgetMode;
  budget: number;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  useArrivalTime: boolean;
  gasPrice: number;
  isRoundTrip: boolean;
  avoidTolls: boolean;
  scenicMode: boolean;
  routePreference: RoutePreference;
}

export interface WeatherData {
  temperatureMax: number;
  temperatureMin: number;
  precipitationProb: number;
  weatherCode: number;
  timezone: string;
  timezoneAbbr: string;
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
}

export type WarningType = 'long_drive' | 'weather' | 'border_crossing' | 'fuel_stop' | 'timezone';

export interface SegmentWarning {
  type: WarningType;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  icon?: string;
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
