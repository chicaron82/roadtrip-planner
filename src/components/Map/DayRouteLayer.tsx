import { useMemo } from 'react';
import { Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { TripDay } from '../../types';

const DAY_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

/** Find the nearest index in geometry to [lat, lng], searching forward from startIdx. */
function nearestGeomIndex(
  geometry: [number, number][],
  lat: number,
  lng: number,
  startIdx: number
): number {
  let best = startIdx;
  let bestDist = Infinity;
  for (let i = startIdx; i < geometry.length; i++) {
    const d = Math.hypot(geometry[i][0] - lat, geometry[i][1] - lng);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
    // Once we've found a close match and are clearly moving away, stop early
    if (bestDist < 0.01 && d > bestDist * 3) break;
  }
  return best;
}

/**
 * Split fullGeometry into per-day chunks.
 * Uses overnight location nearest-point to find each day boundary.
 */
function splitGeometryByDays(
  geometry: [number, number][],
  days: TripDay[]
): [number, number][][] {
  if (days.length <= 1 || geometry.length < 2) return [geometry];

  const splitIndices: number[] = [0];
  let searchFrom = 0;

  for (let d = 0; d < days.length - 1; d++) {
    const loc = days[d].overnight?.location;
    if (loc) {
      const idx = nearestGeomIndex(geometry, loc.lat, loc.lng, searchFrom);
      splitIndices.push(idx);
      searchFrom = Math.max(searchFrom, idx);
    } else {
      // Fallback: evenly split if no overnight location
      const idx = Math.round(((d + 1) / days.length) * geometry.length);
      splitIndices.push(idx);
      searchFrom = idx;
    }
  }
  splitIndices.push(geometry.length - 1);

  return splitIndices.slice(0, -1).map((start, i) =>
    geometry.slice(start, splitIndices[i + 1] + 1)
  );
}

const overnightIcon = L.divIcon({
  className: 'overnight-marker',
  html: `<div style="
    background: #1E293B;
    width: 34px; height: 34px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 3px 10px rgba(0,0,0,0.35);
    font-size: 17px;
  ">🏨</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -20],
});

interface DayRouteLayerProps {
  days: TripDay[];
  fullGeometry: [number, number][];
}

export function DayRouteLayer({ days, fullGeometry }: DayRouteLayerProps) {
  const dayGeometries = useMemo(
    () => splitGeometryByDays(fullGeometry, days),
    [fullGeometry, days]
  );

  return (
    <>
      {/* Day-colored polylines */}
      {dayGeometries.map((geom, i) => {
        if (geom.length < 2) return null;
        const color = DAY_COLORS[i % DAY_COLORS.length];
        return (
          <Polyline
            key={`day-seg-${i}`}
            positions={geom}
            pathOptions={{ color, weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
          />
        );
      })}

      {/* Overnight stop markers */}
      {days.map((day, i) => {
        if (!day.overnight?.location) return null;
        const loc = day.overnight.location;
        const nextDay = days[i + 1];
        return (
          <Marker
            key={`overnight-${i}`}
            position={[loc.lat, loc.lng]}
            icon={overnightIcon}
          >
            <Popup className="font-sans">
              <div className="p-1 text-center min-w-[150px]">
                <div className="text-base mb-1">🏨</div>
                <div className="font-semibold text-gray-900 text-sm">Night {day.dayNumber}</div>
                <div className="text-xs text-gray-500 mt-0.5">{loc.name}</div>
                {day.overnight.hotelName && (
                  <div className="text-xs text-gray-400 mt-0.5 italic">{day.overnight.hotelName}</div>
                )}
                {nextDay && (
                  <div className="text-xs text-gray-400 mt-1.5 pt-1 border-t border-gray-100">
                    Next: {nextDay.route.split('→')[1]?.trim() ?? nextDay.segments[0]?.to?.name}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
