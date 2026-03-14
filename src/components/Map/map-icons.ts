import L from 'leaflet';
import type { WaypointIntent } from '../../types';

export const markerColors: Record<string, string> = {
  origin: '#3b82f6',
  waypoint: '#f59e0b',
  destination: '#10b981',
};

export const markerLabels: Record<string, string> = {
  origin: '🚗',
  waypoint: '📍',
  destination: '🏁',
};

/** Build a circular div-icon for location / category markers. */
export function createCustomIcon(type: string, categoryColor?: string, emoji?: string): L.DivIcon {
  let color = categoryColor || markerColors[type] || '#333';

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
}

/** Declared waypoint — user-authored intent. Anchored, confident visual weight. */
export function createDeclaredWaypointIcon(intent: WaypointIntent): L.DivIcon {
  const emoji = intent.fuel ? '⛽' : intent.meal ? '🍽️' : intent.overnight ? '🌙' : '📍';
  const color = intent.fuel ? '#f59e0b' : intent.meal ? '#f97316' : intent.overnight ? '#1E293B' : '#f59e0b';

  return L.divIcon({
    className: 'custom-marker-container',
    html: `<div style="
      background: ${color};
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%;
      border: 2.5px solid white;
      box-shadow: 0 3px 10px rgba(0,0,0,0.35);
      font-size: 16px;
    ">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

/** Passive waypoint — no declared intent; engine will infer. Quiet, secondary visual weight. */
export function createPassiveWaypointIcon(): L.DivIcon {
  return L.divIcon({
    className: 'custom-marker-container',
    html: `<div style="
      background: #64748B;
      width: 20px; height: 20px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%;
      border: 1.5px solid rgba(255,255,255,0.75);
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
      opacity: 0.7;
      font-size: 9px;
      color: white;
      font-weight: bold;
    ">•</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
  });
}

/** Green ring with checkmark for already-added POI markers. */
export function createAddedIcon(emoji: string): L.DivIcon {
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
}
