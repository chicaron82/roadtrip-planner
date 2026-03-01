import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
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
import { TILE_LAYERS, type TileStyle, PREVIEW_LINE_COLOR, FEASIBILITY_LINE_COLOR, DEFAULT_ROUTE_COLOR, weatherEmoji } from './map-constants';
import { createCustomIcon, createAddedIcon } from './map-icons';
import { MapUpdater, MapClickHandler, findNearestSegment } from './MapHelpers';

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

export function Map({ locations, routeGeometry, pois, markerCategories, strategicFuelStops = [], addedPOIIds, dayOptions, onMapClick, onAddPOI, previewGeometry, tripMode, feasibilityStatus, alternateGeometries, tripDays, routeSegments }: MapProps) {
  const [tileStyle, setTileStyle] = useState<TileStyle>('street');
  const [clickedSegment, setClickedSegment] = useState<{
    lat: number;
    lng: number;
    segment: RouteSegment;
  } | null>(null);

  const isMultiDay = (tripDays?.length ?? 0) > 1;

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
