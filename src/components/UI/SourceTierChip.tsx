/**
 * SourceTierChip — compact label chip expressing trip source authorship.
 *
 * Reflects the Declared / Inferred / Discovered design language:
 *   declared   → solid chip  — "I chose this"
 *   inferred   → outlined    — "MEE figured this out for me"
 *   discovered → ghost       — "MEE found this for me to consider"
 *
 * Visual weight is intentionally subtle — this should add clarity,
 * never compete with the stop card content itself.
 *
 * 💚 Declared vs Inferred vs Discovered — MEE Design Language
 */

import type { SourceTier } from '../../lib/mee-tokens';
import { SOURCE_TIER_CHIP_WEIGHT, SOURCE_TIER_LABELS } from '../../lib/mee-tokens';

export interface SourceTierChipProps {
  tier: SourceTier;
  /** Override the default label for this tier. */
  label?: string;
  className?: string;
}

const CHIP_STYLES: Record<import('../../lib/mee-tokens').ChipWeight, string> = {
  // Declared — confident, owned, primary
  solid:    'bg-slate-700/85 text-white',
  // Inferred — present, trustworthy, secondary
  outlined: 'border border-slate-300 text-slate-500 bg-transparent',
  // Discovered — optional, exploratory, soft
  ghost:    'bg-slate-100 text-slate-400',
};

export function SourceTierChip({ tier, label, className = '' }: SourceTierChipProps) {
  const weight   = SOURCE_TIER_CHIP_WEIGHT[tier];
  const chipText = label ?? SOURCE_TIER_LABELS[tier];

  return (
    <span
      className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-medium leading-none ${CHIP_STYLES[weight]} ${className}`}
    >
      {chipText}
    </span>
  );
}
