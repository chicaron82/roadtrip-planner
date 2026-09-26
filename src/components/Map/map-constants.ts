import type { FeasibilityStatus } from '../../lib/feasibility';

// ── Tile layers ──────────────────────────────────────────────────────────────
export const TILE_LAYERS = {
  // ⚠️ OSM's own standard tiles, NOT CARTO. CARTO's basemaps started answering every request —
  // localhost and myexperienceengine.com alike — with a grey "API KEY REQUIRED ·
  // carto.com/basemaps/apikey" tile, so the default layer was watermarked for everyone while every
  // gate stayed green (found by rendering it, ZeeRah's 2026-09-26 line-check). OSM keeps MEE's
  // "no API keys required" promise true. Its usage policy asks for attribution and no bulk
  // downloading, both of which a per-user map already honours. No `{r}` — OSM has no retina variant.
  street: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
  },
} as const;
export type TileStyle = keyof typeof TILE_LAYERS;

/** Mode-tinted colours for the dashed preview line. */
export const PREVIEW_LINE_COLOR: Record<string, string> = {
  plan:      '#22C55E',
  estimate:  '#3B82F6',
  adventure: '#F59E0B',
};

/** Main route line colour driven by trip feasibility status. */
export const FEASIBILITY_LINE_COLOR: Record<FeasibilityStatus, string> = {
  'on-track': '#22C55E',
  'tight':    '#F59E0B',
  'over':     '#EF4444',
};

export const DEFAULT_ROUTE_COLOR = 'hsl(221.2 83.2% 53.3%)';

/** Quick weather emoji from Open-Meteo weather codes. */
export function weatherEmoji(w: { temperatureMax: number; precipitationProb: number; weatherCode: number }): string {
  if (w.temperatureMax > 25) return '☀️';
  if (w.precipitationProb > 40) return '🌧️';
  if (w.weatherCode > 3) return '☁️';
  return '🌤️';
}
