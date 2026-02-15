import type { POI, POICategory } from '../types';

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

export async function searchNearbyPOIs(lat: number, lng: number, category: POICategory): Promise<POI[]> {
    try {
        const query = CATEGORY_QUERIES[category];
        // Bounding box roughly +/- 0.1 deg (~10km) around the point
        // viewbox=<x1>,<y1>,<x2>,<y2>  (left,top,right,bottom)
        const offset = 0.05; 
        const viewbox = `${lng-offset},${lat+offset},${lng+offset},${lat-offset}`;
        
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=10&viewbox=${viewbox}&bounded=1&addressdetails=1`,
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
