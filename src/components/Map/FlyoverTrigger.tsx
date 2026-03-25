/**
 * FlyoverTrigger — Classic wizard path reveal choreography.
 *
 * Lives inside MapContainer (uses useMap). When `active` becomes true:
 *   1. fitBounds to full route geometry
 *   2. Listens for moveend
 *   3. Waits 150ms buffer → calls onComplete
 *
 * One-shot per activation cycle. Cleans up on unmount or when active → false.
 *
 * 💚 My Experience Engine — The Flyover (Option B)
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import type { Location } from '../../types';

interface FlyoverTriggerProps {
  active: boolean;
  locations: Location[];
  routeGeometry: [number, number][] | null;
  onComplete: () => void;
}

export function FlyoverTrigger({ active, locations, routeGeometry, onComplete }: FlyoverTriggerProps) {
  const map = useMap();
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    if (!active) return;

    const validLocations = locations.filter(
      l => l.lat !== 0 && l.lng !== 0 && !isNaN(l.lat) && !isNaN(l.lng),
    );

    // Nothing to fly to — skip straight to reveal
    if (validLocations.length === 0) {
      onCompleteRef.current();
      return;
    }

    const bounds = L.latLngBounds(validLocations.map(l => [l.lat, l.lng] as [number, number]));
    if (routeGeometry) {
      routeGeometry.forEach(coord => {
        if (coord && !isNaN(coord[0]) && !isNaN(coord[1])) bounds.extend(coord);
      });
    }

    let timer: number;

    const handleMoveEnd = () => {
      timer = window.setTimeout(() => onCompleteRef.current(), 150);
    };

    const startLoc = validLocations[0];

    // 1. Instantly focus tightly on the starting location to anchor the user
    map.setView([startLoc.lat, startLoc.lng], 12, { animate: false });
    
    // 2. Wait 300ms, then execute a slow, cinematic zoom-out to show the full journey
    const flyTimer = window.setTimeout(() => {
      map.once('moveend', handleMoveEnd);
      map.flyToBounds(bounds, { duration: 2.5, padding: [80, 80] });
    }, 300);

    return () => {
      map.off('moveend', handleMoveEnd);
      clearTimeout(timer);
      clearTimeout(flyTimer);
    };
  // Only re-run when active flips — onComplete is stable via ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return null;
}
