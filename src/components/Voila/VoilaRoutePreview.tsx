/**
 * VoilaRoutePreview — The route condensing into a confident symbol.
 *
 * SVG-based. No border, no card, no background — the glass panel IS
 * the background. Route line bleeds to the edges of the container.
 *
 * The full-screen map is the real map. This is a ghost of it surfacing
 * through the glass — the trip made visual before the user reads a word.
 *
 * Geometry is downsampled to ≤300 points for smooth SVG rendering.
 *
 * 💚 My Experience Engine — Refinement 6
 */

const MAX_POINTS = 300;

interface VoilaRoutePreviewProps {
  geometry: [number, number][] | undefined; // [lat, lng][]
}

export function VoilaRoutePreview({ geometry }: VoilaRoutePreviewProps) {
  if (!geometry || geometry.length < 2) return null;

  // Downsample to keep SVG rendering fast
  const step = Math.ceil(geometry.length / MAX_POINTS);
  const sampled = geometry.filter((_, i) => i % step === 0);
  // Always include the last point
  if (sampled[sampled.length - 1] !== geometry[geometry.length - 1]) {
    sampled.push(geometry[geometry.length - 1]);
  }

  const lats = sampled.map(c => c[0]);
  const lngs = sampled.map(c => c[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  const latSpan = maxLat - minLat || 0.01;
  const lngSpan = maxLng - minLng || 0.01;
  const padFactor = 0.1;

  const vMinLng = minLng - lngSpan * padFactor;
  const vMaxLat = maxLat + latSpan * padFactor;
  const vW = lngSpan * (1 + 2 * padFactor);
  const vH = latSpan * (1 + 2 * padFactor);

  // x = lng offset, y = flipped lat (SVG y goes down, map lat goes up)
  const toX = (lng: number) => lng - vMinLng;
  const toY = (lat: number) => vMaxLat - lat;

  const points = sampled.map(([lat, lng]) => `${toX(lng)},${toY(lat)}`).join(' ');

  const origin = sampled[0];
  const dest = sampled[sampled.length - 1];
  const dotR = Math.max(vW, vH) * 0.025;
  const strokeW = Math.max(vW, vH) * 0.007;

  return (
    <div style={{ width: '100%', margin: '4px 0 16px', overflow: 'hidden' }}>
      <svg
        viewBox={`0 0 ${vW} ${vH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: 130, display: 'block' }}
        aria-hidden="true"
      >
        {/* Ghost track — subtle depth */}
        <polyline
          points={points}
          fill="none"
          stroke="rgba(245, 240, 232, 0.07)"
          strokeWidth={strokeW * 2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Route line — symbolic, heavier than live map */}
        <polyline
          points={points}
          fill="none"
          stroke="rgba(249, 115, 22, 0.65)"
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Origin dot */}
        <circle
          cx={toX(origin[1])}
          cy={toY(origin[0])}
          r={dotR}
          fill="rgba(245, 240, 232, 0.7)"
        />

        {/* Destination dot — orange, the goal */}
        <circle
          cx={toX(dest[1])}
          cy={toY(dest[0])}
          r={dotR}
          fill="#f97316"
        />
      </svg>
    </div>
  );
}
