/**
 * trip-title-seeds — Deterministic seeded trip titles.
 *
 * Two pools:
 *   - Static poetic: evocative, Canadian/North American-flavored, destination-agnostic
 *   - Dynamic trip-aware: destination-specific templates
 *
 * Hash: djb2 on `destinationSlug-days-travelerCount`.
 * Same trip shape → same title, every time.
 *
 * 💚 My Experience Engine — Voilà title seeds
 */

export interface SeededTitleInput {
  destination: string;
  days: number;
  travelerCount: number;
}

// Static poetic pool — Canadian/North American spirit
const STATIC_SEEDS: string[] = [
  'Shield Country Calling',
  'The Long Road Out',
  'Somewhere Past the Pines',
  'Where the Highway Opens Up',
  'Into the Interior',
  'Lake Country, Open Road',
  'North of What You Know',
  'Chasing the Last Good Light',
  'A Few Days West',
  'The Distance Is the Point',
  'One Tank, One Highway',
  'Big Sky, Bigger Drive',
  'Where the Map Gets Quiet',
  'Outbound',
  'Pull of the Road',
  'Nothing but the Open',
  'Running the Corridor',
  'Edge of the Shield',
  'Far Enough',
  'Where the Trees Thin Out',
  'Keep the Tank Half Full',
  'The Prairie Stretch',
  'Somewhere the Signal Drops',
  'A Proper Canadian Haul',
  'The Kind of Trip You Don\'t Plan Twice',
];

// Dynamic trip-aware pool — destination-specific templates
const DYNAMIC_SEEDS: Array<(dest: string) => string> = [
  (d) => `${d} or Bust`,
  (d) => `${d} Was the Plan All Along`,
  (d) => `Somewhere Around ${d}`,
  (d) => `Bound for ${d}`,
  (d) => `Making It to ${d}`,
  (d) => `${d}, Eventually`,
  (d) => `${d}: The Long Way`,
  (d) => `Chasing ${d}`,
  (d) => `${d} Was Calling`,
  (d) => `The ${d} Run`,
  (d) => `See You in ${d}`,
  (d) => `The Road to ${d}`,
  (d) => `Getting to ${d}`,
  (d) => `${d} by Nightfall`,
  (d) => `Your MEE Time in ${d}`,
];

// Combined pool — static entries are strings, dynamic are functions
type Seed = string | ((dest: string) => string);
const ALL_SEEDS: Seed[] = [...STATIC_SEEDS, ...DYNAMIC_SEEDS];

/** djb2 hash — unsigned 32-bit integer */
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0;
  }
  return hash;
}

/**
 * Returns a deterministic trip title from the seed pool.
 * Same destination + days + travelerCount always returns the same title.
 */
export function buildSeededTitle({ destination, days, travelerCount }: SeededTitleInput): string {
  if (!destination) return 'The Open Road';

  const slug = destination.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const key = `${slug}-${days}-${travelerCount}`;
  const hash = djb2(key);
  const seed = ALL_SEEDS[hash % ALL_SEEDS.length];

  return typeof seed === 'function' ? seed(destination) : seed;
}
