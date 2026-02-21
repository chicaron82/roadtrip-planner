import { useState, useCallback, useMemo } from 'react';
import type { POI, POICategory, RouteSegment } from '../types';
import type { SuggestedStop, SuggestionSuggestionStopType } from '../lib/stop-suggestions';
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

export function useAddedStops() {
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

  return {
    addedStops,
    addedPOIIds,
    addStop,
    removeStop,
    clearStops,
    asSuggestedStops,
  };
}
