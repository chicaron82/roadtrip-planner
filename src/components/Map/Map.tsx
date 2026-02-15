import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Location } from '../../types';

// Fix for default marker icons in React Leaflet
// import icon from 'leaflet/dist/images/marker-icon.png';
// import iconShadow from 'leaflet/dist/images/marker-shadow.png';

interface MapProps {
  locations: Location[];
  routeGeometry: [number, number][] | null;
  tripActive: boolean;
  markerCategories: never[]; // temporarily allow to pass through if needed or remove from props
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

export function Map({ locations, routeGeometry }: MapProps) {
  // Custom Icon Generator
  const createCustomIcon = (type: string, categoryColor?: string, emoji?: string) => {
    const color = categoryColor || markerColors[type] || '#333';
    const label = emoji || markerLabels[type] || '•';
    
    return L.divIcon({
      className: 'custom-marker-container',
      html: `<div class="custom-marker" style="
        background: ${color};
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 3px 12px rgba(0,0,0,0.3);
        font-size: 16px;
      ">${label}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
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
      </MapContainer>
    </div>
  );
}
