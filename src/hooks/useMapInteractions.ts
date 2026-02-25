import { useMemo, useCallback } from 'react';
import type { Location, TripSummary, TripSettings, POI, RouteSegment } from '../types';
import { analyzeFeasibility, type FeasibilityStatus } from '../lib/feasibility';
import { showToast } from '../lib/toast';
import { NOMINATIM_BASE_URL } from '../lib/constants';

interface UseMapInteractionsOptions {
  locations: Location[];
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  summary: TripSummary | null;
  settings: TripSettings;
  addStop: (poi: POI, segments: RouteSegment[], afterSegmentIndex?: number) => void;
}

interface UseMapInteractionsReturn {
  validRouteGeometry: [number, number][] | null;
  routeFeasibilityStatus: FeasibilityStatus | null;
  mapDayOptions: { dayNumber: number; label: string; segmentIndex: number }[] | undefined;
  handleMapClick: (lat: number, lng: number) => Promise<void>;
  handleAddPOIFromMap: (poi: POI, afterSegmentIndex?: number) => void;
  openInGoogleMaps: () => void;
  copyShareLink: (shareUrl: string | null) => void;
}

export function useMapInteractions({
  locations,
  setLocations,
  summary,
  settings,
  addStop,
}: UseMapInteractionsOptions): UseMapInteractionsReturn {
  const validRouteGeometry = useMemo(() => {
    const geometry = summary?.fullGeometry;
    if (!geometry) return null;
    const filtered = geometry.filter(coord =>
      coord && Array.isArray(coord) && coord.length === 2 &&
      typeof coord[0] === 'number' && typeof coord[1] === 'number' &&
      !isNaN(coord[0]) && !isNaN(coord[1]) && coord[0] !== 0 && coord[1] !== 0
    );
    return filtered.length >= 2 ? filtered as [number, number][] : null;
  }, [summary]);

  const routeFeasibilityStatus = useMemo(
    () => summary ? analyzeFeasibility(summary, settings).status : null,
    [summary, settings],
  );

  const mapDayOptions = useMemo(() => {
    if (!summary?.days || summary.days.length <= 1) return undefined;
    return summary.days.map(day => ({
      dayNumber: day.dayNumber,
      label: `Day ${day.dayNumber} — ${day.route}`,
      segmentIndex: day.segmentIndices[day.segmentIndices.length - 1] ?? 0,
    }));
  }, [summary]);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `${NOMINATIM_BASE_URL}/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await response.json();
      const name = data.display_name || `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`;

      const originEmpty = !locations[0]?.name || locations[0].lat === 0;
      const destEmpty =
        !locations[locations.length - 1]?.name || locations[locations.length - 1].lat === 0;

      if (originEmpty) {
        setLocations(prev => prev.map((loc, i) => (i === 0 ? { ...loc, name, lat, lng } : loc)));
      } else if (destEmpty) {
        setLocations(prev =>
          prev.map((loc, i) => (i === prev.length - 1 ? { ...loc, name, lat, lng } : loc))
        );
      } else {
        const newWaypoint: Location = {
          id: `waypoint-${Date.now()}`,
          name,
          lat,
          lng,
          type: 'waypoint',
        };
        setLocations(prev => [...prev.slice(0, -1), newWaypoint, prev[prev.length - 1]]);
      }
    } catch (err) {
      console.error('Failed to reverse geocode:', err);
    }
  }, [locations, setLocations]);

  const handleAddPOIFromMap = useCallback((poi: POI, afterSegmentIndex?: number) => {
    if (!summary) return;
    addStop(poi, summary.segments, afterSegmentIndex);
  }, [addStop, summary]);

  const openInGoogleMaps = useCallback(() => {
    const validLocations = locations.filter(loc => loc.lat !== 0 && loc.lng !== 0);
    if (validLocations.length < 2) return;
    const locStr = (loc: Location) => encodeURIComponent(loc.address || loc.name);
    const origin = validLocations[0];
    const destination = validLocations[validLocations.length - 1];
    const waypoints = validLocations.slice(1, -1).map(locStr).join('|');
    let url = `https://www.google.com/maps/dir/?api=1&origin=${locStr(origin)}&destination=${locStr(destination)}`;
    if (waypoints) url += `&waypoints=${waypoints}`;
    window.open(url, '_blank');
  }, [locations]);

  const copyShareLink = useCallback((shareUrl: string | null) => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      showToast({ message: 'Link copied — send it.', type: 'success' });
    }
  }, []);

  return {
    validRouteGeometry,
    routeFeasibilityStatus,
    mapDayOptions,
    handleMapClick,
    handleAddPOIFromMap,
    openInGoogleMaps,
    copyShareLink,
  };
}
