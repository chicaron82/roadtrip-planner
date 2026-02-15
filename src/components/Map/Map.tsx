import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Location, POI, MarkerCategory } from '../../types';

// ... (existing imports)

interface MapProps {
  locations: Location[];
  routeGeometry: [number, number][] | null;
  tripActive: boolean;
  pois: POI[];
  markerCategories: MarkerCategory[];
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
function MapUpdater({ locations, routeGeometry }: { locations: Location[], routeGeometry: [number, number][] | null }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length > 0) {
      const bounds = L.latLngBounds(locations.map(l => [l.lat, l.lng]));
      if (routeGeometry) {
        routeGeometry.forEach(coord => bounds.extend(coord));
      }
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [locations, routeGeometry, map]);

  return null;
}

export function Map({ locations, routeGeometry, pois, markerCategories }: MapProps) {
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

  return (
    <div className="h-full w-full relative z-0">
      <MapContainer
        center={[49.8951, -97.1384]}
        zoom={5}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        
        <MapUpdater locations={locations} routeGeometry={routeGeometry} />

        {/* Route Polylines */}
        {routeGeometry && (
          <>
             {/* Shadow/Outline */}
            <Polyline
              positions={routeGeometry}
              pathOptions={{ color: '#000', weight: 8, opacity: 0.2 }}
            />
             {/* Main Line */}
            <Polyline
              positions={routeGeometry}
              pathOptions={{ color: 'hsl(221.2 83.2% 53.3%)', weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
            />
          </>
        )}

        {/* Location Markers */}
        {locations.map((loc, index) => (
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

            return (
                <Marker
                    key={poi.id}
                    position={[poi.lat, poi.lng]}
                    icon={createCustomIcon(poi.category, category.color.replace('bg-', ''), category.emoji)}
                >
                    <Popup className="font-sans">
                        <div className="p-1 text-center">
                            <div className="text-xl mb-1">{category.emoji}</div>
                            <strong>{poi.name}</strong>
                            {poi.address && <div className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">{poi.address}</div>}
                        </div>
                    </Popup>
                </Marker>
            );
        })}
      </MapContainer>
    </div>
  );
}
