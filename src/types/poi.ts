// ==================== POI SUGGESTION SYSTEM ====================

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

  // Round-trip: same physical place appears on outbound + return leg
  /** Segment index of the mirror occurrence on the return leg. Populated only
   *  when this POI is on the outbound leg and a corresponding return-leg POI
   *  was found within 2 km. UI should offer a leg picker when this is set. */
  mirrorSegmentIndex?: number;

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
  /** True when one or more corridor Overpass queries failed (429/timeout)
   *  and results cover only part of the route. UI should show a soft warning. */
  partialResults?: boolean;
}

