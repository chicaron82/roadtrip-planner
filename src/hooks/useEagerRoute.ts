import { useState, useEffect, useRef } from 'react';
import type { Location } from '../types';
import { fetchRouteGeometry } from '../lib/api';

/**
 * Fires a lightweight geometry-only OSRM call as soon as origin + destination
 * both have valid coordinates. Debounced 400ms to avoid hammering OSRM on
 * every keystroke. Returns a preview line for the map.
 *
 * Resets to null if either endpoint is cleared.
 */
export function useEagerRoute(locations: Location[]): [number, number][] | null {
  const [previewGeometry, setPreviewGeometry] = useState<[number, number][] | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive a stable string key from coords — avoids firing when React creates
  // a new array reference but the actual coordinate values haven't changed.
  const coordsKey = locations.map(l => `${l.lat},${l.lng}`).join('|');

  useEffect(() => {
    const origin = locations.find(l => l.type === 'origin');
    const dest   = locations.find(l => l.type === 'destination');

    const valid = (loc: Location | undefined): boolean =>
      !!(loc && loc.lat && loc.lat !== 0 && loc.lng && loc.lng !== 0 && loc.name);

    if (!valid(origin) || !valid(dest)) {
      setPreviewGeometry(null);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const geometry = await fetchRouteGeometry(locations);
      setPreviewGeometry(geometry);
    }, 400);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordsKey]);

  return previewGeometry;
}
