// ==================== CORE PRIMITIVES ====================
// Location, Vehicle, and all settings/budget types.
// No imports — these are the foundation everything else builds on.

// Trip mode determines the user's intent — plan, explore, or estimate
export type TripMode = 'plan' | 'adventure' | 'estimate';

export type AccommodationType = 'hotel' | 'camping' | 'airbnb' | 'friends' | 'other';
export type HotelTier = 'budget' | 'regular' | 'premium';

export type LocationType = 'origin' | 'destination' | 'waypoint';

/**
 * User-declared intent for a waypoint stop.
 * When set, the engine honors it instead of guessing.
 * Nothing checked = engine decides (default behaviour).
 */
export interface WaypointIntent {
  fuel?: boolean;
  meal?: boolean;
  /** Pins a day boundary here — engine will plan overnight at this location. */
  overnight?: boolean;
  /** Override dwell time in minutes. Fuel defaults 15, meal defaults 45, sum if both. */
  dwellMinutes?: number;
}

export interface Location {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  type: LocationType;
  /** Stop intent — only meaningful when type === 'waypoint'. */
  intent?: WaypointIntent;
}

export interface Vehicle {
  /** Optional id — set when a vehicle has been saved to the garage (SavedVehicle extends this). */
  id?: string;
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

// Budget allocation profiles - each shifts category weights
export type BudgetProfile = 'balanced' | 'foodie' | 'scenic' | 'custom';

// Saved budget profile (user's custom configurations)
export interface SavedBudgetProfile {
  id: string;
  name: string;                      // "Solo Foodie Adventure"
  emoji: string;                     // Custom emoji for the profile
  baseProfile: BudgetProfile;        // What it was derived from
  weights: BudgetWeights;            // Custom weights
  allocation: BudgetAllocation;      // 'fixed' or 'flexible'
  defaultTotal?: number;             // Optional preset amount
  numTravelers?: number;             // Context hint for suggestions
  categoryLabels?: {                 // Custom category names
    misc?: string;                   // "Dining Experiences", "Activities", etc.
  };
  stats?: {                          // Track profile performance
    timesUsed: number;
    lastTripName?: string;           // "Vancouver → Banff"
    lastTripDate?: string;           // ISO timestamp
  };
  lastUsed?: string;                 // ISO timestamp
  isDefault?: boolean;               // ⭐ starred profile
  createdFrom?: {                    // Trip context it was created from
    tripName?: string;               // "Vancouver → Banff"
    tripDate?: string;               // "Feb 2026"
  };
}

// Last trip budget recall (ghost profile)
export interface LastTripBudget {
  tripName: string;                  // "Vancouver → Banff"
  tripDate: string;                  // ISO timestamp
  budget: TripBudget;                // Full budget state
  numTravelers: number;
}

// Whether total is fixed (categories flex) or flexible (categories are independent)
export type BudgetAllocation = 'fixed' | 'flexible';

// Category weight percentages (must sum to 100)
export interface BudgetWeights {
  gas: number;    // 0-100%
  hotel: number;  // 0-100%
  food: number;   // 0-100%
  misc: number;   // 0-100%
}

// Enhanced budget system with per-category tracking
export interface TripBudget {
  mode: BudgetMode;
  allocation: BudgetAllocation; // Fixed total or flexible categories
  profile: BudgetProfile;       // Weight profile preset
  weights: BudgetWeights;       // Actual percentages
  gas: number;
  hotel: number;
  food: number;
  misc: number;
  total: number; // In fixed mode: locked. In flexible: sum of categories
}

export interface TripSettings {
  units: UnitSystem;
  currency: Currency;
  maxDriveHours: number;
  numTravelers: number;
  numDrivers: number;
  /** Optional display names, 0-indexed (driverNames[0] = Driver 1). Falls back to "Driver N". */
  driverNames?: string[];
  budgetMode: BudgetMode;
  budget: TripBudget; // Enhanced from single number
  departureDate: string;
  departureTime: string;
  returnDate: string;
  arrivalDate: string;
  arrivalTime: string;
  useArrivalTime: boolean;
  gasPrice: number;
  hotelPricePerNight: number; // Average hotel cost estimate
  /** Accommodation tier — sets hotelPricePerNight via preset. 'regular' if unset. */
  hotelTier?: HotelTier;
  /** Rooms needed per night. Defaults to ceil(numTravelers / 2) if unset. */
  numRooms?: number;
  mealPricePerDay: number; // Average meal budget per day
  isRoundTrip: boolean;
  avoidTolls: boolean;
  avoidBorders: boolean;
  scenicMode: boolean;
  routePreference: RoutePreference;
  stopFrequency: StopFrequency;
  tripPreferences: TripPreference[]; // User's trip style preferences
  /** Hour of the day (0-23) drivers aim to arrive by on transit days. Default 21 = 9 PM.
   *  Budget logic works backwards: depart = max(5, min(10, targetArrivalHour - maxDriveHours)). */
  targetArrivalHour: number;
  /** Hours spent at the destination before heading home on a round-trip day trip.
   *  0 = drive through with no scheduled stop. Shown in Smart Timeline as "Time at [Destination]". */
  dayTripDurationHours: number;
  /** Privacy: when false, template exports strip the starting location so
   *  the user's home address isn't embedded in shared templates. Default: true. */
  includeStartingLocation?: boolean;
}
