import type { Location, Vehicle, TripSettings } from '../types';
import { validateSharedTemplate, sanitizeSharedTemplate } from './template-validator';

// ==================== SHARED TEMPLATE TYPES ====================

/** Shape of the JSON template exported via "Share as Template" */
export interface SharedTemplate {
  type: 'roadtrip-template';
  version: string;
  /** Stable identifier for this template — used to build fork lineage. */
  id?: string;
  /** ISO timestamp of when this template was created — used for freshness signal. */
  createdAt?: string;
  /** Ordered list of ancestor template IDs, oldest first.
   *  e.g. ['original-id', 'fork1-id'] means this is a 2nd-generation fork. */
  lineage?: string[];
  author: string;
  trip: {
    title: string;
    description: string;
    tags: string[];
    durationDays: number;
    totalDistanceKm: number;
    totalDurationHours: string;
  };
  budget?: {
    profile: string;
    totalSpent: number;
    perPerson: number;
    breakdown: { fuel: number; accommodation: number; food: number; misc: number };
  };
  route: {
    origin: Location;
    destination: Location;
    waypoints: Location[];
  };
  recommendations?: Array<{
    location?: string;
    lat?: number;
    lng?: number;
    rating?: number;
    notes?: string;
    isHighlight?: boolean;
    highlightReason?: string;
    tips?: string;
  }>;
  settings?: Partial<TripSettings>;
  vehicle?: Vehicle;
}

export interface TemplateImportResult {
  locations: Location[];
  vehicle?: Vehicle;
  settings?: Partial<TripSettings>;
  meta: {
    title: string;
    author: string;
    description: string;
    recommendations: SharedTemplate['recommendations'];
    /** ID of the loaded template — used to build lineage when re-forking. */
    templateId?: string;
    /** Lineage of the loaded template (oldest ancestor first). */
    lineage?: string[];
    /** ISO timestamp from the original export — used for freshness signal. */
    createdAt?: string;
  };
}

/**
 * Build the lineage array for a new template being forked from a parent.
 *
 * Usage when exporting/sharing a trip that was originally imported:
 *   const newLineage = buildTemplateLineage(importResult.meta);
 *   // → [...parent.lineage, parent.id] (oldest ancestor first, parent last)
 */
export function buildTemplateLineage(
  parentMeta: TemplateImportResult['meta']
): string[] {
  const ancestors = parentMeta.lineage ?? [];
  const parentId = parentMeta.templateId;
  return parentId ? [...ancestors, parentId] : [...ancestors];
}


export const serializeStateToURL = (locations: Location[], vehicle: Vehicle, settings: TripSettings) => {
    const params = new URLSearchParams();

    // Locations — strip origin if privacy mode is enabled
    const locData = locations.map((l, i) => {
      if (i === 0 && settings.includeStartingLocation === false) {
        return { name: '', lat: 0, lng: 0, type: l.type };
      }
      return { name: l.name, lat: l.lat, lng: l.lng, type: l.type };
    });
    params.set('locs', JSON.stringify(locData));

    // Vehicle (only key stats to keep url short-ish, or just stringify all if small)
    params.set('veh', JSON.stringify(vehicle));

    // Settings
    params.set('set', JSON.stringify(settings));

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({ path: newUrl }, '', newUrl);
};

// ==================== TEMPLATE IMPORT ====================

/**
 * Parse a shared template JSON file and extract loadable trip data.
 * Returns locations (origin + waypoints + destination), vehicle, and settings.
 * Validates the template structure before importing and sanitizes all strings.
 */
export function parseSharedTemplate(json: string): TemplateImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON: could not parse template file');
  }

  const { valid, errors, warnings } = validateSharedTemplate(raw);

  if (warnings.length > 0) {
    warnings.forEach(w => console.warn('[TemplateImport]', w));
  }

  if (!valid) {
    throw new Error(`Template validation failed: ${errors[0]}`);
  }

  const data = sanitizeSharedTemplate(raw as SharedTemplate);

  // Build ordered location list: origin → waypoints → destination
  const locations: Location[] = [];

  if (data.route.origin) {
    locations.push({
      ...data.route.origin,
      id: data.route.origin.id || crypto.randomUUID(),
      type: 'origin',
    });
  }

  // Add waypoints (skip if same as origin or destination)
  const originName = data.route.origin?.name;
  const destName = data.route.destination?.name;
  for (const wp of data.route.waypoints || []) {
    if (wp.name === originName || wp.name === destName) continue;
    locations.push({
      ...wp,
      id: wp.id || crypto.randomUUID(),
      type: 'waypoint',
    });
  }

  if (data.route.destination) {
    locations.push({
      ...data.route.destination,
      id: data.route.destination.id || crypto.randomUUID(),
      type: 'destination',
    });
  }

  return {
    locations,
    vehicle: data.vehicle,
    settings: data.settings,
    meta: {
      title: data.trip.title,
      author: data.author,
      description: data.trip.description,
      recommendations: data.recommendations,
      templateId: data.id,
      lineage: data.lineage,
      createdAt: data.createdAt,
    },
  };
}

export const parseStateFromURL = (): { locations?: Location[], vehicle?: Vehicle, settings?: TripSettings } | null => {
    const params = new URLSearchParams(window.location.search);
    const locs = params.get('locs');
    const veh = params.get('veh');
    const set = params.get('set');

    if (!locs && !veh && !set) return null;

    try {
        // ── Locations ────────────────────────────────────────────────────────
        let locations: Location[] | undefined;
        if (locs) {
            const parsedLocs = JSON.parse(locs);
            if (Array.isArray(parsedLocs)) {
                const validated = parsedLocs.filter((l: unknown) => {
                    if (!l || typeof l !== 'object') return false;
                    const loc = l as Record<string, unknown>;
                    const lat = loc.lat as number;
                    const lng = loc.lng as number;
                    return (
                        typeof loc.name === 'string' &&
                        typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat) <= 90 &&
                        typeof lng === 'number' && Number.isFinite(lng) && Math.abs(lng) <= 180
                    );
                });
                // Re-add IDs to locations only if missing (preserve existing IDs)
                locations = validated.map((l: Partial<Location>) => ({ ...l, id: l.id || crypto.randomUUID() })) as Location[];
            }
        }

        // ── Vehicle ──────────────────────────────────────────────────────────
        let vehicle: Vehicle | undefined;
        if (veh) {
            const parsedVeh = JSON.parse(veh);
            if (parsedVeh && typeof parsedVeh === 'object') {
                const v = parsedVeh as Record<string, unknown>;
                const city = v.fuelEconomyCity as number;
                const hwy = v.fuelEconomyHwy as number;
                const tank = v.tankSize as number;
                if (
                    Number.isFinite(city) && city > 0 &&
                    Number.isFinite(hwy) && hwy > 0 &&
                    Number.isFinite(tank) && tank > 0
                ) {
                    vehicle = parsedVeh as Vehicle;
                }
            }
        }

        // ── Settings ─────────────────────────────────────────────────────────
        let settings: TripSettings | undefined;
        if (set) {
            const parsedSet = JSON.parse(set);
            if (parsedSet && typeof parsedSet === 'object') {
                const s = parsedSet as Record<string, unknown>;
                // Sanity-check the numeric fields most likely to cause calculation errors
                const numericChecks = ['maxDriveHours', 'numTravelers', 'numDrivers', 'gasPrice'] as const;
                const numericOk = numericChecks.every(k =>
                    s[k] === undefined || (typeof s[k] === 'number' && Number.isFinite(s[k] as number) && (s[k] as number) >= 0)
                );
                if (numericOk) {
                    settings = parsedSet as TripSettings;
                }
            }
        }

        return { locations, vehicle, settings };
    } catch (e) {
        console.error("Failed to parse URL params", e);
        return null;
    }
};
