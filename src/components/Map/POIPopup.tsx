import { Check, Plus, Clock, Navigation } from 'lucide-react';
import type { POI, MarkerCategory } from '../../types';

/** Simplified day info for the popup day picker */
export interface PopupDayOption {
  dayNumber: number;
  label: string;         // "Day 1 — Winnipeg → Thunder Bay"
  segmentIndex: number;  // afterSegmentIndex to use when adding to this day
}

interface POIPopupProps {
  poi: POI;
  category: MarkerCategory;
  isAdded: boolean;
  detourMinutes: number;
  dayOptions?: PopupDayOption[];
  onAdd: (poi: POI, afterSegmentIndex?: number) => void;
}

export function POIPopup({ poi, category, isAdded, detourMinutes, dayOptions, onAdd }: POIPopupProps) {
  const hasDays = dayOptions && dayOptions.length > 1;

  return (
    <div className="min-w-[200px] max-w-[260px]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xl">{category.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm leading-tight">{poi.name}</div>
          {poi.address && (
            <div className="text-[11px] text-gray-500 truncate mt-0.5">{poi.address}</div>
          )}
        </div>
      </div>

      {/* Detour info */}
      <div className="flex items-center gap-3 text-[11px] text-gray-600 mb-2 py-1 border-t border-gray-100">
        {detourMinutes > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Navigation className="h-3 w-3" />
            +{detourMinutes} min detour
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-green-600">
            <Navigation className="h-3 w-3" />
            On route
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatStopDuration(poi.category)}
        </span>
      </div>

      {/* Action */}
      {isAdded ? (
        <div className="flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-green-50 text-green-700 text-xs font-semibold">
          <Check className="h-3.5 w-3.5" />
          Added to Plan
        </div>
      ) : hasDays ? (
        <div className="space-y-1">
          <div className="text-[11px] font-semibold text-gray-500 mb-1">Add to:</div>
          {dayOptions.map(day => (
            <button
              key={day.dayNumber}
              onClick={(e) => { e.stopPropagation(); onAdd(poi, day.segmentIndex); }}
              className="w-full flex items-center gap-1.5 py-1.5 px-2 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-medium transition-colors cursor-pointer text-left"
            >
              <Plus className="h-3 w-3 flex-shrink-0" />
              {day.label}
            </button>
          ))}
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(poi); }}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Add to Plan
        </button>
      )}
    </div>
  );
}

function formatStopDuration(category: POI['category']): string {
  switch (category) {
    case 'gas': return '~15 min stop';
    case 'food': return '~45 min stop';
    case 'hotel': return 'Overnight';
    case 'attraction': return '~1 hr stop';
    default: return '~30 min stop';
  }
}
