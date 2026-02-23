import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Location, POI, MarkerCategory, RouteSegment, TripDay } from '../../types';
import type { StrategicFuelStop } from '../../lib/calculations';
import type { FeasibilityStatus } from '../../lib/feasibility';
import { haversineDistance, estimateDetourTime } from '../../lib/poi-ranking';
import { formatDuration } from '../../lib/calculations';
import { AnimatedPolyline } from './AnimatedPolyline';
import { POIPopup, type PopupDayOption } from './POIPopup';
import { DayRouteLayer } from './DayRouteLayer';
import { FuelStopLayer } from './FuelStopLayer';

// ── Tile layers ──────────────────────────────────────────────────────────────
const TILE_LAYERS = {
  street: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
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
type TileStyle = keyof typeof TILE_LAYERS;

// Mode-tinted colours for the dashed preview line
const PREVIEW_LINE_COLOR: Record<string, string> = {
  plan:      '#22C55E',
  estimate:  '#3B82F6',
  adventure: '#F59E0B',
};

/** Main route line colour driven by trip feasibility status. */
const FEASIBILITY_LINE_COLOR: Record<FeasibilityStatus, string> = {
  'on-track': '#22C55E', // green
  'tight':    '#F59E0B', // amber
  'over':     '#EF4444', // red
};

const DEFAULT_ROUTE_COLOR = 'hsl(221.2 83.2% 53.3%)'; // blue fallback (no feasibility yet)

/** Quick weather emoji from Open-Meteo weather codes. */
function weatherEmoji(w: { temperatureMax: number; precipitationProb: number; weatherCode: number }): string {
  if (w.temperatureMax > 25) return '☀️';
  if (w.precipitationProb > 40) return '🌧️';
  if (w.weatherCode > 3) return '☁️';
  return '🌤️';
}

/** Find the RouteSegment closest to a clicked map point (uses segment midpoints). */
function findNearestSegment(lat: number, lng: number, segments: RouteSegment[]): RouteSegment | null {
  if (!segments.length) return null;
  let best: RouteSegment | null = null;
  let bestDist = Infinity;
  for (const seg of segments) {
    const midLat = (seg.from.lat + seg.to.lat) / 2;
    const midLng = (seg.from.lng + seg.to.lng) / 2;
    const d = Math.hypot(lat - midLat, lng - midLng);
    if (d < bestDist) { bestDist = d; best = seg; }
  }
  return best;
}

interface AlternateRouteGeometry {
  geometry: [number, number][];
  label: string;
  emoji: string;
  onSelect: () => void;
}

interface MapProps {
  locations: Location[];
  routeGeometry: [number, number][] | null;
  tripActive: boolean;
  pois: POI[];
  markerCategories: MarkerCategory[];
  strategicFuelStops?: StrategicFuelStop[];
  addedPOIIds?: Set<string>;
  dayOptions?: PopupDayOption[];
  onMapClick?: (lat: number, lng: number) => void;
  onAddPOI?: (poi: POI, afterSegmentIndex?: number) => void;
  /** Lightweight geometry preview shown before full calculation fires */
  previewGeometry?: [number, number][] | null;
  /** Current trip mode — determines preview line colour */
  tripMode?: string;
  /** Feasibility status — drives main route line colour (green/amber/red) */
  feasibilityStatus?: FeasibilityStatus | null;
  /** Inactive named route strategies shown as ghost lines — click to select */
  alternateGeometries?: AlternateRouteGeometry[];
  /** Multi-day breakdown — enables day-colored route + 🏨 overnight markers */
  tripDays?: TripDay[];
  /** All route segments — used for click-to-inspect popup */
  routeSegments?: RouteSegment[];
}

const markerColors: Record<string, string> = {
  origin: '#3b82f6',
  waypoint: '#f59e0b',
  destination: '#10b981',
};

const markerLabels: Record<string, string> = {
  origin: '🚗',
  waypoint: '📍',
  destination: '🏁',
};

// Component to handle map view updates
function MapUpdater({
  locations,
  routeGeometry,
  previewGeometry,
}: {
  locations: Location[];
  routeGeometry: [number, number][] | null;
  previewGeometry?: [number, number][] | null;
}) {
  const map = useMap();
  // Fit bounds to whichever geometry is available
  const effectiveGeometry = routeGeometry ?? previewGeometry ?? null;

  useEffect(() => {
    // Filter out invalid locations (undefined, or with invalid coordinates)
    const validLocations = locations.filter(
      l => l && typeof l.lat === 'number' && typeof l.lng === 'number' &&
      !isNaN(l.lat) && !isNaN(l.lng) && l.lat !== 0 && l.lng !== 0
    );

    if (validLocations.length > 0) {
      const bounds = L.latLngBounds(validLocations.map(l => [l.lat, l.lng]));
      if (effectiveGeometry) {
        // Filter out invalid coordinates before extending bounds
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
      // No valid locations (reset state) — fly back to default view
      map.setView([49.8951, -97.1384], 5);
    }
  }, [locations, effectiveGeometry, map]);

  return null;
}

// Component to handle map click events
function MapClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

export function Map({ locations, routeGeometry, pois, markerCategories, strategicFuelStops = [], addedPOIIds, dayOptions, onMapClick, onAddPOI, previewGeometry, tripMode, feasibilityStatus, alternateGeometries, tripDays, routeSegments }: MapProps) {
  const [tileStyle, setTileStyle] = useState<TileStyle>('street');
  const [clickedSegment, setClickedSegment] = useState<{
    lat: number;
    lng: number;
    segment: RouteSegment;
  } | null>(null);

  const isMultiDay = (tripDays?.length ?? 0) > 1;

  // Custom Icon Generator
  const createCustomIcon = (type: string, categoryColor?: string, emoji?: string) => {
    // Basic color mapping for tailwind classes if passed directly
    let color = categoryColor || markerColors[type] || '#333';

    // Quick hack map tailwind classes to hex if passed from category (e.g. 'green-500' -> hex)
    // In a real app we'd use a proper color utility or pass hex codes in config
    if (categoryColor === 'green-500') color = '#22c55e';
    if (categoryColor === 'orange-500') color = '#f97316';
    if (categoryColor === 'blue-500') color = '#3b82f6';
    if (categoryColor === 'purple-500') color = '#a855f7';

    const label = emoji || markerLabels[type] || '•';

    return L.divIcon({
      className: 'custom-marker-container',
      html: `<div class="custom-marker" style="
        background: ${color};
        width: ${emoji ? '32px' : '36px'};
        height: ${emoji ? '32px' : '36px'};
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 3px 8px rgba(0,0,0,0.3);
        font-size: ${emoji ? '18px' : '16px'};
      ">${label}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -18],
    });
  };

  // Added POI marker — green ring with checkmark
  const createAddedIcon = (emoji: string) => {
    return L.divIcon({
      className: 'custom-marker-container',
      html: `<div style="
        background: #16a34a;
        width: 34px; height: 34px;
        display: flex; align-items: center; justify-content: center;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 3px 10px rgba(22,163,74,0.4);
        font-size: 16px;
        position: relative;
      ">${emoji}<span style="
        position: absolute; top: -4px; right: -4px;
        background: white; border-radius: 50%;
        width: 14px; height: 14px;
        display: flex; align-items: center; justify-content: center;
        font-size: 10px; color: #16a34a; font-weight: bold;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      ">✓</span></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -19],
    });
  };

  // Compute detour minutes from nearest route point
  const getDetourMinutes = (poi: POI): number => {
    if (!routeGeometry || routeGeometry.length === 0) return 0;
    let minDist = Infinity;
    // Sample every 10th point for performance on dense geometries
    for (let i = 0; i < routeGeometry.length; i += 10) {
      const d = haversineDistance(poi.lat, poi.lng, routeGeometry[i][0], routeGeometry[i][1]);
      if (d < minDist) minDist = d;
    }
    return estimateDetourTime(minDist);
  };

  return (
    <div className="h-full w-full relative z-0">
      {/* Tile layer switcher — floating pills, top-right corner */}
      <div className="absolute top-2 right-2 z-[1000] flex flex-col gap-1">
        {(['street', 'terrain', 'satellite'] as TileStyle[]).map(style => (
          <button
            key={style}
            onClick={() => setTileStyle(style)}
            className={`text-xs px-2.5 py-1 rounded-full shadow-md transition-all border ${
              tileStyle === style
                ? 'bg-white text-gray-900 font-semibold border-white/80 shadow-lg'
                : 'bg-black/50 text-white border-white/10 hover:bg-black/70 backdrop-blur-sm'
            }`}
          >
            {style === 'street' ? '🗺 Street' : style === 'terrain' ? '⛰ Terrain' : '🛰 Satellite'}
          </button>
        ))}
      </div>

      <MapContainer
        center={[49.8951, -97.1384]}
        zoom={5}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          key={tileStyle}
          attribution={TILE_LAYERS[tileStyle].attribution}
          url={TILE_LAYERS[tileStyle].url}
        />

        <MapUpdater locations={locations} routeGeometry={routeGeometry} previewGeometry={previewGeometry} />
        <MapClickHandler onMapClick={onMapClick} />

        {/* Preview line — dashed, mode-coloured, shown before full calculation */}
        {!routeGeometry && previewGeometry && (
          <Polyline
            positions={previewGeometry}
            pathOptions={{
              color: PREVIEW_LINE_COLOR[tripMode ?? 'plan'] ?? '#22C55E',
              weight: 4,
              opacity: 0.45,
              dashArray: '8 10',
            }}
          />
        )}

        {/* Alternate route ghost lines — rendered behind the active route */}
        {alternateGeometries?.map((alt, i) => (
          <Polyline
            key={`alt-route-${i}`}
            positions={alt.geometry}
            pathOptions={{
              color: '#94A3B8',
              weight: 4,
              opacity: 0.5,
              dashArray: '2 7',
              lineCap: 'round',
            }}
            eventHandlers={{ click: alt.onSelect }}
          />
        ))}

        {/* Route lines */}
        {routeGeometry && (
          <>
            {/* Shadow/Outline (animated) */}
            <AnimatedPolyline
              positions={routeGeometry}
              color="#000"
              weight={8}
              opacity={0.2}
              animationDuration={2000}
            />

            {/* Multi-day: day-colored segments + overnight markers */}
            {isMultiDay && tripDays ? (
              <DayRouteLayer days={tripDays} fullGeometry={routeGeometry} />
            ) : (
              /* Single-day: feasibility-colored animated line */
              <AnimatedPolyline
                positions={routeGeometry}
                color={feasibilityStatus ? FEASIBILITY_LINE_COLOR[feasibilityStatus] : DEFAULT_ROUTE_COLOR}
                weight={feasibilityStatus === 'on-track' ? 6 : 5}
                opacity={0.9}
                animationDuration={2000}
              />
            )}

            {/* Transparent click-capture polyline — fires segment detail popup */}
            {routeSegments && routeSegments.length > 0 && (
              <Polyline
                positions={routeGeometry}
                pathOptions={{ color: 'transparent', weight: 20, opacity: 0.001 }}
                eventHandlers={{
                  click(e) {
                    const { lat, lng } = e.latlng;
                    const seg = findNearestSegment(lat, lng, routeSegments);
                    if (seg) setClickedSegment({ lat, lng, segment: seg });
                  },
                }}
              />
            )}

            {/* Segment detail popup */}
            {clickedSegment && (
              <Popup
                position={[clickedSegment.lat, clickedSegment.lng]}
                eventHandlers={{ remove: () => setClickedSegment(null) }}
                className="font-sans"
              >
                <div className="p-1 min-w-[180px]">
                  <div className="text-xs font-semibold text-gray-900 leading-snug">
                    {clickedSegment.segment.from.name}
                    <span className="text-gray-400 mx-1">→</span>
                    {clickedSegment.segment.to.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1.5 space-y-0.5">
                    <div>📏 {clickedSegment.segment.distanceKm.toFixed(0)} km</div>
                    <div>⏱ {formatDuration(clickedSegment.segment.durationMinutes)}</div>
                    {clickedSegment.segment.fuelCost > 0 && (
                      <div>⛽ ${clickedSegment.segment.fuelCost.toFixed(2)}</div>
                    )}
                    {clickedSegment.segment.weather && (
                      <div>
                        {weatherEmoji(clickedSegment.segment.weather)}{' '}
                        {clickedSegment.segment.weather.temperatureMax.toFixed(0)}°C
                        {clickedSegment.segment.weather.precipitationProb > 0 && (
                          <span className="text-gray-400 ml-1">
                            · {clickedSegment.segment.weather.precipitationProb}% rain
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            )}
          </>
        )}

        {/* Location Markers */}
        {locations
          .filter(loc =>
            loc && typeof loc.lat === 'number' && typeof loc.lng === 'number' &&
            !isNaN(loc.lat) && !isNaN(loc.lng) && loc.lat !== 0 && loc.lng !== 0
          )
          .map((loc, index) => (
            <Marker
              key={loc.id}
              position={[loc.lat, loc.lng]}
              icon={createCustomIcon(loc.type)}
            >
              <Popup className="font-sans">
                <div className="p-1">
                  <strong>
                    {loc.type === 'origin' ? 'Start' : loc.type === 'destination' ? 'Destination' : `Stop ${index}`}
                  </strong>
                  <br />
                  <span className="text-gray-500 text-xs">{loc.name}</span>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* POI Markers */}
        {pois.map((poi) => {
            const category = markerCategories.find(c => c.id === poi.category);
            if (!category || !category.visible) return null;
            const isAdded = addedPOIIds?.has(poi.id) ?? false;

            return (
                <Marker
                    key={poi.id}
                    position={[poi.lat, poi.lng]}
                    icon={isAdded
                      ? createAddedIcon(category.emoji)
                      : createCustomIcon(poi.category, category.color.replace('bg-', ''), category.emoji)
                    }
                >
                    <Popup className="font-sans">
                        {onAddPOI ? (
                          <POIPopup
                            poi={poi}
                            category={category}
                            isAdded={isAdded}
                            detourMinutes={getDetourMinutes(poi)}
                            dayOptions={dayOptions}
                            onAdd={onAddPOI}
                          />
                        ) : (
                          <div className="p-1 text-center">
                            <div className="text-xl mb-1">{category.emoji}</div>
                            <strong>{poi.name}</strong>
                            {poi.address && <div className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">{poi.address}</div>}
                          </div>
                        )}
                    </Popup>
                </Marker>
            );
        })}

        {/* Strategic Fuel Stop Markers */}
        <FuelStopLayer stops={strategicFuelStops} />
      </MapContainer>
    </div>
  );
}
