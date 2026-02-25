import type { POI, POICategory } from '../types';
import { NOMINATIM_BASE_URL } from './constants';
import { executeOverpassQuery } from './poi-service/overpass';

interface NominatimResult {
    place_id: number;
    lat: string;
    lon: string;
    display_name: string;
    type: string;
}

const CATEGORY_QUERIES: Record<POICategory, string> = {
    gas: 'gas station',
    food: 'restaurant',
    hotel: 'hotel',
    attraction: 'tourist attraction'
};

/**
 * OSM tag queries for route-corridor search via Overpass
 */
const OVERPASS_CATEGORY_TAGS: Record<Exclude<POICategory, 'attraction'>, string> = {
    gas: '["amenity"="fuel"]',
    food: '["amenity"~"restaurant|fast_food|cafe"]',
    hotel: '["tourism"~"hotel|motel|guest_house"]',
};

/**
 * Search for POIs along a route corridor using Overpass API.
 * Returns map-marker POIs (the simpler POI type) scattered along the route.
 */
export async function searchPOIsAlongRoute(
    routeGeometry: [number, number][],
    category: POICategory
): Promise<POI[]> {
    try {
        // Calculate bounding box from route (safe loop, no spread)
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        for (const [lat, lng] of routeGeometry) {
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
        }

        // Buffer: ~15km corridor on each side
        const buffer = 15 / 111;
        const bbox = `${minLat - buffer},${minLng - buffer},${maxLat + buffer},${maxLng + buffer}`;

        // For attractions, we want OR logic (tourism OR historic), so split into separate union lines
        let lines: string;
        if (category === 'attraction') {
            lines = [
                `      node["tourism"~"attraction|viewpoint|museum"](${bbox});`,
                `      way["tourism"~"attraction|viewpoint|museum"](${bbox});`,
                `      node["historic"~"memorial|monument|castle|ruins"](${bbox});`,
                `      way["historic"~"memorial|monument|castle|ruins"](${bbox});`,
            ].join('\n');
        } else {
            const tag = OVERPASS_CATEGORY_TAGS[category];
            lines = `      node${tag}(${bbox});\n      way${tag}(${bbox});`;
        }

        const query = `
            [out:json][timeout:25][maxsize:2097152];
            (
${lines}
            );
            out center 40;
        `.trim();

        const elements = await executeOverpassQuery(query);

        return elements
            .map((el: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }) => {
                const lat = el.lat || el.center?.lat;
                const lng = el.lon || el.center?.lon;
                if (!lat || !lng) return null;
                const name = el.tags?.name || el.tags?.['name:en'];
                if (!name) return null; // Skip unnamed POIs for map markers
                return {
                    id: `route-${el.type}-${el.id}`,
                    name,
                    lat,
                    lng,
                    category,
                    address: el.tags?.['addr:street'] || undefined,
                };
            })
            .filter(Boolean) as POI[];
    } catch (error) {
        console.error(`Failed to fetch ${category} along route:`, error);
        return [];
    }
}

export async function searchNearbyPOIs(lat: number, lng: number, category: POICategory): Promise<POI[]> {
    try {
        const query = CATEGORY_QUERIES[category];
        // Bounding box roughly +/- 0.1 deg (~10km) around the point
        // viewbox=<x1>,<y1>,<x2>,<y2>  (left,top,right,bottom)
        const offset = 0.05; 
        const viewbox = `${lng-offset},${lat+offset},${lng+offset},${lat-offset}`;
        
        const response = await fetch(
            `${NOMINATIM_BASE_URL}/search?q=${encodeURIComponent(query)}&format=json&limit=10&viewbox=${viewbox}&bounded=1&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'RoadTripPlanner/1.0',
                },
            }
        );
        
        const data: NominatimResult[] = await response.json();
        
        return data.map(item => ({
            id: item.place_id.toString(),
            name: item.display_name.split(',')[0],
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            category: category,
            address: item.display_name
        }));
    } catch (error) {
        console.error(`Failed to fetch POIs for ${category}:`, error);
        return [];
    }
}
