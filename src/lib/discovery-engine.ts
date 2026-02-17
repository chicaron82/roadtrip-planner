/**
 * Discovery Engine — "Make This Trip Legendary"
 *
 * Takes ranked POI suggestions and layers on:
 * - Discovery tiers (🔥 No-Brainer → 👀 Worth the Detour → 🤷 If You Have Time)
 * - Time budget filtering (greedy knapsack by score/time)
 * - Route-order sorting (by segment index, not just score)
 * - Wikipedia link extraction from OSM tags
 *
 * Pure functions — no side effects, no state.
 */

import type { POISuggestion } from '../types';

// ==================== TYPES ====================

export type DiscoveryTier = 'no-brainer' | 'worth-detour' | 'if-time';

export interface DiscoveredPOI extends POISuggestion {
  tier: DiscoveryTier;
  wikiUrl: string | null;
}

export const TIER_META: Record<DiscoveryTier, {
  label: string;
  emoji: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  'no-brainer': {
    label: 'No-Brainer',
    emoji: '🔥',
    description: 'High value, minimal detour — just do it',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
  },
  'worth-detour': {
    label: 'Worth the Detour',
    emoji: '👀',
    description: 'Great stop if you can spare the time',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
  },
  'if-time': {
    label: 'If You Have Time',
    emoji: '🤷',
    description: 'Cool but not essential',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },
};

// ==================== TIER ASSIGNMENT ====================

/**
 * Assign a discovery tier based on ranking score + detour cost.
 * 🔥 No-Brainer: score ≥ 70 AND detour ≤ 15min
 * 👀 Worth the Detour: score ≥ 50 OR detour ≤ 10min
 * 🤷 If You Have Time: everything else that passed ranking
 */
function assignTier(poi: POISuggestion): DiscoveryTier {
  const { rankingScore, detourTimeMinutes } = poi;

  if (rankingScore >= 70 && detourTimeMinutes <= 15) return 'no-brainer';
  if (rankingScore >= 50 || detourTimeMinutes <= 10) return 'worth-detour';
  return 'if-time';
}

// ==================== WIKIPEDIA LINKS ====================

/**
 * Extract a Wikipedia URL from OSM tags.
 * Common tag formats:
 * - wikipedia=en:Giant Nickel
 * - wikipedia=https://en.wikipedia.org/wiki/Giant_Nickel
 * - wikidata=Q12345
 */
export function extractWikiUrl(tags?: Record<string, string>): string | null {
  if (!tags) return null;

  // Direct wikipedia tag
  if (tags.wikipedia) {
    const val = tags.wikipedia;
    if (val.startsWith('http')) return val;
    // Format: "en:Article Name"
    const match = val.match(/^(\w+):(.+)$/);
    if (match) {
      const [, lang, article] = match;
      return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(article.replace(/ /g, '_'))}`;
    }
  }

  // Wikidata fallback
  if (tags.wikidata) {
    return `https://www.wikidata.org/wiki/${tags.wikidata}`;
  }

  return null;
}

// ==================== CORE ENGINE ====================

/**
 * Transform ranked POI suggestions into discovered POIs with tiers + wiki links.
 * Returns sorted by route order (segmentIndex), NOT by score.
 */
export function discoverPOIs(pois: POISuggestion[]): DiscoveredPOI[] {
  return pois
    .filter(p => p.actionState !== 'dismissed')
    .map(poi => ({
      ...poi,
      tier: assignTier(poi),
      wikiUrl: extractWikiUrl(poi.tags),
    }))
    .sort((a, b) => (a.segmentIndex ?? 0) - (b.segmentIndex ?? 0));
}

/**
 * Filter discovered POIs to fit within a time budget (minutes).
 * Greedy approach: takes highest-score POIs first until budget is exhausted.
 * Always includes all no-brainers regardless of budget.
 */
export function filterByTimeBudget(
  pois: DiscoveredPOI[],
  budgetMinutes: number
): DiscoveredPOI[] {
  // No-brainers always included
  const nobrainers = pois.filter(p => p.tier === 'no-brainer');
  const others = pois
    .filter(p => p.tier !== 'no-brainer')
    .sort((a, b) => b.rankingScore - a.rankingScore);

  let remaining = budgetMinutes - nobrainers.reduce((sum, p) => sum + p.detourTimeMinutes, 0);
  const fitted: DiscoveredPOI[] = [...nobrainers];

  for (const poi of others) {
    if (poi.detourTimeMinutes <= remaining) {
      fitted.push(poi);
      remaining -= poi.detourTimeMinutes;
    }
  }

  // Re-sort by route order
  return fitted.sort((a, b) => (a.segmentIndex ?? 0) - (b.segmentIndex ?? 0));
}

/**
 * Get just the no-brainer stops (for "Add All No-Brainers" button).
 */
export function getNobrainers(pois: DiscoveredPOI[]): DiscoveredPOI[] {
  return pois.filter(p => p.tier === 'no-brainer');
}

/**
 * Get tier counts for display.
 */
export function getTierCounts(pois: DiscoveredPOI[]): Record<DiscoveryTier, number> {
  return {
    'no-brainer': pois.filter(p => p.tier === 'no-brainer').length,
    'worth-detour': pois.filter(p => p.tier === 'worth-detour').length,
    'if-time': pois.filter(p => p.tier === 'if-time').length,
  };
}

/**
 * Calculate total detour time for a set of POIs (minutes).
 */
export function totalDetourMinutes(pois: DiscoveredPOI[]): number {
  return pois.reduce((sum, p) => sum + p.detourTimeMinutes, 0);
}
