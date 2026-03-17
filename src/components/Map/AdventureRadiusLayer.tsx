/**
 * AdventureRadiusLayer — The Adventure magic moment.
 *
 * "As the radius grows, destination pins appear on the map —
 *  places that just became reachable."
 *
 * Renders:
 *   • A soft dashed circle showing how far the budget stretches
 *   • CircleMarkers for each destination within reach — appear/disappear as radius changes
 *
 * Used only during the Adventure Icebreaker (Q1). Unmounts when icebreaker ends.
 *
 * 💚 My Experience Engine
 */

import { useEffect } from 'react';
import { Circle, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { getDestinationsInRadius } from '../../lib/adventure/adventure-service';
import type { DestinationPreview } from '../../lib/adventure/adventure-service';

const CATEGORY_COLOR: Record<DestinationPreview['category'], string> = {
  city:     '#6366f1', // indigo
  nature:   '#16a34a', // green
  beach:    '#0891b2', // cyan
  mountain: '#7c3aed', // purple
  historic: '#b45309', // amber
};

interface AdventureRadiusLayerProps {
  lat: number;
  lng: number;
  radiusKm: number;
}

export function AdventureRadiusLayer({ lat, lng, radiusKm }: AdventureRadiusLayerProps) {
  const map = useMap();
  const reachable = getDestinationsInRadius(lat, lng, radiusKm);

  // Fit map to circle bounds when origin or radius changes
  useEffect(() => {
    if (radiusKm <= 0) return;
    // 1 degree latitude ≈ 111 km
    const deg = radiusKm / 111;
    map.fitBounds(
      [
        [lat - deg, lng - deg * 1.4],
        [lat + deg, lng + deg * 1.4],
      ],
      { padding: [48, 48], animate: true, duration: 0.6 },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, radiusKm]);

  return (
    <>
      {/* Reach zone — soft orange glow with dashed edge */}
      <Circle
        center={[lat, lng]}
        radius={radiusKm * 1000}
        pathOptions={{
          color: 'rgba(234, 88, 12, 0.5)',
          fillColor: 'rgba(234, 88, 12, 0.07)',
          fillOpacity: 1,
          weight: 1.5,
          dashArray: '6 4',
        }}
      />

      {/* Destination pins — appear as the radius grows to include them */}
      {reachable.map(pin => (
        <CircleMarker
          key={pin.name}
          center={[pin.lat, pin.lng]}
          radius={7}
          pathOptions={{
            color: CATEGORY_COLOR[pin.category],
            fillColor: CATEGORY_COLOR[pin.category],
            fillOpacity: 0.85,
            weight: 1.5,
          }}
        >
          <Tooltip direction="top" offset={[0, -8]} opacity={0.92}>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>{pin.name}</span>
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}
