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
}

export interface RouteSegment {
  from: Location;
  to: Location;
  distanceKm: number;
  durationMinutes: number;
  fuelNeededLitres: number;
  fuelCost: number;
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
}

export interface MarkerCategory {
  id: string;
  label: string;
  emoji: string;
  color: string;
  visible: boolean;
}
