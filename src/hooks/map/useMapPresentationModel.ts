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

import { useState, useCallback, useEffect, useRef } from 'react';
import type { POI, RouteSegment, TripDay } from '../../types';
import { haversineDistance, estimateDetourTime } from '../../lib/geo-utils';
import type { TileStyle } from '../../components/Map/map-constants';

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

  /**
   * Marker reveal phase for the route reveal choreography.
   * 0 = hidden (route drawing), 1 = location + overnight markers,
   * 2 = engine-inferred fuel stops, 3 = POIs.
   */
  markerPhase: number;
}

export function useMapPresentationModel({
  routeGeometry,
  tripDays,
}: UseMapPresentationModelOptions): UseMapPresentationModelReturn {
  const [tileStyle, setTileStyle] = useState<TileStyle>('street');
  const [clickedSegment, setClickedSegment] = useState<ClickedSegmentData | null>(null);
  const [markerPhase, setMarkerPhase] = useState(0);
  const prevGeomRef = useRef<[number, number][] | null | undefined>(undefined);

  useEffect(() => {
    const prev = prevGeomRef.current;
    prevGeomRef.current = routeGeometry;

    if (!routeGeometry) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMarkerPhase(0);
      return;
    }

    // First reveal (prev was null/undefined) → full stagger after route draw
    if (!prev) {
      setMarkerPhase(0);
      const t1 = setTimeout(() => setMarkerPhase(1), 2100);
      const t2 = setTimeout(() => setMarkerPhase(2), 2400);
      const t3 = setTimeout(() => setMarkerPhase(3), 2700);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }

    // Recalculation (geometry changed while already visible) → instant
    setMarkerPhase(3);
  }, [routeGeometry]);

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
    markerPhase,
  };
}
