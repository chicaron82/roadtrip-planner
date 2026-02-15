import type { Location, RouteSegment } from '../types';

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

export async function searchLocations(query: string): Promise<Location[]> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        query
      )}&format=json&limit=5&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'RoadTripPlanner/1.0',
        },
      }
    );
    const data: NominatimResult[] = await response.json();
    
    return data.map((item) => ({
      id: crypto.randomUUID(), // Generate a temporary ID for the search result
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      name: item.display_name.split(',').slice(0, 2).join(','),
      address: item.display_name,
      type: 'waypoint', // Default type
    }));
  } catch (error) {
    console.error("Search failed:", error);
    return [];
  }
}

export async function calculateRoute(locations: Location[], options?: { avoidTolls?: boolean; scenicMode?: boolean }): Promise<{ segments: RouteSegment[], fullGeometry: [number, number][] } | null> {
  if (locations.length < 2) return null;

  const waypoints = locations.map((loc) => `${loc.lng},${loc.lat}`).join(';');
  const parts: string[] = [];

  if (options?.avoidTolls) parts.push('toll');
  if (options?.scenicMode) parts.push('motorway');

  const excludeParam = parts.length > 0 ? `&exclude=${parts.join(',')}` : '';

  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson&steps=true${excludeParam}`
    );
    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes?.length) return null;

    const route = data.routes[0];
    const fullGeometry = route.geometry.coordinates.map((coord: number[]) => [
      coord[1],
      coord[0],
    ]) as [number, number][];

    const segments: RouteSegment[] = [];

    // OSRM returns legs between waypoints
    for (let i = 0; i < route.legs.length; i++) {
        const leg = route.legs[i];
        segments.push({
            from: locations[i],
            to: locations[i+1],
            distanceKm: leg.distance / 1000,
            durationMinutes: leg.duration / 60,
            fuelNeededLitres: 0, // Calculated later
             fuelCost: 0, // Calculated later
        });
    }

    return { segments, fullGeometry };
  } catch (error) {
    console.error("Route calculation failed:", error);
    return null;
  }
}
