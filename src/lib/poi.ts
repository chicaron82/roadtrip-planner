import type { POI, POICategory, POISuggestionCategory } from '../types';
import { NOMINATIM_BASE_URL } from './constants';
import { executeOverpassQuery } from './poi-service/overpass';
import { estimateRouteDistanceKm, sampleRouteByKm } from './poi-service/geo';
import { CATEGORY_TAG_QUERIES } from './poi-service/config';
import type { OverpassElement } from './poi-service/types';
import { getActivePOIProvider } from './providers/provider-config';
import { searchNearby, GOOGLE_POI_TYPES } from './providers/google/google-places-nearby';
import { recordProviderEvent } from './providers/provider-telemetry';

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
 * Search for POIs along a route corridor.
 * Primary: Google Nearby Search (if key available)
 * Fallback: Overpass API with corridor sampling
 */
export async function searchPOIsAlongRoute(
    routeGeometry: [number, number][],
    category: POICategory
): Promise<POI[]> {
    const routeKm = estimateRouteDistanceKm(routeGeometry);
    const stepKm = Math.max(30, routeKm / 15);
    const radiusM = Math.round(Math.min(stepKm * 500 + 5000, 20000));
    const samples = sampleRouteByKm(routeGeometry, stepKm, 15);

    const provider = getActivePOIProvider();
    const start = performance.now();

    // ── Google primary ──────────────────────────────────────────────────
    if (provider === 'google') {
        try {
            const googleTypes = MARKER_CATEGORY_MAPPING[category]
                .flatMap(cat => GOOGLE_POI_TYPES[cat] ?? []);
            if (googleTypes.length > 0) {
                const allPlaces = await Promise.all(
                    samples.map(([lat, lng]) => searchNearby(lat, lng, radiusM, googleTypes, 10)),
                );
                const seen = new Set<string>();
                const pois: POI[] = allPlaces.flat()
                    .filter(p => {
                        if (!p.name || seen.has(p.id)) return false;
                        seen.add(p.id);
                        return true;
                    })
                    .map(p => ({
                        id: `route-google-${p.id}`,
                        name: p.name,
                        lat: p.lat,
                        lng: p.lng,
                        category,
                        address: p.address || undefined,
                    }));
                recordProviderEvent('poi', 'google', 'success', performance.now() - start);
                return pois;
            }
        } catch {
            recordProviderEvent('poi', 'google', 'failure', performance.now() - start);
            // fall through to Overpass
        }
    }

    // ── Overpass fallback ────────────────────────────────────────────────
    try {
        const categories = MARKER_CATEGORY_MAPPING[category];
        const lines: string[] = [];
        for (const [lat, lng] of samples) {
            for (const cat of categories) {
                for (const tag of CATEGORY_TAG_QUERIES[cat]) {
                    lines.push(`      node${tag}(around:${radiusM},${lat},${lng});`);
                    lines.push(`      way${tag}(around:${radiusM},${lat},${lng});`);
                }
            }
        }

        const query = `
            [out:json][timeout:30][maxsize:2097152];
            (
${lines.join('\n')}
            );
            out center 40;
        `.trim();

        const elements = await executeOverpassQuery(query);
        recordProviderEvent('poi', 'overpass', 'success', performance.now() - start);

        return elements
            .map((el: OverpassElement) => {
                const lat = el.lat || el.center?.lat;
                const lng = el.lon || el.center?.lon;
                if (!lat || !lng) return null;
                const name = el.tags?.name || el.tags?.['name:en'];
                if (!name) return null;
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
        recordProviderEvent('poi', 'overpass', 'failure', performance.now() - start);
        console.error(`Failed to fetch ${category} along route:`, error);
        return [];
    }
}

export async function searchNearbyPOIs(lat: number, lng: number, category: POICategory): Promise<POI[]> {
    const provider = getActivePOIProvider();

    // ── Google primary ──────────────────────────────────────────────────
    if (provider === 'google') {
        try {
            const googleTypes = MARKER_CATEGORY_MAPPING[category]
                .flatMap(cat => GOOGLE_POI_TYPES[cat] ?? []);
            if (googleTypes.length > 0) {
                const places = await searchNearby(lat, lng, 10_000, googleTypes, 10);
                return places
                    .filter(p => p.name)
                    .map(p => ({
                        id: p.id,
                        name: p.name,
                        lat: p.lat,
                        lng: p.lng,
                        category,
                        address: p.address || undefined,
                    }));
            }
        } catch {
            // fall through to Nominatim
        }
    }

    // ── Nominatim fallback ──────────────────────────────────────────────
    try {
        const query = CATEGORY_QUERIES[category];
        const offset = 0.05; 
        const viewbox = `${lng-offset},${lat+offset},${lng+offset},${lat-offset}`;
        
        const response = await fetch(
            `${NOMINATIM_BASE_URL}/search?q=${encodeURIComponent(query)}&format=json&limit=10&viewbox=${viewbox}&bounded=1&addressdetails=1`
        );
        if (!response.ok) return [];

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
