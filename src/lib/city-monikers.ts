/**
 * city-monikers.ts — Local flavor dictionary for trip title generation.
 *
 * Rules:
 *  - Bake "The" into the string where it belongs. Generator does no
 *    article inference.
 *  - Only include monikers that are widely recognized and feel earned.
 *    When in doubt, leave the city out.
 *  - Add tone tags for future title-voice matching.
 *
 * 💚 My Experience Engine — Local flavor layer
 */

export type MonikerTone = 'iconic' | 'local' | 'playful' | 'cinematic' | 'romantic';

export interface CityMoniker {
  moniker: string;
  tone: MonikerTone;
}

export const CITY_MONIKERS: Record<string, CityMoniker> = {

  // ── Canada ────────────────────────────────────────────────────────────────

  'Winnipeg':       { moniker: 'The Peg',                tone: 'local' },
  'Toronto':        { moniker: 'The 6ix',                tone: 'local' },
  'Vancouver':      { moniker: 'Vancity',                tone: 'local' },
  'Montreal':       { moniker: 'The City of Saints',     tone: 'romantic' },
  'Calgary':        { moniker: 'Cowtown',                tone: 'playful' },
  'Edmonton':       { moniker: 'The City of Champions',  tone: 'iconic' },
  'Thunder Bay':    { moniker: 'T-Bay',                  tone: 'local' },
  'Regina':         { moniker: 'The Queen City',         tone: 'cinematic' },
  'Saskatoon':      { moniker: 'Toon Town',              tone: 'playful' },
  'Victoria':       { moniker: 'The Garden City',        tone: 'romantic' },
  'Halifax':        { moniker: 'Hali',                   tone: 'local' },
  'Ottawa':         { moniker: "The Nation's Capital",   tone: 'iconic' },
  'Quebec City':    { moniker: 'The Old Capital',        tone: 'cinematic' },
  'Kelowna':        { moniker: 'The Okanagan',           tone: 'romantic' },
  'Banff':          { moniker: 'The Rockies',            tone: 'cinematic' },
  'Whistler':       { moniker: 'The Mountain',           tone: 'cinematic' },
  'Medicine Hat':   { moniker: 'The Hat',                tone: 'playful' },
  'Sudbury':        { moniker: 'The Nickel City',        tone: 'iconic' },
  'Lethbridge':     { moniker: 'The Bridge',             tone: 'local' },

  // ── USA ───────────────────────────────────────────────────────────────────

  'New York':       { moniker: 'The Big Apple',          tone: 'iconic' },
  'New York City':  { moniker: 'The Big Apple',          tone: 'iconic' },
  'Chicago':        { moniker: 'The Windy City',         tone: 'iconic' },
  'Las Vegas':      { moniker: 'Sin City',               tone: 'playful' },
  'New Orleans':    { moniker: 'The Big Easy',           tone: 'romantic' },
  'Los Angeles':    { moniker: 'The City of Angels',     tone: 'cinematic' },
  'Miami':          { moniker: 'The Magic City',         tone: 'playful' },
  'Detroit':        { moniker: 'Motor City',             tone: 'iconic' },
  'Nashville':      { moniker: 'Music City',             tone: 'iconic' },
  'San Francisco':  { moniker: 'The Bay',                tone: 'cinematic' },
  'Seattle':        { moniker: 'The Emerald City',       tone: 'cinematic' },
  'Pittsburgh':     { moniker: 'The Steel City',         tone: 'iconic' },
  'Philadelphia':   { moniker: 'Philly',                 tone: 'local' },
  'Minneapolis':    { moniker: 'The Twin Cities',        tone: 'local' },
  'Denver':         { moniker: 'The Mile High City',     tone: 'playful' },
  'Portland':       { moniker: 'PDX',                    tone: 'local' },
  'Austin':         { moniker: 'ATX',                    tone: 'local' },
  'Atlanta':        { moniker: 'ATL',                    tone: 'local' },
  'Boston':         { moniker: 'Beantown',               tone: 'playful' },
  'Kansas City':    { moniker: 'The BBQ Capital',        tone: 'playful' },

};

/**
 * Returns the city moniker if one exists, otherwise the original city name.
 *
 * The 70/30 gate (Math.random() > 0.7) keeps monikers feeling like
 * a pleasant surprise rather than a predictable pattern. Same trip shape
 * will sometimes get the moniker, sometimes the city name.
 *
 * Pass forceMoniker: true in tests or for permanent display surfaces
 * (e.g. journal headers, signature card) to bypass the random gate and
 * always apply the moniker when available.
 */
export function getCityMoniker(
  city: string,
  options?: { forceMoniker?: boolean }
): string {
  // Sanitize: trim + normalize for lookup
  const normalized = city.trim();
  const entry = CITY_MONIKERS[normalized];

  if (!entry) return normalized;

  // 70/30 rule: Tori's "curated spice rack, not a ketchup bottle"
  // forceMoniker bypasses this for permanent surfaces (journal titles, exports)
  if (!options?.forceMoniker && Math.random() > 0.7) return normalized;

  return entry.moniker;
}
