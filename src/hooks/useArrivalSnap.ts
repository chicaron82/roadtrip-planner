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

// ── Hook ──────────────────────────────────────────────────────────────────

const GPS_NEAR_KM   = 80;  // Within this radius → silent snap
const GPS_TIMEOUT_MS = 8_000;

/**
 * @param anchorAt  Ghost car re-anchor function (from useGhostCar)
 * @param active    Only listen when a ghost car trip is active
 */
export function useArrivalSnap(
  anchorAt: (waypointIndex: number) => void,
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

  useEffect(() => {
    if (!active) return;
    window.addEventListener('mee-stop-arrived', handleArrived);
    return () => window.removeEventListener('mee-stop-arrived', handleArrived);
  }, [active, handleArrived]);
}
