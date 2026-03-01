import L from 'leaflet';

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
