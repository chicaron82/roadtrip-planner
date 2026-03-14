import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { StrategicFuelStop } from '../../lib/calculations';

interface FuelStopLayerProps {
  stops: StrategicFuelStop[];
}

const fuelIcon = L.divIcon({
  className: 'strategic-fuel-marker',
  html: `<div style="
    background: #f97316;
    width: 26px; height: 26px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.75);
    box-shadow: 0 2px 6px rgba(249, 115, 22, 0.3);
    font-size: 13px;
    opacity: 0.8;
  ">⛽</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -14],
});

export function FuelStopLayer({ stops }: FuelStopLayerProps) {
  if (!stops.length) return null;

  return (
    <>
      {stops.map((stop, index) => (
        <Marker
          key={`fuel-${index}`}
          position={[stop.lat, stop.lng]}
          icon={fuelIcon}
        >
          <Popup className="font-sans">
            <div className="p-2 text-center">
              <div className="text-2xl mb-2">⛽</div>
              <div className="font-semibold text-orange-900 mb-1">
                {stop.stationName ?? 'Recommended Fuel Stop'}
              </div>
              {stop.stationAddress && (
                <div className="text-xs text-gray-500 mb-1">{stop.stationAddress}</div>
              )}
              <div className="text-xs text-gray-600 space-y-1">
                <div>📍 {stop.distanceFromStart.toFixed(0)} km from start</div>
                <div>⏱️ After {stop.estimatedTime}</div>
                <div className={`font-semibold ${stop.fuelRemaining < 25 ? 'text-red-600' : 'text-orange-600'}`}>
                  🔋 ~{stop.fuelRemaining.toFixed(0)}% fuel remaining
                </div>
              </div>
              {stop.isRemote && (
                <div className="text-[10px] text-amber-700 bg-amber-50 rounded px-2 py-1 mt-2">
                  ⚠️ Remote area — verify fuel availability
                </div>
              )}
              {!stop.isRemote && !stop.stationName && (
                <div className="text-[10px] text-gray-500 mt-2 italic">
                  Based on your vehicle's range
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
