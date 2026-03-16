/**
 * useArrivalSnap — Listens for 'mee-stop-arrived' custom events from the
 * journal and re-anchors the ghost car simulation to reality.
 *
 * When the user taps "Arrived" on a journal stop:
 *  1. JournalTimeline dispatches mee-stop-arrived { segmentIndex, toLat, toLng }
 *  2. This hook fires a one-shot GPS check (no continuous tracking needed)
 *  3. If device is within 80km of the stop   → anchorAt silently
 *     If device is far / GPS denied          → anchorAt anyway, show a toast hint
 *
 * The arrival is ALWAYS recorded — GPS is only used to improve simulation
 * accuracy, not to block the user.
 *
 * 💚 My Experience Engine
 */

import { useEffect, useCallback } from 'react';
import type { RouteSegment } from '../types';
import { showToast } from '../lib/toast';

// ── Haversine distance (km) ───────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── GPS → route km projection ─────────────────────────────────────────────

/** Project a GPS point onto a route and return the km driven from origin. */
function gpsToRouteKm(lat: number, lng: number, segments: RouteSegment[]): number {
  let bestKm = 0;
  let bestDist = Infinity;
  let cumKm = 0;

  for (const seg of segments) {
    const cosLat = Math.cos((seg.from.lat * Math.PI) / 180);
    const bx = (seg.to.lng - seg.from.lng) * cosLat;
    const by = seg.to.lat - seg.from.lat;
    const px = (lng - seg.from.lng) * cosLat;
    const py = lat - seg.from.lat;
    const lenSq = bx * bx + by * by;
    const t = lenSq > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / lenSq)) : 0;

    const projLat = seg.from.lat + t * (seg.to.lat - seg.from.lat);
    const projLng = seg.from.lng + t * (seg.to.lng - seg.from.lng);
    const dist = haversineKm(lat, lng, projLat, projLng);

    if (dist < bestDist) {
      bestDist = dist;
      bestKm = cumKm + t * seg.distanceKm;
    }
    cumKm += seg.distanceKm;
  }

  return bestKm;
}

// ── Event type ────────────────────────────────────────────────────────────

export interface StopArrivedDetail {
  segmentIndex: number;
  toName: string;
  toLat: number;
  toLng: number;
}

/** Dispatch from any journal component when the user taps "Arrived". */
export function dispatchStopArrived(detail: StopArrivedDetail) {
  window.dispatchEvent(new CustomEvent<StopArrivedDetail>('mee-stop-arrived', { detail }));
}

export interface CaptureGpsDetail {
  lat: number;
  lng: number;
}

/** Dispatch from quick capture when GPS coords are available — silently nudges the car. */
export function dispatchCaptureGps(detail: CaptureGpsDetail) {
  window.dispatchEvent(new CustomEvent<CaptureGpsDetail>('mee-capture-gps', { detail }));
}

// ── Hook ──────────────────────────────────────────────────────────────────

const GPS_NEAR_KM   = 80;  // Within this radius → silent snap
const GPS_TIMEOUT_MS = 8_000;

/**
 * @param anchorAt    Ghost car re-anchor function (from useGhostCar)
 * @param anchorAtKm  Ghost car km-based re-anchor (from useGhostCar)
 * @param segments    Route segments — used to project quick-capture GPS onto the route
 * @param active      Only listen when a ghost car trip is active
 */
export function useArrivalSnap(
  anchorAt: (waypointIndex: number) => void,
  anchorAtKm: (km: number) => void,
  segments: RouteSegment[],
  active: boolean,
) {
  const handleArrived = useCallback((e: Event) => {
    const { segmentIndex, toName, toLat, toLng } = (e as CustomEvent<StopArrivedDetail>).detail;
    // waypointIndex = segmentIndex + 1 because waypoints[0] is origin
    const waypointIndex = segmentIndex + 1;

    if (!navigator.geolocation) {
      // GPS not available — anchor unconditionally
      anchorAt(waypointIndex);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const distKm = haversineKm(
          pos.coords.latitude, pos.coords.longitude,
          toLat, toLng,
        );
        anchorAt(waypointIndex);
        if (distKm > GPS_NEAR_KM) {
          showToast({ message: `Still ~${Math.round(distKm)} km from ${toName} — trip clock synced to schedule.`, type: 'info' });
        }
      },
      () => {
        // Permission denied or error — anchor based on schedule
        anchorAt(waypointIndex);
      },
      { timeout: GPS_TIMEOUT_MS, maximumAge: 60_000 },
    );
  }, [anchorAt]);

  const handleCaptureGps = useCallback((e: Event) => {
    const { lat, lng } = (e as CustomEvent<CaptureGpsDetail>).detail;
    if (segments.length === 0) return;
    const km = gpsToRouteKm(lat, lng, segments);
    anchorAtKm(km);
  }, [anchorAtKm, segments]);

  useEffect(() => {
    if (!active) return;
    window.addEventListener('mee-stop-arrived', handleArrived);
    window.addEventListener('mee-capture-gps', handleCaptureGps);
    return () => {
      window.removeEventListener('mee-stop-arrived', handleArrived);
      window.removeEventListener('mee-capture-gps', handleCaptureGps);
    };
  }, [active, handleArrived, handleCaptureGps]);
}
