import { cn } from '../../lib/utils';
import { TIER_META, type DiscoveredPOI, type DiscoveryTier } from '../../lib/discovery-engine';
import { DiscoveryCard } from './DiscoveryCard';

export function TierSection({
  tier,
  pois,
  onAdd,
  onDismiss,
  roundTripMidpoint,
}: {
  tier: DiscoveryTier;
  pois: DiscoveredPOI[];
  onAdd: (id: string, segmentIndex?: number) => void;
  onDismiss: (id: string) => void;
  roundTripMidpoint?: number;
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
          <DiscoveryCard key={poi.id} poi={poi} onAdd={onAdd} onDismiss={onDismiss} roundTripMidpoint={roundTripMidpoint} />
        ))}
      </div>
    </div>
  );
}
