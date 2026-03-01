/**
 * Find the RouteSegment closest to a clicked map point (uses segment midpoints).
 */
export function findNearestSegment<T extends { from: { lat: number; lng: number }; to: { lat: number; lng: number } }>(
  lat: number,
  lng: number,
  segments: T[],
): T | null {
  if (!segments.length) return null;
  let best: T | null = null;
  let bestDist = Infinity;
  for (const seg of segments) {
    const midLat = (seg.from.lat + seg.to.lat) / 2;
    const midLng = (seg.from.lng + seg.to.lng) / 2;
    const d = Math.hypot(lat - midLat, lng - midLng);
    if (d < bestDist) { bestDist = d; best = seg; }
  }
  return best;
}
