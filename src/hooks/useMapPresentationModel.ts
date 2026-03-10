/**
 * useMapPresentationModel.ts — State and derivations for the Map component.
 *
 * Extracts from Map:
 *  - tileStyle switch state ('street' | 'terrain' | 'satellite')
 *  - clickedSegment state (for the route segment inspection popup)
 *  - isMultiDay derivation
 *  - getDetourMinutes calculation
 *
 * 💚 My Experience Engine
 */

import { useState, useCallback } from 'react';
import type { POI, RouteSegment, TripDay } from '../types';
import { haversineDistance, estimateDetourTime } from '../lib/poi-ranking';
import type { TileStyle } from '../components/Map/map-constants';

interface UseMapPresentationModelOptions {
  routeGeometry?: [number, number][] | null;
  tripDays?: TripDay[];
}

export interface ClickedSegmentData {
  lat: number;
  lng: number;
  segment: RouteSegment;
}

export interface UseMapPresentationModelReturn {
  // Tile layer state
  tileStyle: TileStyle;
  setTileStyle: (style: TileStyle) => void;
  
  // Segment popup state
  clickedSegment: ClickedSegmentData | null;
  setClickedSegment: (data: ClickedSegmentData | null) => void;
  
  // Derived
  isMultiDay: boolean;
  getDetourMinutes: (poi: POI) => number;
}

export function useMapPresentationModel({
  routeGeometry,
  tripDays,
}: UseMapPresentationModelOptions): UseMapPresentationModelReturn {
  const [tileStyle, setTileStyle] = useState<TileStyle>('street');
  const [clickedSegment, setClickedSegment] = useState<ClickedSegmentData | null>(null);

  const isMultiDay = (tripDays?.length ?? 0) > 1;

  // Compute detour minutes from nearest route point
  const getDetourMinutes = useCallback((poi: POI): number => {
    if (!routeGeometry || routeGeometry.length === 0) return 0;
    let minDist = Infinity;
    // Sample every 10th point for performance on dense geometries
    for (let i = 0; i < routeGeometry.length; i += 10) {
      const d = haversineDistance(poi.lat, poi.lng, routeGeometry[i][0], routeGeometry[i][1]);
      if (d < minDist) minDist = d;
    }
    return estimateDetourTime(minDist);
  }, [routeGeometry]);

  return {
    tileStyle, setTileStyle,
    clickedSegment, setClickedSegment,
    isMultiDay,
    getDetourMinutes,
  };
}
