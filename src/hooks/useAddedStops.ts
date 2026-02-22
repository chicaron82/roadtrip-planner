import { useState, useCallback, useMemo } from 'react';
import type { POI, POICategory, RouteSegment, TripSummary } from '../types';
import type { SuggestedStop, SuggestionStopType } from '../lib/stop-suggestions';
import { findNearestSegmentIndex, haversineDistance, estimateDetourTime } from '../lib/poi-ranking';

// ==================== TYPES ====================

export interface AddedStop {
  id: string;
  poi: POI;
  afterSegmentIndex: number;
  stopType: SuggestionStopType;
  duration: number;       // minutes
  estimatedCost: number;
  detourMinutes: number;
}

// ==================== CATEGORY DEFAULTS ====================

const CATEGORY_DEFAULTS: Record<POICategory, { stopType: SuggestionStopType; duration: number; cost: number }> = {
  gas:        { stopType: 'fuel',      duration: 15,  cost: 0   },
  food:       { stopType: 'meal',      duration: 45,  cost: 50  },
  hotel:      { stopType: 'overnight', duration: 480, cost: 120 },
  attraction: { stopType: 'rest',      duration: 60,  cost: 0   },
};

// ==================== HOOK ====================

export function useAddedStops(summary?: TripSummary | null, isRoundTrip?: boolean) {
  const [addedStops, setAddedStops] = useState<AddedStop[]>([]);

  const addedPOIIds = useMemo(
    () => new Set(addedStops.map(s => s.poi.id)),
    [addedStops]
  );

  const addStop = useCallback((poi: POI, segments: RouteSegment[], explicitSegmentIndex?: number) => {
    setAddedStops(prev => {
      if (prev.some(s => s.poi.id === poi.id)) return prev; // no dupes

      const afterSegmentIndex = explicitSegmentIndex ?? findNearestSegmentIndex(poi.lat, poi.lng, segments);
      const nearestSeg = segments[afterSegmentIndex];
      const distKm = nearestSeg
        ? haversineDistance(poi.lat, poi.lng, nearestSeg.to.lat, nearestSeg.to.lng)
        : 0;
      const detourMinutes = estimateDetourTime(distKm);
      const defaults = CATEGORY_DEFAULTS[poi.category];

      return [...prev, {
        id: `added-${poi.id}`,
        poi,
        afterSegmentIndex,
        stopType: defaults.stopType,
        duration: defaults.duration,
        estimatedCost: defaults.cost,
        detourMinutes,
      }];
    });
  }, []);

  const removeStop = useCallback((poiId: string) => {
    setAddedStops(prev => prev.filter(s => s.poi.id !== poiId));
  }, []);

  const clearStops = useCallback(() => {
    setAddedStops([]);
  }, []);

  /** Added stops as SuggestedStop[] for timeline simulation */
  const asSuggestedStops = useMemo((): SuggestedStop[] => {
    return addedStops.map(stop => ({
      id: stop.id,
      type: stop.stopType,
      reason: `${stop.poi.name} (added from map)`,
      afterSegmentIndex: stop.afterSegmentIndex,
      estimatedTime: new Date(), // recalculated by simulation
      duration: stop.duration,
      priority: 'optional' as const,
      details: {
        fuelCost: stop.stopType === 'fuel' ? stop.estimatedCost : undefined,
      },
      accepted: true,
    }));
  }, [addedStops]);

  /** Mirror gas/hotel stops onto the return leg for round trips */
  const mirroredReturnStops = useMemo((): SuggestedStop[] => {
    if (!summary || !isRoundTrip || addedStops.length === 0) return [];
    const total = summary.segments.length;
    const midpoint = total / 2;
    return addedStops
      .filter(s => s.afterSegmentIndex < midpoint && (s.poi.category === 'gas' || s.poi.category === 'hotel'))
      .map(s => ({
        id: `return-${s.id}`,
        type: s.stopType,
        reason: `${s.poi.name} (return leg)`,
        afterSegmentIndex: (total - 1) - s.afterSegmentIndex,
        estimatedTime: new Date(),
        duration: s.duration,
        priority: 'optional' as const,
        details: { fuelCost: s.stopType === 'fuel' ? s.estimatedCost : undefined },
        accepted: true,
      }));
  }, [addedStops, summary, isRoundTrip]);

  return {
    addedStops,
    addedPOIIds,
    addStop,
    removeStop,
    clearStops,
    asSuggestedStops,
    mirroredReturnStops,
  };
}
