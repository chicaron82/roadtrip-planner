import type React from 'react';
import { Map } from '../components/Map/Map';
import type { TripSummary, TripMode, RouteStrategy } from '../types';

type MapComponentProps = React.ComponentProps<typeof Map>;

interface UseMapPropsOptions {
  locations: MapComponentProps['locations'];
  validRouteGeometry: MapComponentProps['routeGeometry'];
  routeFeasibilityStatus: MapComponentProps['feasibilityStatus'];
  pois: MapComponentProps['pois'];
  markerCategories: MapComponentProps['markerCategories'];
  tripActive: boolean;
  strategicFuelStops: MapComponentProps['strategicFuelStops'];
  addedPOIIds: MapComponentProps['addedPOIIds'];
  mapDayOptions: MapComponentProps['dayOptions'];
  handleMapClick: MapComponentProps['onMapClick'];
  summary: TripSummary | null;
  handleAddPOIFromMap: MapComponentProps['onAddPOI'];
  previewGeometry: MapComponentProps['previewGeometry'];
  tripMode: TripMode | null;
  routeStrategies: RouteStrategy[];
  activeStrategyIndex: number;
  selectStrategy: (i: number) => void;
}

/**
 * Assembles the full props object for <Map />, including the alternateGeometries
 * closure assembly. Keeps App.tsx free of computed map state.
 */
export function useMapProps(o: UseMapPropsOptions): MapComponentProps {
  return {
    locations: o.locations,
    routeGeometry: o.validRouteGeometry,
    feasibilityStatus: o.routeFeasibilityStatus,
    pois: o.pois,
    markerCategories: o.markerCategories,
    tripActive: o.tripActive,
    strategicFuelStops: o.strategicFuelStops,
    addedPOIIds: o.addedPOIIds,
    dayOptions: o.mapDayOptions,
    onMapClick: o.handleMapClick,
    onAddPOI: o.summary ? o.handleAddPOIFromMap : undefined,
    previewGeometry: o.validRouteGeometry ? undefined : o.previewGeometry,
    tripMode: o.tripMode || undefined,
    alternateGeometries: o.routeStrategies
      .filter((_, i) => i !== o.activeStrategyIndex)
      .map((s) => ({
        geometry: s.geometry,
        label: s.label,
        emoji: s.emoji,
        onSelect: () => o.selectStrategy(o.routeStrategies.indexOf(s)),
      })),
    tripDays: o.summary?.days,
    routeSegments: o.summary?.segments,
  };
}
