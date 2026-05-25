import type { TemplateImportResult } from '../../../lib/url';

interface RoutePreviewSVGProps {
  locations: TemplateImportResult['locations'];
}

export function RoutePreviewSVG({ locations }: RoutePreviewSVGProps) {
  const stops = locations.filter(l => l.name);
  if (stops.length < 2) return null;
  const W = 400, dotY = 16, dotR = 5;
  const xs = stops.map((_, i) => i === 0 ? dotR : i === stops.length - 1 ? W - dotR : (i / (stops.length - 1)) * W);
  return (
    <svg viewBox={`0 0 ${W} 44`} style={{ width: '100%', overflow: 'visible', display: 'block' }}>
      {xs.slice(0, -1).map((x, i) => (
        <line key={i} x1={x} y1={dotY} x2={xs[i + 1]} y2={dotY} stroke="rgba(245,240,232,0.12)" strokeWidth={1.5} />
      ))}
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={dotY} r={dotR}
          fill={i === 0 || i === stops.length - 1 ? 'rgba(249,115,22,0.75)' : 'rgba(245,240,232,0.3)'} />
      ))}
      {xs.map((x, i) => (
        <text key={i} x={x} y={dotY + 18} textAnchor="middle"
          fill="rgba(245,240,232,0.38)" fontSize={9} fontFamily="DM Mono, monospace">
          {stops[i].name.split(',')[0].substring(0, 14)}
        </text>
      ))}
    </svg>
  );
}
