import type { POI, POICategory, POISuggestionCategory } from '../types';
import { NOMINATIM_BASE_URL } from './constants';
import { executeOverpassQuery } from './poi-service/overpass';
import { computeRouteBbox } from './poi-service/geo';
import { CATEGORY_TAG_QUERIES } from './poi-service/config';
import type { OverpassElement } from './poi-service/types';

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
 * Maps map-marker POI categories to poi-service suggestion categories.
 * Multiple entries per category are OR'd together in the union query,
 * fixing the previous AND landmine for attractions.
 */
const MARKER_CATEGORY_MAPPING: Record<POICategory, POISuggestionCategory[]> = {
    gas:        ['gas'],
    food:       ['restaurant', 'cafe'],
    hotel:      ['hotel'],
    attraction: ['attraction', 'museum', 'landmark', 'viewpoint'],
};

/**
 * Search for POIs along a route corridor using Overpass API.
 * Returns map-marker POIs (the simpler POI type) scattered along the route.
 * Reuses the shared Overpass client (retries + backoff) and tag mappings
 * from poi-service to avoid duplicated config and rate-limit inconsistencies.
 */
export async function searchPOIsAlongRoute(
    routeGeometry: [number, number][],
    category: POICategory
): Promise<POI[]> {
    try {
        const bbox = computeRouteBbox(routeGeometry, 15);
        const categories = MARKER_CATEGORY_MAPPING[category];

        const lines: string[] = [];
        for (const cat of categories) {
            for (const tag of CATEGORY_TAG_QUERIES[cat]) {
                lines.push(`      node${tag}(${bbox});`);
                lines.push(`      way${tag}(${bbox});`);
            }
        }

        const query = `
            [out:json][timeout:25][maxsize:2097152];
            (
${lines.join('\n')}
            );
            out center 40;
        `.trim();

        const elements = await executeOverpassQuery(query);

        return elements
            .map((el: OverpassElement) => {
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
