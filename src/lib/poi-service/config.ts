import type { POISuggestionCategory, TripPreference } from '../../types';

// Overpass API endpoint
export const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

// Destination search radius (50km around destination city center)
export const DESTINATION_RADIUS = 50000;

// Delay between sequential Overpass queries to avoid 429 (ms)
export const INTER_QUERY_DELAY = 2500;

// Delay between corridor and park-relation queries when run sequentially
export const INTRA_FETCH_DELAY = 1500;

// Max Overpass retries on 429 (rate limit).
// Overpass recommends ~30s cooldown after a 429. With exponential backoff
// at base 12s: retries fire at ~12s, ~24s, ~48s — much friendlier.
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 12000;

/**
 * OSM tag mapping for POI categories.
 * Each category maps to one or more Overpass QL tag filters.
 * Multiple filters are OR'd together in the union query.
 *
 * Park uses two filters: leisure=nature_reserve catches smaller reserves,
 * boundary=protected_area catches Canadian/US provincial & national parks
 * (which are stored as relations in OSM, not nodes/ways with leisure tags).
 */
export const CATEGORY_TAG_QUERIES: Record<POISuggestionCategory, string[]> = {
  viewpoint:     ['["tourism"="viewpoint"]'],
  attraction:    ['["tourism"~"attraction|theme_park|zoo|camp_site|picnic_site|information"]'],
  museum:        ['["tourism"~"museum|gallery|artwork"]'],
  park:          ['["leisure"~"park|nature_reserve"]', '["boundary"="protected_area"]'],
  landmark:      ['["historic"~"memorial|monument|castle|ruins|archaeological_site|heritage"]'],
  waterfall:     ['["natural"~"waterfall|cave_entrance|beach|arch|cliff"]'],
  restaurant:    ['["amenity"="restaurant"]'],
  cafe:          ['["amenity"="cafe"]'],
  gas:           ['["amenity"="fuel"]'],
  hotel:         ['["tourism"~"hotel|motel|guest_house"]'],
  shopping:      ['["shop"~"supermarket|mall|department_store"]'],
  entertainment: ['["leisure"~"amusement_arcade|bowling_alley|water_park"]'],
};

/**
 * Categories always fetched in the corridor query regardless of user preferences.
 * Gas stations, restaurants, and cafes carry addr:city metadata used by the
 * hub-detection / stop-town resolver. Including them here means usePOI can
 * pull an inference corpus from poiData.alongWay instead of firing a second
 * Overpass fetch with different preference overrides.
 */
export const INFERENCE_CATEGORIES: POISuggestionCategory[] = ['gas', 'restaurant', 'cafe'];

/**
 * Map trip preferences to POI categories
 */
export const PREFERENCE_CATEGORY_MAP: Record<TripPreference, POISuggestionCategory[]> = {
  scenic: ['viewpoint', 'park', 'waterfall', 'landmark'],
  family: ['attraction', 'park', 'entertainment', 'landmark'],
  budget: ['viewpoint', 'park', 'cafe', 'waterfall'],
  foodie: ['restaurant', 'cafe'],
};
