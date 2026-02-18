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
import { Sparkles, Loader2, ExternalLink, Check, X, Zap } from 'lucide-react';
import type { POISuggestion, POISuggestionCategory } from '../../types';
import { Button } from '../UI/Button';
import { cn } from '../../lib/utils';
import {
  discoverPOIs,
  filterByTimeBudget,
  getNobrainers,
  getTierCounts,
  totalDetourMinutes,
  TIER_META,
  type DiscoveredPOI,
  type DiscoveryTier,
} from '../../lib/discovery-engine';

// ==================== CATEGORY STYLES ====================

const CATEGORY_ICONS: Record<POISuggestionCategory, string> = {
  viewpoint: '🌿', attraction: '🎡', museum: '🏛️', park: '🌲',
  landmark: '🗿', waterfall: '💧', restaurant: '🍽️', cafe: '☕',
  gas: '⛽', hotel: '🏨', shopping: '🛍️', entertainment: '🎭',
};

// ==================== PROPS ====================

interface DiscoveryPanelProps {
  suggestions: POISuggestion[];
  isLoading: boolean;
  onAdd: (poiId: string) => void;
  onDismiss: (poiId: string) => void;
  onAddMultiple?: (poiIds: string[]) => void;
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
  suggestions,
  isLoading,
  onAdd,
  onDismiss,
  onAddMultiple,
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
            Discover Cool Stops
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
            <TierSection key={tier} tier={tier} pois={pois} onAdd={onAdd} onDismiss={onDismiss} />
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== TIER SECTION ====================

function TierSection({
  tier,
  pois,
  onAdd,
  onDismiss,
}: {
  tier: DiscoveryTier;
  pois: DiscoveredPOI[];
  onAdd: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const meta = TIER_META[tier];

  return (
    <div className="space-y-2">
      <h4 className={cn('text-sm font-semibold flex items-center gap-1.5', meta.color)}>
        <span>{meta.emoji}</span>
        {meta.label}
        <span className="text-xs font-normal opacity-70">({pois.length})</span>
      </h4>
      <div className="space-y-2">
        {pois.map(poi => (
          <DiscoveryCard key={poi.id} poi={poi} onAdd={onAdd} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
}

// ==================== DISCOVERY CARD ====================

function DiscoveryCard({
  poi,
  onAdd,
  onDismiss,
}: {
  poi: DiscoveredPOI;
  onAdd: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const meta = TIER_META[poi.tier];
  const isAdded = poi.actionState === 'added';
  const icon = CATEGORY_ICONS[poi.category] || '📍';

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-all',
        isAdded ? 'bg-green-50 border-green-200 opacity-80' : `${meta.bgColor} ${meta.borderColor}`,
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h5 className="font-semibold text-sm text-foreground leading-tight truncate">
                {poi.name}
              </h5>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                {poi.bucket === 'destination' ? (
                  <>
                    <span className="text-blue-600 font-medium">📍 At destination</span>
                    {poi.distanceFromRoute > 0.5 && (
                      <>
                        <span>·</span>
                        <span>{poi.distanceFromRoute.toFixed(1)}km from center</span>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <span>{poi.distanceFromRoute.toFixed(1)}km away</span>
                    <span>·</span>
                    <span>+{poi.detourTimeMinutes}min</span>
                    {poi.fitsInBreakWindow && (
                      <>
                        <span>·</span>
                        <span className="text-green-600 font-medium">Quick stop</span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Badge */}
            <span className={cn(
              'text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0',
              meta.bgColor, meta.color, 'border', meta.borderColor,
            )}>
              {meta.emoji}
            </span>
          </div>

          {/* Wiki + Actions */}
          <div className="flex items-center gap-2 mt-2">
            {poi.wikiUrl && (
              <a
                href={poi.wikiUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Wikipedia
              </a>
            )}
            <div className="flex-1" />
            {isAdded ? (
              <span className="inline-flex items-center gap-1 text-xs text-green-700 font-semibold">
                <Check className="h-3 w-3" /> Added
              </span>
            ) : (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs hover:bg-green-100 hover:text-green-700 gap-1"
                  onClick={() => onAdd(poi.id)}
                >
                  <Check className="h-3 w-3" /> Add
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs hover:bg-red-100 hover:text-red-600"
                  onClick={() => onDismiss(poi.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
