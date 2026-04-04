import type React from 'react';
import { Map } from '../../components/Map/Map';
import type { TripMode, RouteStrategy } from '../../types';
import type { MapRouteDetails } from '../../lib/trip-summary-slices';

type MapComponentProps = React.ComponentProps<typeof Map>;

interface UseMapPropsOptions {
  locations: MapComponentProps['locations'];
  validRouteGeometry: MapComponentProps['routeGeometry'];
  routeFeasibilityStatus: MapComponentProps['feasibilityStatus'];
  tripActive: boolean;
  strategicFuelStops: MapComponentProps['strategicFuelStops'];
  handleMapClick: MapComponentProps['onMapClick'];
  routeDetails: MapRouteDetails | null;
  previewGeometry: MapComponentProps['previewGeometry'];
  tripMode: TripMode | null;
  routeStrategies: RouteStrategy[];
  activeStrategyIndex: number;
  selectStrategy: (i: number) => void;
  units?: 'metric' | 'imperial';
  adventurePreview?: MapComponentProps['adventurePreview'];
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
    tripActive: o.tripActive,
    strategicFuelStops: o.strategicFuelStops,
    onMapClick: o.handleMapClick,
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
    tripDays: o.routeDetails?.days,
    routeSegments: o.routeDetails?.segments,
    routeTotals: o.routeDetails ? { distanceKm: o.routeDetails.totalDistanceKm, durationMinutes: o.routeDetails.totalDurationMinutes } : undefined,
    units: o.units,
    adventurePreview: o.adventurePreview,
  };
}
