import type { Location, Vehicle, TripSettings } from '../types';

export const serializeStateToURL = (locations: Location[], vehicle: Vehicle, settings: TripSettings) => {
    const params = new URLSearchParams();
    
    // Locations
    const locData = locations.map(l => ({ name: l.name, lat: l.lat, lng: l.lng, type: l.type }));
    params.set('locs', JSON.stringify(locData));

    // Vehicle (only key stats to keep url short-ish, or just stringify all if small)
    params.set('veh', JSON.stringify(vehicle));

    // Settings
    params.set('set', JSON.stringify(settings));

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({ path: newUrl }, '', newUrl);
};

export const parseStateFromURL = (): { locations?: Location[], vehicle?: Vehicle, settings?: TripSettings } | null => {
    const params = new URLSearchParams(window.location.search);
    const locs = params.get('locs');
    const veh = params.get('veh');
    const set = params.get('set');

    if (!locs && !veh && !set) return null;

    try {
        const parsedLocs = locs ? JSON.parse(locs) : undefined;
        // Re-add IDs to locations if likely missing
        const locations = parsedLocs?.map((l: Omit<Location, 'id'>) => ({ ...l, id: crypto.randomUUID() }));

        const vehicle = veh ? JSON.parse(veh) : undefined;
        const settings = set ? JSON.parse(set) : undefined;

        return { locations, vehicle, settings };
    } catch (e) {
        console.error("Failed to parse URL params", e);
        return null;
    }
};
