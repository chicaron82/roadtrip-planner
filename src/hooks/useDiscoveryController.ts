/**
 * useDiscoveryController.ts — Discovery engine derivations and state for DiscoveryPanel.
 *
 * Extracts from DiscoveryPanel:
 *  - timeBudget state (UI: 0–240 min slider)
 *  - isExpanded state (panel collapse)
 *  - allDiscovered — discoverPOIs(suggestions) memoization
 *  - filteredPOIs — filterByTimeBudget(allDiscovered, timeBudget) memoization
 *  - tierCounts, nobrainers, detourTime — discovery engine derived values
 *  - grouped — tier-grouped POIs filtered and sorted for rendering
 *  - visibleCount — non-dismissed POI count (for header badge)
 *  - handleAddAllNobrainers — batch add no-brainer tier
 *
 * DiscoveryPanel becomes a layout-only component after this.
 *
 * 💚 My Experience Engine
 */

import { useState, useMemo } from 'react';
import type { POISuggestion } from '../types';
import {
  discoverPOIs,
  filterByTimeBudget,
  getNobrainers,
  getTierCounts,
  totalDetourMinutes,
  type DiscoveryTier,
} from '../lib/discovery-engine';

interface UseDiscoveryControllerOptions {
  suggestions: POISuggestion[];
  onAdd: (poiId: string, segmentIndex?: number) => void;
  onAddMultiple?: (poiIds: string[]) => void;
}

export interface GroupedTier {
  tier: DiscoveryTier;
  pois: ReturnType<typeof discoverPOIs>;
}

export interface UseDiscoveryControllerReturn {
  // UI state
  timeBudget: number;
  setTimeBudget: (v: number) => void;
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
  // Derived from discovery engine
  allDiscovered: ReturnType<typeof discoverPOIs>;
  filteredPOIs: ReturnType<typeof discoverPOIs>;
  tierCounts: ReturnType<typeof getTierCounts>;
  nobrainers: ReturnType<typeof getNobrainers>;
  detourTime: number;
  grouped: GroupedTier[];
  visibleCount: number;
  // Handlers
  handleAddAllNobrainers: () => void;
}

const DISCOVERY_TIERS: DiscoveryTier[] = ['no-brainer', 'worth-detour', 'if-time'];

export function useDiscoveryController({
  suggestions,
  onAdd,
  onAddMultiple,
}: UseDiscoveryControllerOptions): UseDiscoveryControllerReturn {
  const [timeBudget, setTimeBudget] = useState(60); // default 1h
  const [isExpanded, setIsExpanded] = useState(true);

  // ── Discovery engine pipeline ─────────────────────────────────────────────────
  const allDiscovered = useMemo(() => discoverPOIs(suggestions), [suggestions]);

  const filteredPOIs = useMemo(
    () => filterByTimeBudget(allDiscovered, timeBudget),
    [allDiscovered, timeBudget],
  );

  const tierCounts = useMemo(() => getTierCounts(filteredPOIs), [filteredPOIs]);
  const nobrainers = useMemo(() => getNobrainers(filteredPOIs), [filteredPOIs]);
  const detourTime = useMemo(() => totalDetourMinutes(filteredPOIs), [filteredPOIs]);

  const grouped = useMemo<GroupedTier[]>(() =>
    DISCOVERY_TIERS
      .map(tier => ({
        tier,
        pois: filteredPOIs.filter(p => p.tier === tier && p.actionState !== 'dismissed'),
      }))
      .filter(g => g.pois.length > 0),
    [filteredPOIs],
  );

  const visibleCount = useMemo(
    () => filteredPOIs.filter(p => p.actionState !== 'dismissed').length,
    [filteredPOIs],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleAddAllNobrainers = () => {
    const ids = nobrainers.filter(p => p.actionState !== 'added').map(p => p.id);
    if (onAddMultiple) {
      onAddMultiple(ids);
    } else {
      ids.forEach(id => onAdd(id));
    }
  };

  return {
    timeBudget, setTimeBudget,
    isExpanded, setIsExpanded,
    allDiscovered,
    filteredPOIs,
    tierCounts,
    nobrainers,
    detourTime,
    grouped,
    visibleCount,
    handleAddAllNobrainers,
  };
}
