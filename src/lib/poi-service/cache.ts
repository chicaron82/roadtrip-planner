import type { Location, TripPreference } from '../../types';

/**
 * Lightweight route geometry hash: round coords to 2dp (~1km precision),
 * sample every Nth point for long routes, join with preferences.
 * Used as a stable query key for React Query.
 */
export function hashRouteKey(
  geometry: [number, number][],
  destination: Location,
  preferences: TripPreference[]
): string {
  // Sample at most 20 points evenly
  const step = Math.max(1, Math.floor(geometry.length / 20));
  const sampled = geometry.filter((_, i) => i % step === 0);
  const coordStr = sampled.map(([lat, lng]) => `${lat.toFixed(2)},${lng.toFixed(2)}`).join('|');
  const destStr = `${destination.lat?.toFixed(2)},${destination.lng?.toFixed(2)}`;
  const prefStr = [...preferences].sort().join(',');
  return `${coordStr}::${destStr}::${prefStr}`;
}
