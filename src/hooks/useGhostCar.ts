/**
 * useGhostCar — Time-based trip progress simulation.
 *
 * The "ghost car" method: consult Date.now() + the pre-built TimedEvent[]
 * schedule to compute exactly where you *should* be on the route right now.
 *
 * Provides:
 *  - progressPct (0–100 within the current 3-stop display window)
 *  - kmDriven / kmRemaining / eta
 *  - Paginated 3-stop window (slides as car passes waypoints)
 *  - anchorAt(idx) — snap + re-anchor after a real "tap to arrive"
 *  - tripStarted / tripComplete / startsIn
 *
 * Ticks every 30 seconds in the background.
 *
 * 💚 My Experience Engine
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { TripSummary, TripSettings } from '../types';
import type { SuggestedStop } from '../lib/stop-suggestions';
import type { GhostCarInput } from '../lib/canonical-trip';
import { buildTimedTimeline } from '../lib/trip-timeline';
import type { TimedEvent } from '../lib/trip-timeline';

// ── Types ────────────────────────────────────────────────────────────────────

export interface GhostCarState {
  /** 0–100, position within the current 3-stop display window */
  progressPct: number;
  /** Total km driven from origin */
  kmDriven: number;
  /** Km remaining to final destination */
  kmRemaining: number;
  /** Formatted ETA, e.g. "~9:45 PM" or "Arrived" */
  eta: string;
  /** Index of the first stop in the current 3-stop window */
  windowIndex: number;
  /** Exactly 3 stop names visible in the current window, or null if <3 stops */
  windowStops: [string, string, string] | null;
  /** False before departure time */
  tripStarted: boolean;
  /** True after final arrival */
  tripComplete: boolean;
  /** Human-readable countdown before departure, e.g. "Departs in 2h 15m" */
  startsIn: string | null;
}

export interface UseGhostCarResult extends GhostCarState {
  /** Called by journal "tap to arrive" — snaps car to waypoint[idx] and re-anchors simulation */
  anchorAt: (waypointIndex: number) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCountdown(ms: number): string {
  if (ms <= 0) return '';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `Departs in ${h}h ${m > 0 ? `${m}m` : ''}`.trim();
  return `Departs in ${m}m`;
}

function formatETA(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Binary search: last index in sorted array where predicate is true */
export function binarySearchLast<T>(arr: T[], pred: (v: T) => boolean): number {
  let lo = 0, hi = arr.length - 1, result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (pred(arr[mid])) { result = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return result;
}

/** Lerp distanceFromOriginKm at effectiveNow using sorted timedEvents */
export function interpolateKm(events: TimedEvent[], effectiveNowMs: number): number {
  if (events.length === 0) return 0;
  const last = events[events.length - 1];
  if (effectiveNowMs >= last.arrivalTime.getTime()) return last.distanceFromOriginKm;
  const first = events[0];
  if (effectiveNowMs <= first.departureTime.getTime()) return first.distanceFromOriginKm;

  const idx = binarySearchLast(events, e => e.departureTime.getTime() <= effectiveNowMs);
  if (idx < 0 || idx >= events.length - 1) return first.distanceFromOriginKm;

  const from = events[idx];
  const to   = events[idx + 1];
  const span = to.arrivalTime.getTime() - from.departureTime.getTime();
  if (span <= 0) return to.distanceFromOriginKm;
  const t = Math.max(0, Math.min(1, (effectiveNowMs - from.departureTime.getTime()) / span));
  return from.distanceFromOriginKm + t * (to.distanceFromOriginKm - from.distanceFromOriginKm);
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const TICK_MS = 30_000; // 30s tick interval

const IDLE_STATE: GhostCarState = {
  progressPct: 0, kmDriven: 0, kmRemaining: 0, eta: '',
  windowIndex: 0, windowStops: null,
  tripStarted: false, tripComplete: false, startsIn: null,
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGhostCar(
  ghostCarInput: GhostCarInput | null,
  summary: TripSummary | null,
  settings: TripSettings,
  suggestions: SuggestedStop[]
): UseGhostCarResult {
  const [state, setState] = useState<GhostCarState>(IDLE_STATE);
  const timeShiftMsRef = useRef<number>(0); // ms offset applied after anchorAt()

  // ── Build timeline events (memoized; only rebuilds when trip changes) ──
  const { events, waypointNames, waypointKms, totalKm } = useMemo(() => {
    if (!summary || summary.segments.length === 0) {
      return { events: [], waypointNames: [], waypointKms: [], totalKm: 0 };
    }

    const startTime = summary.days?.[0]?.totals?.departureTime
      ? new Date(summary.days[0].totals.departureTime)
      : new Date((settings.departureDate ?? new Date().toISOString().slice(0, 10)) + 'T09:00:00');

    const accepted = suggestions.filter(s => s.accepted);

    const events = ghostCarInput?.events?.length
      ? ghostCarInput.events
      : buildTimedTimeline(
          summary.segments,
          accepted,
          settings,
          summary.roundTripMidpoint,
          undefined,
          summary.days,
          startTime,
        );

    // Waypoint names from segments (origin + each segment's destination)
    const segs = summary.segments;
    const names = [segs[0].from.name, ...segs.map(s => s.to.name)];
    const kms: number[] = [0];
    let cum = 0;
    for (const s of segs) { cum += s.distanceKm; kms.push(cum); }

    return { events, waypointNames: names, waypointKms: kms, totalKm: cum };
  }, [ghostCarInput, summary, settings, suggestions]);

  // ── Compute state from current clock ──
  const computeState = useCallback(() => {
    if (events.length === 0 || waypointNames.length < 2) {
      setState(IDLE_STATE);
      return;
    }

    const nowMs = Date.now() - timeShiftMsRef.current;
    const firstEvent = events[0];
    const lastEvent  = events[events.length - 1];
    const departureMs = firstEvent.departureTime.getTime();
    const arrivalMs   = lastEvent.arrivalTime.getTime();

    // Before departure
    if (nowMs < departureMs) {
      const windowStops = waypointNames.length >= 3
        ? [waypointNames[0], waypointNames[1], waypointNames[2]] as [string, string, string]
        : null;
      setState({
        ...IDLE_STATE,
        windowStops,
        startsIn: formatCountdown(departureMs - nowMs),
        kmRemaining: totalKm,
      });
      return;
    }

    // After arrival
    const tripComplete = nowMs >= arrivalMs + 30 * 60 * 1000;

    const currentKm = interpolateKm(events, nowMs);
    const km = Math.max(0, Math.min(totalKm, currentKm));

    // Which waypoint has the car just passed?
    const passedIdx = binarySearchLast(waypointKms, k => k <= km);
    const p = Math.max(0, passedIdx);

    // Window: show [p-1, p, p+1] clamped so 3 stops always visible
    const maxStart = Math.max(0, waypointNames.length - 3);
    const windowStart = Math.min(Math.max(0, p - 1), maxStart);
    const windowStops: [string, string, string] | null = waypointNames.length >= 3
      ? [waypointNames[windowStart], waypointNames[windowStart + 1], waypointNames[windowStart + 2]]
      : null;

    // progressPct within the visible window
    const wKmStart = waypointKms[windowStart] ?? 0;
    const wKmEnd   = waypointKms[Math.min(windowStart + 2, waypointKms.length - 1)] ?? totalKm;
    const progressPct = wKmEnd > wKmStart
      ? Math.max(0, Math.min(100, ((km - wKmStart) / (wKmEnd - wKmStart)) * 100))
      : tripComplete ? 100 : 0;

    // ETA: shift last event's arrivalTime back by the accumulated anchor drift
    const adjustedArrival = new Date(arrivalMs + timeShiftMsRef.current);
    const eta = tripComplete ? 'Arrived' : `~${formatETA(adjustedArrival)}`;

    setState({
      progressPct,
      kmDriven: Math.round(km),
      kmRemaining: Math.round(Math.max(0, totalKm - km)),
      eta,
      windowIndex: windowStart,
      windowStops,
      tripStarted: true,
      tripComplete,
      startsIn: null,
    });
  }, [events, waypointKms, waypointNames, totalKm]);

  // ── Tick every 30s + immediate compute on data change ──
  useEffect(() => {
    // Avoid synchronous setState in effect body (cascading render warning)
    const initId = setTimeout(computeState, 0);
    if (events.length === 0) {
      return () => clearTimeout(initId);
    }
    const id = setInterval(computeState, TICK_MS);
    return () => {
      clearTimeout(initId);
      clearInterval(id);
    };
  }, [computeState, events.length]);

  // ── anchorAt: snap + re-anchor after "tap to arrive" ──
  const anchorAt = useCallback((waypointIndex: number) => {
    if (events.length === 0) return;
    // Find the event whose distanceFromOriginKm best matches this waypoint's km
    const targetKm = waypointKms[waypointIndex] ?? 0;
    let bestIdx = 0;
    let bestDelta = Infinity;
    for (let i = 0; i < events.length; i++) {
      const d = Math.abs(events[i].distanceFromOriginKm - targetKm);
      if (d < bestDelta) { bestDelta = d; bestIdx = i; }
    }
    const scheduledMs = events[bestIdx].arrivalTime.getTime();
    // timeShift = (real now) - (scheduled time at this waypoint)
    // Applying this makes the simulation think "now" == scheduledMs for km interpolation
    timeShiftMsRef.current = Date.now() - scheduledMs;
    computeState();
  }, [events, waypointKms, computeState]);

  return { ...state, anchorAt };
}
