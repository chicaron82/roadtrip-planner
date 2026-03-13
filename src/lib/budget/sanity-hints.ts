import type { CostBreakdown } from '../../types/route';

export interface SanityHint {
  emoji: string;
  category: string;
  percentage: number; // whole number, e.g. 78
  message: string;
}

const HINTS: Record<string, { emoji: string; tip: string }> = {
  Gas:   { emoji: '⛽', tip: 'double-check your vehicle\'s fuel economy settings' },
  Hotel: { emoji: '🏨', tip: 'try off-peak dates or towns just off the main route' },
  Food:  { emoji: '🍽️', tip: 'meal prepping can stretch this on longer drives' },
  Misc:  { emoji: '💳', tip: 'adding more line items to other categories may help' },
};

const THRESHOLD = 65; // percentage — flag when a single category exceeds this

/**
 * Returns soft sanity hints when a single budget category dominates
 * the estimated spend. Fires proactively (even when trip is in-budget).
 * Only meaningful when at least 2 categories have non-zero estimated cost.
 */
export function getBudgetSanityHints(breakdown: CostBreakdown): SanityHint[] {
  const estimates: Record<string, number> = {
    Gas:   breakdown.fuel,
    Hotel: breakdown.accommodation,
    Food:  breakdown.meals,
    Misc:  breakdown.misc,
  };

  const total = Object.values(estimates).reduce((s, v) => s + v, 0);
  if (total <= 0) return [];

  const nonZero = Object.values(estimates).filter((v) => v > 0);
  if (nonZero.length < 2) return [];

  const hints: SanityHint[] = [];
  for (const [category, value] of Object.entries(estimates)) {
    if (value <= 0) continue;
    const pct = Math.round((value / total) * 100);
    if (pct >= THRESHOLD) {
      const { emoji, tip } = HINTS[category];
      hints.push({
        emoji,
        category,
        percentage: pct,
        message: `${emoji} ${category} takes up ${pct}% of your estimated spend — ${tip}.`,
      });
    }
  }
  return hints;
}
