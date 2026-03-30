import { useState, useCallback, useMemo } from 'react';
import type { POI, POICategory, RouteSegment, TripSettings } from '../../types';
import type { SuggestedStop, SuggestionStopType } from '../../lib/stop-suggestions';
import { findNearestSegmentIndex, haversineDistance, estimateDetourTime } from '../../lib/geo-utils';
import { deriveManualStopPlacement } from '../../lib/manual-stop-placement';

interface AddedStopRouteSummary {
  segments: RouteSegment[];
  fullGeometry: number[][];
  totalDurationMinutes: number;
}

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

export function useAddedStops(routeSummary?: AddedStopRouteSummary | null, settings?: TripSettings) {
  const [addedStops, setAddedStops] = useState<AddedStop[]>([]);
  const totalRouteDistanceKm = useMemo(
    () => routeSummary?.segments.reduce((sum, segment) => sum + segment.distanceKm, 0) ?? 0,
    [routeSummary],
  );

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
    return addedStops.map(stop => {
      const placement = routeSummary && settings
        ? deriveManualStopPlacement({
            lat: stop.poi.lat,
            lng: stop.poi.lng,
            segments: routeSummary.segments,
            fullGeometry: routeSummary.fullGeometry,
            totalDurationMinutes: routeSummary.totalDurationMinutes,
            departureDate: settings.departureDate,
            departureTime: settings.departureTime,
            originLng: routeSummary.segments[0]?.from.lng,
            fallbackSegmentIndex: stop.afterSegmentIndex,
          })
        : null;

      return {
        id: stop.id,
        type: stop.stopType,
        reason: `${stop.poi.name} (added from map)`,
        afterSegmentIndex: placement?.afterSegmentIndex ?? stop.afterSegmentIndex,
        estimatedTime: placement?.estimatedTime ?? new Date(),
        duration: stop.duration,
        priority: 'optional' as const,
        details: {
          fuelCost: stop.stopType === 'fuel' ? stop.estimatedCost : undefined,
        },
        accepted: true,
        distanceFromStart: placement?.distanceFromStartKm,
      };
    });
  }, [addedStops, routeSummary, settings]);

  /** Mirror gas/hotel stops onto the return leg for round trips */
  const mirroredReturnStops = useMemo((): SuggestedStop[] => {
    if (!routeSummary || !settings?.isRoundTrip || addedStops.length === 0) return [];

    const totalSegments = routeSummary.segments.length;
    const midpoint = totalSegments / 2;
    const startTime = new Date(asSuggestedStops[0]?.estimatedTime ?? new Date());

    return asSuggestedStops
      .filter(stop => {
        const source = addedStops.find(added => added.id === stop.id);
        return source && source.afterSegmentIndex < midpoint && (source.poi.category === 'gas' || source.poi.category === 'hotel');
      })
      .map(stop => {
        const mirroredDistanceFromStart = stop.distanceFromStart != null
          ? Math.max(0, totalRouteDistanceKm - stop.distanceFromStart)
          : undefined;
        const mirroredProgress = mirroredDistanceFromStart != null && totalRouteDistanceKm > 0
          ? mirroredDistanceFromStart / totalRouteDistanceKm
          : undefined;

        return {
          id: `return-${stop.id}`,
          type: stop.type,
          reason: stop.reason.replace('(added from map)', '(return leg)'),
          afterSegmentIndex: (totalSegments - 1) - Math.max(0, Math.floor(stop.afterSegmentIndex)),
          estimatedTime: mirroredProgress != null
            ? new Date(startTime.getTime() + routeSummary.totalDurationMinutes * mirroredProgress * 60_000)
            : stop.estimatedTime,
          duration: stop.duration,
          priority: 'optional' as const,
          details: stop.details,
          accepted: true,
          distanceFromStart: mirroredDistanceFromStart,
        };
      });
  }, [addedStops, asSuggestedStops, routeSummary, settings, totalRouteDistanceKm]);

  /** Stable merged array of user-added stops for upstream canonical pipeline consumers.
   * Memoised here so callers don't need to merge and risk referential instability. */
  const externalStops = useMemo(
    () => [...asSuggestedStops, ...mirroredReturnStops],
    [asSuggestedStops, mirroredReturnStops],
  );

  return {
    addedStops,
    addedPOIIds,
    addStop,
    removeStop,
    clearStops,
    asSuggestedStops,
    mirroredReturnStops,
    externalStops,
  };
}
