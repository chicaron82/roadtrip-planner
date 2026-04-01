/**
 * google-routing.ts — Google Routes API adapter.
 *
 * Uses the computeRoutes endpoint (POST, CORS-friendly).
 * Returns accurate durations — no correction factor needed.
 *
 * Auth: X-Goog-Api-Key header.
 *
 * 💚 My Experience Engine — Google routing adapter
 */

import type { Location, RouteSegment } from '../../../types';
import { GOOGLE_MAPS_KEY, PROVIDER_URLS, PROVIDER_CONFIG } from '../provider-config';

/** Fields to request — minimise billing. */
const FIELD_MASK = [
  'routes.legs.duration',
  'routes.legs.distanceMeters',
  'routes.polyline',
].join(',');

interface GoogleLeg {
  duration?: string; // e.g. "3600s"
  distanceMeters?: number;
}

interface GoogleRoute {
  legs?: GoogleLeg[];
  polyline?: { encodedPolyline?: string };
}

interface RoutesResponse {
  routes?: GoogleRoute[];
}

/** Decode Google's encoded polyline into [lat, lng] pairs. */
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

/** Parse "3600s" → 3600 */
function parseDurationSeconds(d?: string): number {
  if (!d) return 0;
  return parseInt(d.replace('s', ''), 10) || 0;
}

function toWaypoint(loc: Location) {
  return {
    location: {
      latLng: { latitude: loc.lat, longitude: loc.lng },
    },
  };
}

export async function routeWithGoogle(
  locations: Location[],
  options?: { avoidTolls?: boolean; avoidBorders?: boolean; scenicMode?: boolean },
): Promise<{ segments: RouteSegment[]; fullGeometry: [number, number][] } | null> {
  const valid = locations.filter(l => l.lat && l.lng && l.lat !== 0 && l.lng !== 0 && l.name);
  if (valid.length < 2) return null;

  const origin = toWaypoint(valid[0]);
  const destination = toWaypoint(valid[valid.length - 1]);
  const intermediates = valid.slice(1, -1).map(toWaypoint);

  const routeModifiers: Record<string, boolean> = {};
  if (options?.avoidTolls) routeModifiers.avoidTolls = true;
  if (options?.scenicMode) routeModifiers.avoidHighways = true;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_CONFIG.google.timeoutMs);

  try {
    const response = await fetch(PROVIDER_URLS.googleRoutes, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        origin,
        destination,
        intermediates: intermediates.length > 0 ? intermediates : undefined,
        travelMode: 'DRIVE',
        polylineQuality: 'HIGH_QUALITY',
        routeModifiers: Object.keys(routeModifiers).length > 0 ? routeModifiers : undefined,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Routes API ${response.status}: ${response.statusText}`);
    }

    const data: RoutesResponse = await response.json();
    const route = data.routes?.[0];
    if (!route?.legs?.length) return null;

    // Decode polyline
    const fullGeometry = route.polyline?.encodedPolyline
      ? decodePolyline(route.polyline.encodedPolyline)
      : [];

    // Map legs to segments
    const segments: RouteSegment[] = route.legs.map((leg, i) => ({
      from: valid[i],
      to: valid[i + 1],
      distanceKm: (leg.distanceMeters ?? 0) / 1000,
      durationMinutes: parseDurationSeconds(leg.duration) / 60,
      fuelNeededLitres: 0, // Calculated downstream
      fuelCost: 0, // Calculated downstream
    }));

    return { segments, fullGeometry };
  } finally {
    clearTimeout(timeoutId);
  }
}
