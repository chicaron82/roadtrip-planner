/**
 * MEE Tokens · Vocabulary — string unions that enforce the editorial voice spec at compile time.
 *
 * Import from `lib/mee-tokens`, not from here — the barrel is the contract.
 */

/**
 * Approved health/status phrases for trip summary surfaces.
 * These map to FeasibilityStatus + driver count context.
 */
export type TripHealthPhrase =
  | 'Balanced'
  | 'Comfort-first'
  | 'Ambitious but workable'
  | 'Shared-driver friendly'
  | 'Heavy driving day'
  | 'A long push'
  | 'Light stop pressure'
  | 'Low stop pressure'
  | 'Strong shared-driver fit'
  | 'Well suited to shared driving';

/**
 * Approved road-language terms.
 * Using this type in builder params prevents system-language from leaking in.
 */
export type RoadLanguageTerm =
  | 'journey'
  | 'route'
  | 'road'
  | 'drive'
  | 'leg'
  | 'reset'
  | 'anchor'
  | 'rhythm'
  | 'pacing'
  | 'push'
  | 'stretch'
  | 'run'
  | 'overnight'
  | 'stop';
