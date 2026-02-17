import { MapPin, Clock, Check, X, Star, Sparkles } from 'lucide-react';
import type { POISuggestion, POISuggestionCategory } from '../../types';
import { Button } from '../UI/Button';
import { cn } from '../../lib/utils';

interface POISuggestionCardProps {
  poi: POISuggestion;
  onAdd: (poiId: string) => void;
  onDismiss: (poiId: string) => void;
}

// Category icons and colors
const CATEGORY_STYLES: Record<
  POISuggestionCategory,
  { icon: string; color: string; bgColor: string; borderColor: string }
> = {
  viewpoint: { icon: '🌿', color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
  attraction: { icon: '🎡', color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
  museum: { icon: '🏛️', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  park: { icon: '🌲', color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  landmark: { icon: '🗿', color: 'text-stone-700', bgColor: 'bg-stone-50', borderColor: 'border-stone-200' },
  waterfall: { icon: '💧', color: 'text-cyan-700', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-200' },
  restaurant: { icon: '🍽️', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  cafe: { icon: '☕', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  gas: { icon: '⛽', color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
  hotel: { icon: '🏨', color: 'text-indigo-700', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200' },
  shopping: { icon: '🛍️', color: 'text-pink-700', bgColor: 'bg-pink-50', borderColor: 'border-pink-200' },
  entertainment: { icon: '🎭', color: 'text-violet-700', bgColor: 'bg-violet-50', borderColor: 'border-violet-200' },
};

const CATEGORY_LABELS: Record<POISuggestionCategory, string> = {
  viewpoint: 'Scenic Viewpoint',
  attraction: 'Attraction',
  museum: 'Museum',
  park: 'Park',
  landmark: 'Historic Landmark',
  waterfall: 'Waterfall',
  restaurant: 'Restaurant',
  cafe: 'Café',
  gas: 'Gas Station',
  hotel: 'Hotel',
  shopping: 'Shopping',
  entertainment: 'Entertainment',
};

export function POISuggestionCard({ poi, onAdd, onDismiss }: POISuggestionCardProps) {
  if (poi.actionState === 'dismissed') return null;

  const style = CATEGORY_STYLES[poi.category];
  const isAdded = poi.actionState === 'added';

  // Render star rating based on ranking score
  const renderStars = () => {
    const starCount = Math.round((poi.rankingScore / 100) * 5);
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={cn(
              'h-3 w-3',
              i < starCount ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            )}
          />
        ))}
      </div>
    );
  };

  return (
    <div
      className={cn(
        'relative rounded-xl border-2 p-4 transition-all duration-300',
        'animate-in fade-in slide-in-from-left-4',
        style.bgColor,
        style.borderColor,
        isAdded && 'border-solid opacity-90'
      )}
    >
      {/* High Score Badge */}
      {poi.rankingScore >= 80 && !isAdded && (
        <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-0.5">
          <Sparkles className="h-2.5 w-2.5" />
          TOP PICK
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Category Icon */}
        <div
          className={cn(
            'flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-2xl',
            style.bgColor,
            'border-2',
            style.borderColor
          )}
        >
          {style.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title Row */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex-1">
              <h4 className={cn('font-bold text-sm line-clamp-1', style.color)}>
                {poi.name}
              </h4>
              <p className="text-xs text-gray-600 mt-0.5">
                {CATEGORY_LABELS[poi.category]}
              </p>
            </div>

            {/* Star Rating */}
            <div className="flex-shrink-0">
              {renderStars()}
            </div>
          </div>

          {/* Address */}
          {poi.address && (
            <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
              📍 {poi.address}
            </p>
          )}

          {/* Metadata Row */}
          <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
            {/* Distance from route */}
            <div className="flex items-center gap-1 text-muted-foreground bg-white px-2 py-0.5 rounded-full border border-gray-200">
              <MapPin className="h-3 w-3" />
              <span>{poi.distanceFromRoute.toFixed(1)} km away</span>
            </div>

            {/* Detour time */}
            <div className="flex items-center gap-1 text-muted-foreground bg-white px-2 py-0.5 rounded-full border border-gray-200">
              <Clock className="h-3 w-3" />
              <span>+{poi.detourTimeMinutes} min</span>
            </div>

            {/* Fits in break window */}
            {poi.fitsInBreakWindow && (
              <div className="flex items-center gap-1 text-green-700 bg-green-100 px-2 py-0.5 rounded-full border border-green-300 font-medium">
                <Check className="h-3 w-3" />
                <span>Quick stop</span>
              </div>
            )}
          </div>

          {/* Bucket Badge */}
          <div className="inline-flex items-center gap-1.5 text-[10px] font-medium text-gray-600 bg-white px-2 py-1 rounded-md border border-gray-200">
            {poi.bucket === 'along-way' ? '🛣️ Along your route' : '🎯 At destination'}
          </div>

          {/* Added Badge */}
          {isAdded && (
            <div className="mt-2 inline-flex items-center gap-1 text-xs bg-green-500 text-white px-2 py-1 rounded-md font-bold">
              <Check className="h-3 w-3" />
              ADDED TO ITINERARY
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!isAdded && (
          <div className="flex flex-col gap-1 flex-shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-green-100 hover:text-green-600"
              onClick={() => onAdd(poi.id)}
              title="Add to itinerary"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
              onClick={() => onDismiss(poi.id)}
              title="Dismiss suggestion"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Compact badge version for showing added POIs in timeline
interface POIBadgeProps {
  poi: POISuggestion;
  className?: string;
}

export function POIBadge({ poi, className }: POIBadgeProps) {
  const style = CATEGORY_STYLES[poi.category];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
        style.bgColor,
        style.borderColor,
        'border',
        className
      )}
    >
      <span>{style.icon}</span>
      <span className={style.color}>{poi.name}</span>
    </div>
  );
}
