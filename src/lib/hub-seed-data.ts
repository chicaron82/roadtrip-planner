/**
 * hub-seed-data.ts — Initial Highway Hub Seed Data
 *
 * Pre-seeds the hub cache with major highway corridor cities.
 * These are well-known stops that travelers would recognize.
 *
 * Organized by corridor for easy maintenance.
 * Coordinates are approximate city centers.
 *
 * 💚 My Experience Engine
 */

import { seedHubCache, clearHubCache } from './hub-cache';

/**
 * Self-contained SeedHub type — mirrors DiscoveredHub minus `lastUsed`
 * (which is always set at runtime by seedHubCache).
 * Kept local to avoid a circular import with hub-cache.ts.
 */
interface SeedHub {
  name: string;
  lat: number;
  lng: number;
  radius: number;
  poiCount: number;
  /** Date this hub was added to seed data (not runtime discovery date). */
  discoveredAt: string;
  source: 'seed' | 'discovered';
}

/** Date these hubs were last curated. Update when adding/removing hubs. */
const SEED_DATE = '2026-01-01';

/**
 * Bump this version whenever the hub resolution logic changes in a way
 * that may have produced incorrect discovered-hub entries in localStorage.
 * initializeHubCache will wipe + re-seed if the stored version differs.
 */
const CACHE_VERSION = '2';
const CACHE_VERSION_KEY = 'roadtrip-hub-cache-version';

// ─── I-94 Corridor (Seattle → Detroit) ────────────────────────────────────────

const I94_CORRIDOR: SeedHub[] = [
  { name: 'Fargo, ND', lat: 46.877, lng: -96.789, radius: 30, poiCount: 15, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Bismarck, ND', lat: 46.808, lng: -100.784, radius: 25, poiCount: 10, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Billings, MT', lat: 45.783, lng: -108.500, radius: 30, poiCount: 12, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Minneapolis, MN', lat: 44.977, lng: -93.265, radius: 50, poiCount: 25, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'St. Paul, MN', lat: 44.954, lng: -93.090, radius: 40, poiCount: 20, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Madison, WI', lat: 43.074, lng: -89.384, radius: 35, poiCount: 15, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Milwaukee, WI', lat: 43.039, lng: -87.906, radius: 45, poiCount: 22, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Chicago, IL', lat: 41.878, lng: -87.630, radius: 60, poiCount: 50, discoveredAt: SEED_DATE, source: 'seed' },
];

// ─── I-90 Corridor (Boston → Seattle) ─────────────────────────────────────────

const I90_CORRIDOR: SeedHub[] = [
  { name: 'Sioux Falls, SD', lat: 43.545, lng: -96.731, radius: 30, poiCount: 12, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Rapid City, SD', lat: 44.080, lng: -103.231, radius: 25, poiCount: 10, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Albert Lea, MN', lat: 43.648, lng: -93.368, radius: 20, poiCount: 8, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Rochester, MN', lat: 44.021, lng: -92.470, radius: 30, poiCount: 15, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'La Crosse, WI', lat: 43.801, lng: -91.239, radius: 25, poiCount: 10, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Wisconsin Dells, WI', lat: 43.627, lng: -89.771, radius: 25, poiCount: 12, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Rockford, IL', lat: 42.271, lng: -89.094, radius: 30, poiCount: 12, discoveredAt: SEED_DATE, source: 'seed' },
];

// ─── Trans-Canada Highway (Winnipeg → Thunder Bay) ────────────────────────────

const TRANS_CANADA_CENTRAL: SeedHub[] = [
  { name: 'Winnipeg, MB', lat: 49.895, lng: -97.138, radius: 45, poiCount: 25, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Brandon, MB', lat: 49.848, lng: -99.950, radius: 25, poiCount: 10, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Regina, SK', lat: 50.445, lng: -104.619, radius: 35, poiCount: 15, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Saskatoon, SK', lat: 52.157, lng: -106.670, radius: 35, poiCount: 15, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Calgary, AB', lat: 51.049, lng: -114.071, radius: 50, poiCount: 30, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Edmonton, AB', lat: 53.546, lng: -113.494, radius: 50, poiCount: 30, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Kenora, ON', lat: 49.767, lng: -94.490, radius: 20, poiCount: 8, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Thunder Bay, ON', lat: 48.382, lng: -89.246, radius: 30, poiCount: 12, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Sault Ste. Marie, ON', lat: 46.522, lng: -84.346, radius: 25, poiCount: 10, discoveredAt: SEED_DATE, source: 'seed' },
];

// ─── BC Corridor (Calgary → Vancouver) ───────────────────────────────────────

const BC_CORRIDOR: SeedHub[] = [
  { name: 'Golden, BC', lat: 51.296, lng: -116.965, radius: 20, poiCount: 6, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Revelstoke, BC', lat: 50.999, lng: -118.196, radius: 20, poiCount: 6, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Kamloops, BC', lat: 50.674, lng: -120.327, radius: 35, poiCount: 18, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Hope, BC', lat: 49.381, lng: -121.441, radius: 20, poiCount: 8, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Vancouver, BC', lat: 49.283, lng: -123.121, radius: 55, poiCount: 40, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Kelowna, BC', lat: 49.888, lng: -119.496, radius: 35, poiCount: 15, discoveredAt: SEED_DATE, source: 'seed' },
];

// ─── Northern Ontario Corridor (Winnipeg → Sault Ste. Marie) ─────────────────

const NORTHERN_ONTARIO: SeedHub[] = [
  { name: 'Dryden, ON', lat: 49.783, lng: -92.838, radius: 20, poiCount: 6, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'White River, ON', lat: 48.593, lng: -85.281, radius: 15, poiCount: 4, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Wawa, ON', lat: 47.927, lng: -84.779, radius: 15, poiCount: 5, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Chapleau, ON', lat: 47.842, lng: -83.399, radius: 15, poiCount: 4, discoveredAt: SEED_DATE, source: 'seed' },
];

// ─── Ontario Corridor (Toronto → Ottawa → Montreal) ───────────────────────────

const ONTARIO_CORRIDOR: SeedHub[] = [
  { name: 'Toronto, ON', lat: 43.653, lng: -79.383, radius: 60, poiCount: 50, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Ottawa, ON', lat: 45.421, lng: -75.697, radius: 45, poiCount: 25, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Kingston, ON', lat: 44.231, lng: -76.486, radius: 25, poiCount: 10, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Montreal, QC', lat: 45.501, lng: -73.567, radius: 55, poiCount: 40, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'London, ON', lat: 42.984, lng: -81.246, radius: 35, poiCount: 15, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Hamilton, ON', lat: 43.256, lng: -79.869, radius: 35, poiCount: 18, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Sudbury, ON', lat: 46.522, lng: -80.953, radius: 25, poiCount: 10, discoveredAt: SEED_DATE, source: 'seed' },
];

// ─── I-75 Corridor (Michigan → Florida) ───────────────────────────────────────

const I75_CORRIDOR: SeedHub[] = [
  { name: 'Detroit, MI', lat: 42.331, lng: -83.046, radius: 50, poiCount: 35, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Toledo, OH', lat: 41.664, lng: -83.556, radius: 30, poiCount: 15, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Cincinnati, OH', lat: 39.103, lng: -84.512, radius: 45, poiCount: 25, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Lexington, KY', lat: 38.040, lng: -84.503, radius: 30, poiCount: 15, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Knoxville, TN', lat: 35.961, lng: -83.921, radius: 35, poiCount: 18, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Atlanta, GA', lat: 33.749, lng: -84.388, radius: 55, poiCount: 40, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Tampa, FL', lat: 27.951, lng: -82.459, radius: 50, poiCount: 35, discoveredAt: SEED_DATE, source: 'seed' },
];

// ─── I-95 Corridor (Maine → Florida) ──────────────────────────────────────────

const I95_CORRIDOR: SeedHub[] = [
  { name: 'Boston, MA', lat: 42.361, lng: -71.057, radius: 50, poiCount: 40, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Providence, RI', lat: 41.824, lng: -71.413, radius: 30, poiCount: 15, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'New York, NY', lat: 40.713, lng: -74.006, radius: 60, poiCount: 60, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Philadelphia, PA', lat: 39.953, lng: -75.164, radius: 50, poiCount: 35, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Baltimore, MD', lat: 39.290, lng: -76.612, radius: 45, poiCount: 30, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Washington, DC', lat: 38.907, lng: -77.037, radius: 50, poiCount: 40, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Richmond, VA', lat: 37.541, lng: -77.436, radius: 35, poiCount: 18, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Jacksonville, FL', lat: 30.332, lng: -81.656, radius: 45, poiCount: 25, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Miami, FL', lat: 25.762, lng: -80.192, radius: 55, poiCount: 40, discoveredAt: SEED_DATE, source: 'seed' },
];

// ─── Western US ───────────────────────────────────────────────────────────────

const WESTERN_US: SeedHub[] = [
  { name: 'Seattle, WA', lat: 47.606, lng: -122.332, radius: 50, poiCount: 35, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Portland, OR', lat: 45.523, lng: -122.677, radius: 45, poiCount: 30, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'San Francisco, CA', lat: 37.775, lng: -122.419, radius: 50, poiCount: 40, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Los Angeles, CA', lat: 34.052, lng: -118.244, radius: 60, poiCount: 60, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'San Diego, CA', lat: 32.716, lng: -117.161, radius: 50, poiCount: 35, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Las Vegas, NV', lat: 36.169, lng: -115.140, radius: 50, poiCount: 40, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Phoenix, AZ', lat: 33.449, lng: -112.074, radius: 55, poiCount: 40, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Denver, CO', lat: 39.739, lng: -104.990, radius: 50, poiCount: 35, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Salt Lake City, UT', lat: 40.761, lng: -111.891, radius: 45, poiCount: 25, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Boise, ID', lat: 43.615, lng: -116.202, radius: 35, poiCount: 18, discoveredAt: SEED_DATE, source: 'seed' },
];

// ─── Texas Triangle ───────────────────────────────────────────────────────────

const TEXAS: SeedHub[] = [
  { name: 'Dallas, TX', lat: 32.777, lng: -96.797, radius: 55, poiCount: 45, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Fort Worth, TX', lat: 32.755, lng: -97.331, radius: 45, poiCount: 30, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Houston, TX', lat: 29.760, lng: -95.370, radius: 55, poiCount: 50, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'San Antonio, TX', lat: 29.425, lng: -98.494, radius: 50, poiCount: 35, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'Austin, TX', lat: 30.267, lng: -97.743, radius: 45, poiCount: 30, discoveredAt: SEED_DATE, source: 'seed' },
  { name: 'El Paso, TX', lat: 31.761, lng: -106.485, radius: 40, poiCount: 20, discoveredAt: SEED_DATE, source: 'seed' },
];

// ─── Combined Export ──────────────────────────────────────────────────────────

export const SEED_HUBS: SeedHub[] = [
  ...I94_CORRIDOR,
  ...I90_CORRIDOR,
  ...TRANS_CANADA_CENTRAL,
  ...BC_CORRIDOR,
  ...NORTHERN_ONTARIO,
  ...ONTARIO_CORRIDOR,
  ...I75_CORRIDOR,
  ...I95_CORRIDOR,
  ...WESTERN_US,
  ...TEXAS,
];

/**
 * Initialize the hub cache with seed data.
 * Called once in main.tsx before React mounts.
 * Clears stale discovered hubs when CACHE_VERSION bumps.
 */
export function initializeHubCache(): void {
  try {
    const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    if (storedVersion !== CACHE_VERSION) {
      // Resolution logic changed — nuke old discovered hubs and re-seed
      clearHubCache();
      localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
    }
  } catch {
    // localStorage unavailable — proceed anyway
  }
  seedHubCache(SEED_HUBS);
}
