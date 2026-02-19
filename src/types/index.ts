// Trip mode determines the user's intent — plan, explore, or estimate
export type TripMode = 'plan' | 'adventure' | 'estimate';

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

// Budget allocation profiles - each shifts category weights
export type BudgetProfile = 'balanced' | 'foodie' | 'scenic' | 'backpacker' | 'comfort' | 'custom';

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
  mealPricePerDay: number; // Average meal budget per day
  isRoundTrip: boolean;
  avoidTolls: boolean;
  avoidBorders: boolean;
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

  // Flexible day planning
  dayType?: DayType;              // 'planned' | 'flexible' | 'free'
  options?: DayOption[];          // Alternative plans for flexible days
  selectedOption?: number;        // Index of currently selected option
  notes?: string;                 // "Depends on weather" or "No plans yet"
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

// ==================== POI SUGGESTION SYSTEM ====================

// Extended POI categories for suggestions (beyond basic map markers)
export type POISuggestionCategory =
  | 'viewpoint'      // Scenic overlooks, panoramic views
  | 'attraction'     // Tourist attractions, landmarks
  | 'museum'         // Museums, galleries, cultural sites
  | 'park'           // National parks, nature reserves
  | 'landmark'       // Memorials, monuments, historic markers
  | 'waterfall'      // Waterfalls, natural wonders
  | 'restaurant'     // Full-service dining
  | 'cafe'           // Coffee shops, quick bites
  | 'gas'            // Gas stations (can overlap with fuel stops)
  | 'hotel'          // Accommodation (can overlap with overnight)
  | 'shopping'       // Shops, markets, outlets
  | 'entertainment'; // Theaters, arcades, activities

// Corridor bucket - where the POI suggestion appears
export type POIBucket = 'along-way' | 'destination';

// User action state for POI suggestions
export type POIActionState = 'suggested' | 'dismissed' | 'added' | 'noted';

// Smart POI suggestion with ranking metadata
export interface POISuggestion {
  id: string;
  name: string;
  category: POISuggestionCategory;
  lat: number;
  lng: number;
  address?: string;

  // Corridor metadata
  bucket: POIBucket; // Along the way or at destination
  distanceFromRoute: number; // km from route centerline
  detourTimeMinutes: number; // Extra time to visit and return to route
  segmentIndex?: number; // Which route segment this is near (for along-way)

  // Timing context
  estimatedArrivalTime?: Date; // When you'd reach this POI
  fitsInBreakWindow?: boolean; // True if it fits in existing break/meal stop

  // Ranking scores (0-100)
  rankingScore: number; // Overall composite score
  categoryMatchScore: number; // How well it matches user preferences
  popularityScore: number; // Based on OSM tags (tourism=yes, etc.)
  timingFitScore: number; // How well it fits into natural break windows

  // User interaction state
  actionState: POIActionState;
  userNotes?: string; // Optional notes when saved to journal

  // OSM metadata
  osmType?: 'node' | 'way' | 'relation';
  osmId?: string;
  tags?: Record<string, string>; // Raw OSM tags for rich data
}

// Consolidated POI suggestion panel data
export interface POISuggestionGroup {
  alongWay: POISuggestion[]; // 3-5 top picks along the route corridor
  atDestination: POISuggestion[]; // 3-5 top picks at destination area
  totalFound: number; // Total POIs found before ranking/filtering
  queryDurationMs?: number; // Performance metric
}

// ==================== JOURNAL SYSTEM ====================

// Photo with caption and metadata
export interface JournalPhoto {
  id: string;
  dataUrl: string; // Base64 compressed image
  caption: string;
  timestamp: Date;
  location?: {
    lat: number;
    lng: number;
    name?: string;
  };
}

// Journal entry for a specific stop
export interface JournalEntry {
  id: string;
  stopId: string; // Links to segment/stop in itinerary
  segmentIndex: number; // Which segment this entry is for

  // User content
  photos: JournalPhoto[];
  notes: string;

  // Actual vs Planned times
  plannedArrival?: Date;
  actualArrival?: Date;
  plannedDeparture?: Date;
  actualDeparture?: Date;

  // Stop status
  status: 'planned' | 'visited' | 'skipped' | 'modified';
  skipReason?: string; // If skipped, why?

  // Highlight
  isHighlight: boolean;
  highlightReason?: string;

  // Weather snapshot (auto-captured)
  weatherSnapshot?: WeatherData;

  // Rating
  rating?: 1 | 2 | 3 | 4 | 5;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Track actual spending vs planned
export interface BudgetActual {
  id: string;
  category: 'gas' | 'hotel' | 'food' | 'misc';
  planned: number;
  actual: number;
  description?: string; // "Shell station on Hwy 1"
  dayNumber: number;
  timestamp: Date;
}

// Quick capture entry (GPS auto-tagged)
export interface QuickCapture {
  id: string;
  photo?: JournalPhoto; // Optional — captures can be notes-only with no photo
  autoTaggedSegment?: number; // Nearest segment index
  autoTaggedLocation?: string; // "Near Salmon Arm"
  timestamp: Date;
  category?: 'food' | 'attraction' | 'scenic' | 'shopping' | 'other';
  gpsCoords?: { lat: number; lng: number }; // Device GPS at time of capture
}

// Mood emoji for day summary
export type JournalMood = '😊' | '😅' | '🤯' | '😴' | '🎉' | '😤' | '🥰';

// Day title customization
export interface JournalDayMeta {
  dayNumber: number;
  customTitle?: string; // "The Day We Got Lost"
  mood?: JournalMood;
  summary?: string; // Brief day summary
}

// Privacy levels for template sharing
export type TemplatePrivacy =
  | 'full'          // Route + POIs + budget + photos + notes
  | 'route-only'    // Just waypoints, no personal data
  | 'highlights'    // Only starred stops with photos
  | 'private';      // Never shareable

// Complete trip journal
/** Where did this trip originate? Stored on TripJournal for fork attribution. */
export interface TripOrigin {
  type: 'challenge' | 'template' | 'manual';
  id?: string;       // challenge ID or template slug
  title: string;     // e.g. "The Eastern US Gauntlet" / "Aaron's BC Loop"
  author?: string;   // template author name if imported from file
}

export interface TripJournal {
  id: string;
  version: '1.0';

  // Origin tracking — how did this journal start?
  origin?: TripOrigin;

  // Link to original trip plan
  tripSummaryId?: string;
  tripSummary: TripSummary;
  settings: TripSettings;
  vehicle: Vehicle;

  // Journal content
  entries: JournalEntry[];
  quickCaptures: QuickCapture[];
  dayMeta: JournalDayMeta[];

  // Budget tracking
  budgetActuals: BudgetActual[];

  // Metadata
  metadata: {
    title: string; // "Vancouver to Banff Adventure"
    description?: string;
    coverPhotoId?: string; // ID of photo to use as cover
    tags: TripPreference[];
    travelers?: string[]; // Names of people on trip
    dates: {
      plannedStart: string;
      plannedEnd: string;
      actualStart?: string;
      actualEnd?: string;
    };
  };

  // Sharing settings
  sharing: {
    privacy: TemplatePrivacy;
    isPublic: boolean;
    includePhotos: boolean;
    includeBudget: boolean;
    includeNotes: boolean;
  };

  // Sync status (for offline support)
  sync: {
    status: 'synced' | 'pending' | 'offline';
    lastSynced: Date | null;
    pendingChanges: number;
  };

  // Stats (computed)
  stats: {
    photosCount: number;
    highlightsCount: number;
    stopsVisited: number;
    stopsSkipped: number;
    totalActualSpent: number;
    budgetVariance: number; // Actual - Planned
  };

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Template for sharing (stripped down version)
export interface TripTemplate {
  id: string;
  version: '1.0';

  // Creator info
  author?: string;
  createdAt: Date;

  // Template metadata
  metadata: {
    title: string;
    description: string;
    coverPhotoUrl?: string;
    tags: TripPreference[];
    budgetLevel: 'budget' | 'moderate' | 'comfort';
    durationDays: number;
    totalDistanceKm: number;
  };

  // Route data
  route: {
    locations: Location[];
    origin: Location;
    destination: Location;
  };

  // Recommendations from original trip
  recommendedPOIs?: POISuggestion[];
  budgetEstimates?: TripBudget;

  // Highlights from journal (if included)
  highlights?: {
    stopName: string;
    reason: string;
    photoUrl?: string;
  }[];

  // Community stats (future)
  communityStats?: {
    usageCount: number;
    avgRating: number;
    lastUsed: Date;
  };
}

// ==================== ADVENTURE MODE ====================

// Adventure Mode input configuration
export interface AdventureConfig {
  origin: Location;
  budget: number;
  days: number;
  travelers: number;
  preferences: TripPreference[];
  // Optional constraints
  maxDriveHoursPerDay?: number;
  accommodationType?: 'budget' | 'moderate' | 'comfort';
  isRoundTrip?: boolean; // Default true - set false for one-way adventures
}

// A reachable destination suggestion
export interface AdventureDestination {
  id: string;
  location: Location;
  name: string;
  description?: string;
  category: 'city' | 'nature' | 'beach' | 'mountain' | 'historic';

  // Distance & cost estimates
  distanceKm: number;
  estimatedDriveHours: number;

  // Budget breakdown
  estimatedCosts: {
    fuel: number;
    accommodation: number;
    food: number;
    total: number;
    remaining: number; // Budget - total = spending money
  };

  // Ranking
  score: number; // 0-100 composite score
  matchReasons: string[]; // Why this is a good match

  // Visual
  imageUrl?: string;
  tags: string[];
}

// Adventure Mode result
export interface AdventureResult {
  config: AdventureConfig;
  maxReachableKm: number; // Furthest you can go and return
  destinations: AdventureDestination[];
  calculatedAt: Date;
}

// ==================== CHICHARON'S CHALLENGES ====================

export type ChallengeDifficulty = 'cruiser' | 'road-warrior' | 'iron-driver' | 'gauntlet';

export interface TripChallenge {
  id: string;
  title: string;                     // "The Prairie Gauntlet"
  subtitle: string;                  // "Winnipeg → Toronto in 2 days"
  description: string;               // Flavor text / backstory
  difficulty: ChallengeDifficulty;
  emoji: string;                     // Card icon

  // Route data
  locations: Location[];             // Ordered: origin → waypoints → destination

  // Par stats (Chicharon's actual numbers)
  par: {
    totalDistanceKm: number;
    drivingDays: number;
    totalDriveHours: number;
    travelers: number;
    drivers: number;
    budget: number;                  // Total spend
    currency: Currency;
  };

  // Suggested settings for loading
  settings: Partial<TripSettings>;
  vehicle?: Vehicle;

  // Lore
  story?: string;                    // "It was -30°C and the highway was pure ice..."
  tips?: string[];                   // Chicharon's advice
  year?: number;                     // When the trip happened

  // Extended version link (e.g. Cruiser → Road Warrior variant of same route)
  extendedVersionId?: string;
}
