import { ExternalLink, Check, X } from 'lucide-react';
import type { POISuggestionCategory } from '../../types';
import { Button } from '../UI/Button';
import { cn } from '../../lib/utils';
import { TIER_META, type DiscoveredPOI } from '../../lib/discovery-engine';

const CATEGORY_ICONS: Record<POISuggestionCategory, string> = {
  viewpoint: '🌿', attraction: '🎡', museum: '🏛️', park: '🌲',
  landmark: '🗿', waterfall: '💧', restaurant: '🍽️', cafe: '☕',
  gas: '⛽', hotel: '🏨', shopping: '🛍️', entertainment: '🎭',
};

export function DiscoveryCard({
  poi,
  onAdd,
  onDismiss,
  roundTripMidpoint,
}: {
  poi: DiscoveredPOI;
  onAdd: (id: string, segmentIndex?: number) => void;
  onDismiss: (id: string) => void;
  roundTripMidpoint?: number;
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
            ) : roundTripMidpoint !== undefined && poi.mirrorSegmentIndex !== undefined ? (
              /* Leg picker: same place appears on outbound + return */
              <div className="flex gap-1 flex-wrap justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px] hover:bg-green-100 hover:text-green-700 gap-1"
                  onClick={() => onAdd(poi.id, poi.segmentIndex)}
                  title="Add on the outbound leg"
                >
                  <Check className="h-3 w-3" /> Outbound
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px] hover:bg-blue-100 hover:text-blue-700 gap-1"
                  onClick={() => onAdd(poi.id, poi.mirrorSegmentIndex)}
                  title="Add on the return leg"
                >
                  <Check className="h-3 w-3" /> Return
                </Button>
              </div>
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
