/**
 * MEE Tokens · Source tiers — Declared / Verified / Inferred / Discovered, and their chip metadata.
 *
 * Split out of the old single-file mee-tokens.ts (374 lines, over the 330 cap) along the seam its own
 * header already named. Import from `lib/mee-tokens`, not from here — the barrel is the contract.
 */

/**
 * The four tiers of trip truth, in descending authority order.
 *
 * declared   — the user explicitly authored this
 * verified   — grounded in real historical trip data (hub cache, challenge pars)
 * inferred   — engine-estimated to make the trip viable or coherent
 * discovered — optional enrichment, not canonical until accepted
 */
export type SourceTier = 'declared' | 'verified' | 'inferred' | 'discovered';

/**
 * Authority ranking: higher is more authoritative.
 * Use for sort/comparison logic when tiers need ordering.
 */
export const SOURCE_TIER_RANK: Record<SourceTier, number> = {
  declared:   4,
  verified:   3,
  inferred:   2,
  discovered: 1,
};

/**
 * Chip/tag labels — the exact strings that appear in the UI.
 * Use the shortest clear phrasing that fits the surface context.
 */
export const SOURCE_TIER_LABELS = {
  // Primary short labels (chip / tag context)
  declared:           'Declared',
  verified:           'From real experience',
  inferred:           'Estimated by MEE',
  discovered:         'Suggested by MEE',

  // Extended labels (helper copy / row context)
  declaredStop:       'Declared stop',
  declaredOvernight:  'Declared overnight',
  customTitle:        'Custom title',
  autoTitle:          'Auto title',
  engineEstimated:    'Engine-estimated',
  engineSupport:      'Engine support',
  meeEstimatedStop:   'MEE-estimated stop',
  meeWillInfer:       'MEE will infer',
  nearbyDiscovery:    'Nearby discovery',
  worthALook:         'Worth a look',
  optionalStop:       'Optional stop',
  suggestedByMee:     'Suggested by MEE',
} as const;

export type SourceTierLabelKey = keyof typeof SOURCE_TIER_LABELS;

/**
 * Visual weight hint for each tier.
 * Components use this to select styling (filled vs outlined vs ghost chip).
 * Not a Tailwind class — intentionally generic so the design system can evolve.
 */
export type ChipWeight = 'solid' | 'outlined' | 'ghost';

export const SOURCE_TIER_CHIP_WEIGHT: Record<SourceTier, ChipWeight> = {
  declared:   'solid',
  verified:   'solid',
  inferred:   'outlined',
  discovered: 'ghost',
};
