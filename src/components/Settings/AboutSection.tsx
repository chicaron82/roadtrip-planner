const OPEN_SOURCE_CREDITS = [
  {
    name: 'OSRM',
    url: 'https://project-osrm.org/',
    description: 'Routing engine — calculates drive times and distances.',
  },
  {
    name: 'Photon / komoot',
    url: 'https://photon.komoot.io/',
    description: 'Geocoding — turns city names into coordinates.',
  },
  {
    name: 'OpenStreetMap',
    url: 'https://www.openstreetmap.org/',
    description: 'Map tiles and geographic data.',
  },
  {
    name: 'Overpass API',
    url: 'https://overpass-api.de/',
    description: 'Points of interest — gas stations, hotels, food stops.',
  },
  {
    name: 'Open-Meteo',
    url: 'https://open-meteo.com/',
    description: 'Weather forecasts along your route.',
  },
  {
    name: 'CARTO',
    url: 'https://carto.com/',
    description: 'Dark map tiles for the classic road-trip look.',
  },
  {
    name: 'Leaflet',
    url: 'https://leafletjs.com/',
    description: 'Interactive map rendering.',
  },
];

export function AboutSection() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {OPEN_SOURCE_CREDITS.map((credit) => (
          <div key={credit.name} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <a
                href={credit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-sky-400 hover:text-sky-300 font-medium"
              >
                {credit.name}
              </a>
              <p className="text-xs text-zinc-500 mt-0.5">{credit.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-700 pt-3 text-xs text-zinc-600 space-y-1">
        <p>Built with React, TypeScript, and Tailwind CSS.</p>
        <p>Map data © OpenStreetMap contributors.</p>
        <p className="italic">No accounts. No tracking. Just road trips. 🚗</p>
      </div>
    </div>
  );
}
