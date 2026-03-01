import { useEffect } from 'react';
import L from 'leaflet';
import { useMap, useMapEvents } from 'react-leaflet';
import type { Location } from '../../types';

/** Fits the map bounds to the current route/locations whenever they change. */
export function MapUpdater({
  locations,
  routeGeometry,
  previewGeometry,
}: {
  locations: Location[];
  routeGeometry: [number, number][] | null;
  previewGeometry?: [number, number][] | null;
}) {
  const map = useMap();
  const effectiveGeometry = routeGeometry ?? previewGeometry ?? null;

  useEffect(() => {
    const validLocations = locations.filter(
      l => l && typeof l.lat === 'number' && typeof l.lng === 'number' &&
      !isNaN(l.lat) && !isNaN(l.lng) && l.lat !== 0 && l.lng !== 0
    );

    if (validLocations.length > 0) {
      const bounds = L.latLngBounds(validLocations.map(l => [l.lat, l.lng]));
      if (effectiveGeometry) {
        effectiveGeometry.forEach(coord => {
          if (coord && Array.isArray(coord) && coord.length === 2 &&
              typeof coord[0] === 'number' && typeof coord[1] === 'number' &&
              !isNaN(coord[0]) && !isNaN(coord[1])) {
            bounds.extend(coord);
          }
        });
      }
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      map.setView([49.8951, -97.1384], 5);
    }
  }, [locations, effectiveGeometry, map]);

  return null;
}

/** Forwards map click events to the provided handler. */
export function MapClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

