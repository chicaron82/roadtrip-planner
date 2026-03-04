// ==================== JOURNAL SYSTEM ====================
// Trip recording, sharing, and template types.

import type { Location, TripSettings, TripBudget, TripPreference, Vehicle } from './core';
import type { TripSummary, WeatherData } from './route';
import type { POISuggestion } from './poi';

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

/** Where did this trip originate? Stored on TripJournal for fork attribution. */
export interface TripOrigin {
  type: 'challenge' | 'template' | 'manual';
  id?: string;       // challenge ID or template slug
  title: string;     // e.g. "The Eastern US Gauntlet" / "Aaron's BC Loop"
  author?: string;   // template author name if imported from file
}

// Complete trip journal
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

  // Stop override state — accept/dismiss/duration edits from the editable itinerary.
  // Persisted here so they survive refresh and are inherited by journal sessions.
  // Keyed by SuggestedStop.id (e.g. 'fuel-2', 'overnight-1').
  stopOverrides?: Record<string, { accepted?: boolean; dismissed?: boolean; duration?: number }>;

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
