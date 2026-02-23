import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { StrategicFuelStop } from '../../lib/calculations';

interface FuelStopLayerProps {
  stops: StrategicFuelStop[];
}

const fuelIcon = L.divIcon({
  className: 'strategic-fuel-marker',
  html: `<div style="
    position: relative;
    width: 40px;
    height: 40px;
  ">
    <div style="
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #f97316, #fb923c);
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      animation: pulse-fuel 2s ease-in-out infinite;
    ">⛽</div>
    <style>
      @keyframes pulse-fuel {
        0%, 100% { box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4); }
        50% { box-shadow: 0 4px 20px rgba(249, 115, 22, 0.8), 0 0 0 8px rgba(249, 115, 22, 0.1); }
      }
    </style>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
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
              <div className="font-semibold text-orange-900 mb-1">Recommended Fuel Stop</div>
              <div className="text-xs text-gray-600 space-y-1">
                <div>📍 {stop.distanceFromStart.toFixed(0)} km from start</div>
                <div>⏱️ After {stop.estimatedTime}</div>
                <div className={`font-semibold ${stop.fuelRemaining < 25 ? 'text-red-600' : 'text-orange-600'}`}>
                  🔋 ~{stop.fuelRemaining.toFixed(0)}% fuel remaining
                </div>
              </div>
              <div className="text-[10px] text-gray-500 mt-2 italic">
                Based on your vehicle's range
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
