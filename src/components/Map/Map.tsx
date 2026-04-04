import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Location, RouteSegment, TripDay } from '../../types';
import type { StrategicFuelStop } from '../../lib/calculations';
import type { FeasibilityStatus } from '../../lib/feasibility';
import { formatDuration, formatDistance } from '../../lib/calculations';
import { AnimatedPolyline } from './AnimatedPolyline';
import { DayRouteLayer } from './DayRouteLayer';
import { FuelStopLayer } from './FuelStopLayer';
import { TILE_LAYERS, type TileStyle, PREVIEW_LINE_COLOR, FEASIBILITY_LINE_COLOR, DEFAULT_ROUTE_COLOR, weatherEmoji } from './map-constants';
import { createCustomIcon, createDeclaredWaypointIcon, createPassiveWaypointIcon } from './map-icons';
import { MapUpdater, MapClickHandler } from './MapHelpers';
import { FlyoverTrigger } from './FlyoverTrigger';
import { findNearestSegment } from './map-utils';
import { useMapPresentationModel } from '../../hooks';
import { AdventureRadiusLayer } from './AdventureRadiusLayer';

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
  strategicFuelStops?: StrategicFuelStop[];
  onMapClick?: (lat: number, lng: number) => void;
  previewGeometry?: [number, number][] | null;
  tripMode?: string;
  feasibilityStatus?: FeasibilityStatus | null;
  alternateGeometries?: AlternateRouteGeometry[];
  tripDays?: TripDay[];
  routeSegments?: RouteSegment[];
  routeTotals?: { distanceKm: number; durationMinutes: number };
  units?: 'metric' | 'imperial';
  /** Adventure Icebreaker radius preview — shows reach circle + destination pins */
  adventurePreview?: { lat: number; lng: number; radiusKm: number } | null;
  /** When true, triggers the Flyover (fitBounds + moveend + 150ms → onFlyoverComplete). */
  flyoverActive?: boolean;
  onFlyoverComplete?: () => void;
}

export function Map({
  locations, routeGeometry, strategicFuelStops = [],
  onMapClick, previewGeometry, tripMode,
  feasibilityStatus, alternateGeometries, tripDays, routeSegments, routeTotals,
  units = 'metric', adventurePreview, flyoverActive, onFlyoverComplete,
}: MapProps) {
  const {
    tileStyle, setTileStyle,
    clickedSegment, setClickedSegment,
    isMultiDay,
    markerPhase,
  } = useMapPresentationModel({ routeGeometry, tripDays });

  return (
    <div className="h-full w-full relative z-0">
      {/* Tile layer switcher */}
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

      {/* Route summary pill */}
      {routeTotals && routeGeometry && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none animate-in fade-in duration-700">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium bg-black/65 text-white border border-white/15 backdrop-blur-sm shadow-lg whitespace-nowrap">
            <span className="text-base leading-none">🛣️</span>
            <span>{formatDistance(routeTotals.distanceKm, units)}</span>
            <span className="opacity-35">·</span>
            <span>{formatDuration(Math.round(routeTotals.durationMinutes))}</span>
          </div>
        </div>
      )}

      <MapContainer center={[49.8951, -97.1384]} zoom={5} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer
          key={tileStyle}
          attribution={TILE_LAYERS[tileStyle].attribution}
          url={TILE_LAYERS[tileStyle].url}
        />

        <MapUpdater locations={locations} routeGeometry={routeGeometry} previewGeometry={previewGeometry} />
        <MapClickHandler onMapClick={onMapClick} />
        {flyoverActive && onFlyoverComplete && (
          <FlyoverTrigger
            active={flyoverActive}
            locations={locations}
            routeGeometry={routeGeometry}
            onComplete={onFlyoverComplete}
          />
        )}

        {/* Adventure radius preview — visible during Adventure Icebreaker Q1 */}
        {adventurePreview && (
          <AdventureRadiusLayer
            lat={adventurePreview.lat}
            lng={adventurePreview.lng}
            radiusKm={adventurePreview.radiusKm}
          />
        )}

        {/* Preview line */}
        {!routeGeometry && previewGeometry && (
          <Polyline
            positions={previewGeometry}
            pathOptions={{
              color: PREVIEW_LINE_COLOR[tripMode ?? 'plan'] ?? '#22C55E',
              weight: 4, opacity: 0.45, dashArray: '8 10',
            }}
          />
        )}

        {/* Alternate routes */}
        {alternateGeometries?.map((alt, i) => (
          <Polyline
            key={`alt-route-${i}`}
            positions={alt.geometry}
            pathOptions={{
              color: '#94A3B8', weight: 4, opacity: 0.5, dashArray: '2 7', lineCap: 'round',
            }}
            eventHandlers={{ click: alt.onSelect }}
          />
        ))}

        {/* Route lines */}
        {routeGeometry && (
          <>
            <AnimatedPolyline positions={routeGeometry} color="#000" weight={8} opacity={0.2} animationDuration={2000} />

            {isMultiDay && tripDays ? (
              <DayRouteLayer days={tripDays} fullGeometry={routeGeometry} showOvernight={markerPhase >= 1} />
            ) : (
              <AnimatedPolyline
                positions={routeGeometry}
                color={feasibilityStatus ? FEASIBILITY_LINE_COLOR[feasibilityStatus] : DEFAULT_ROUTE_COLOR}
                weight={feasibilityStatus === 'on-track' ? 6 : 5} opacity={0.9} animationDuration={2000}
              />
            )}

            {/* In-route click region */}
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

            {/* Segment popup */}
            {clickedSegment && (
              <Popup position={[clickedSegment.lat, clickedSegment.lng]} eventHandlers={{ remove: () => setClickedSegment(null) }} className="font-sans">
                <div className="p-1 min-w-[180px]">
                  <div className="text-xs font-semibold text-gray-900 leading-snug">
                    {clickedSegment.segment.from.name} <span className="text-gray-400 mx-1">→</span> {clickedSegment.segment.to.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1.5 space-y-0.5">
                    <div>📏 {clickedSegment.segment.distanceKm.toFixed(0)} km</div>
                    <div>⏱ {formatDuration(clickedSegment.segment.durationMinutes)}</div>
                    {clickedSegment.segment.fuelCost > 0 && <div>⛽ ${clickedSegment.segment.fuelCost.toFixed(2)}</div>}
                    {clickedSegment.segment.weather && (
                      <div>
                        {weatherEmoji(clickedSegment.segment.weather)} {clickedSegment.segment.weather.temperatureMax.toFixed(0)}°C
                        {clickedSegment.segment.weather.precipitationProb > 0 && <span className="text-gray-400 ml-1">· {clickedSegment.segment.weather.precipitationProb}% rain</span>}
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            )}
          </>
        )}

        {/* Location Markers — phase 1 (after route draw) */}
        {markerPhase >= 1 && locations.filter(loc => loc && typeof loc.lat === 'number' && typeof loc.lng === 'number' && !isNaN(loc.lat) && !isNaN(loc.lng) && loc.lat !== 0 && loc.lng !== 0).map((loc, index) => (
          <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={
            loc.type === 'waypoint'
              ? (loc.intent && (loc.intent.fuel || loc.intent.meal || loc.intent.overnight)
                  ? createDeclaredWaypointIcon(loc.intent)
                  : createPassiveWaypointIcon())
              : createCustomIcon(loc.type)
          }>
            <Popup className="font-sans">
              <div className="p-1">
                <strong>{loc.type === 'origin' ? 'Start' : loc.type === 'destination' ? 'Destination' : `Stop ${index}`}</strong><br />
                <span className="text-gray-500 text-xs">{loc.name}</span>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Strategic Fuel Stop Markers — phase 2 */}
        {markerPhase >= 2 && <FuelStopLayer stops={strategicFuelStops} />}
      </MapContainer>
    </div>
  );
}
