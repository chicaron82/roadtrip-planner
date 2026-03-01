/**
 * DiscoveryPanel — "Make This Trip Legendary"
 *
 * Replaces the basic POI suggestions panel with a discovery-focused UI:
 * - Time budget slider (0–4h)
 * - Tier-grouped cards (🔥 → 👀 → 🤷)
 * - Route-ordered within each tier
 * - "Add All No-Brainers" batch button
 * - Wikipedia external links
 */

import { useState, useMemo } from 'react';
import { Sparkles, Loader2, Zap } from 'lucide-react';
import type { POISuggestion } from '../../types';
import { Button } from '../UI/Button';
import { cn } from '../../lib/utils';
import { TierSection } from './TierSection';
import {
  discoverPOIs,
  filterByTimeBudget,
  getNobrainers,
  getTierCounts,
  totalDetourMinutes,
  type DiscoveryTier,
} from '../../lib/discovery-engine';

// ==================== PROPS ====================

interface DiscoveryPanelProps {
  /** Custom header title. Defaults to "Discover Cool Stops". */
  title?: string;
  suggestions: POISuggestion[];
  isLoading: boolean;
  onAdd: (poiId: string, segmentIndex?: number) => void;
  onDismiss: (poiId: string) => void;
  onAddMultiple?: (poiIds: string[]) => void;
  /** When true, shows a warning that some corridor data failed to load. */
  partialResults?: boolean;
  /** Index where the return leg begins (from summary.roundTripMidpoint).
   *  Enables the outbound/return leg picker on mirrored POIs. */
  roundTripMidpoint?: number;
  className?: string;
}

// ==================== SLIDER MARKS ====================

const BUDGET_MARKS = [
  { value: 0, label: '0' },
  { value: 30, label: '30m' },
  { value: 60, label: '1h' },
  { value: 120, label: '2h' },
  { value: 180, label: '3h' },
  { value: 240, label: '4h' },
];

// ==================== COMPONENT ====================

export function DiscoveryPanel({
  title,
  suggestions,
  isLoading,
  onAdd,
  onDismiss,
  onAddMultiple,
  partialResults,
  roundTripMidpoint,
  className,
}: DiscoveryPanelProps) {
  const [timeBudget, setTimeBudget] = useState(60); // default 1h
  const [isExpanded, setIsExpanded] = useState(true);

  // Transform POIs through discovery engine
  const allDiscovered = useMemo(() => discoverPOIs(suggestions), [suggestions]);

  // Apply time budget filter
  const filteredPOIs = useMemo(
    () => filterByTimeBudget(allDiscovered, timeBudget),
    [allDiscovered, timeBudget]
  );

  const tierCounts = useMemo(() => getTierCounts(filteredPOIs), [filteredPOIs]);
  const nobrainers = useMemo(() => getNobrainers(filteredPOIs), [filteredPOIs]);
  const detourTime = useMemo(() => totalDetourMinutes(filteredPOIs), [filteredPOIs]);

  // Group by tier, preserving route order within each tier
  const grouped = useMemo(() => {
    const tiers: DiscoveryTier[] = ['no-brainer', 'worth-detour', 'if-time'];
    return tiers
      .map(tier => ({
        tier,
        pois: filteredPOIs.filter(p => p.tier === tier && p.actionState !== 'dismissed'),
      }))
      .filter(g => g.pois.length > 0);
  }, [filteredPOIs]);

  const visibleCount = filteredPOIs.filter(p => p.actionState !== 'dismissed').length;

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('rounded-xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4', className)}>
        <div className="flex items-center justify-center gap-2 text-amber-700">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Scanning for cool stuff along your route...</span>
        </div>
      </div>
    );
  }

  if (visibleCount === 0 && allDiscovered.length === 0) return null;

  const handleAddAllNobrainers = () => {
    const ids = nobrainers
      .filter(p => p.actionState !== 'added')
      .map(p => p.id);
    if (onAddMultiple) {
      onAddMultiple(ids);
    } else {
      ids.forEach(id => onAdd(id));
    }
  };

  return (
    <div className={cn('rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50/80 to-orange-50/50', className)}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-amber-100/50 transition-colors rounded-t-xl"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-600" />
          <h3 className="font-bold text-amber-900">
            {title || 'Discover Cool Stops'}
          </h3>
          <span className="text-xs font-semibold text-amber-700 bg-amber-200 px-2 py-0.5 rounded-full">
            {visibleCount} found
          </span>
        </div>
        <div className="text-xs text-amber-600">
          {isExpanded ? '▲' : '▼'}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Time Budget Slider */}
          <div className="bg-white/70 rounded-lg p-3 border border-amber-200">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-amber-900">
                🕐 Discovery Budget
              </label>
              <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                {timeBudget >= 60 ? `${(timeBudget / 60).toFixed(timeBudget % 60 === 0 ? 0 : 1)}h` : `${timeBudget}m`} extra
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={240}
              step={15}
              value={timeBudget}
              onChange={e => setTimeBudget(Number(e.target.value))}
              className="w-full h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="relative mt-1 h-4">
              {BUDGET_MARKS.map(m => (
                <span
                  key={m.value}
                  className="absolute text-[10px] text-amber-600 -translate-x-1/2"
                  style={{ left: `${(m.value / 240) * 100}%` }}
                >{m.label}</span>
              ))}
            </div>
            <p className="text-[11px] text-amber-600 mt-1">
              {visibleCount} stops fit · +{detourTime}min total detour
            </p>
          </div>

          {/* Partial results warning */}
          {partialResults && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <span className="flex-shrink-0 mt-0.5">⚠️</span>
              <span>Some corridor data couldn’t load — results may not cover the full route. Recalculate to retry.</span>
            </div>
          )}

          {/* Add All No-Brainers */}
          {nobrainers.filter(p => p.actionState !== 'added').length > 0 && (
            <Button
              size="sm"
              onClick={handleAddAllNobrainers}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white gap-2"
            >
              <Zap className="h-4 w-4" />
              Add All No-Brainers ({tierCounts['no-brainer']})
            </Button>
          )}

          {/* Tier Groups */}
          {grouped.map(({ tier, pois }) => (
            <TierSection key={tier} tier={tier} pois={pois} onAdd={onAdd} onDismiss={onDismiss} roundTripMidpoint={roundTripMidpoint} />
          ))}
        </div>
      )}
    </div>
  );
}


