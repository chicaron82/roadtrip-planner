/**
 * useCalculationMessages — Progressive narrative messages during trip calculation.
 *
 * While isCalculating is true, rotates through location-aware messages every 900ms.
 * Returns null when not calculating (caller should fall back to default label).
 *
 * Messages reference actual city names from the route where possible, making
 * the wait feel like MEE is actively working rather than just loading.
 */

import { useState, useEffect, useMemo } from 'react';
import type { Location } from '../types';

const INTERVAL_MS = 900;

function cityName(loc: Location | undefined): string {
  return loc?.name?.split(',')[0]?.trim() ?? '';
}

function buildMessages(locations: Location[], icebreakerOrigin?: boolean): string[] {
  const origin      = locations.find(l => l.type === 'origin');
  const destination = locations.find(l => l.type === 'destination');
  const waypoints   = locations.filter(l => l.type === 'waypoint' && l.name);

  const from = cityName(origin);
  const to   = cityName(destination);
  const hasOvernight = locations.some(l => l.intent?.overnight);

  const msgs: string[] = [];

  if (icebreakerOrigin) {
    // Four-Beat Arc — MEE-forward voice during Beat 4 calculation
    msgs.push(from && to ? `MEE is mapping ${from} to ${to}…` : 'MEE is mapping your route…');
    msgs.push('Finding the real roads…');
    msgs.push('Checking fuel stops and prices…');
    msgs.push(hasOvernight ? 'Placing your overnight stops…' : 'Tuning drive windows and rest stops…');
    msgs.push(to ? `Building your MEE time to ${to}…` : 'Building your trip…');
    msgs.push('Putting it all together…');
  } else {
    // Classic flow
    // Phase 1 — routing
    msgs.push(from && to ? `Routing from ${from} to ${to}…` : 'Mapping your route…');

    // Phase 2 — stops
    if (waypoints.length > 0) {
      const mid = cityName(waypoints[Math.floor(waypoints.length / 2)]);
      msgs.push(mid ? `Mapping your stops through ${mid}…` : 'Mapping your stops…');
    } else {
      msgs.push('Tracing the road ahead…');
    }

    // Phase 3 — fuel
    msgs.push('Checking fuel windows along the route…');

    // Phase 4 — overnight or drive time
    msgs.push(hasOvernight ? 'Planning your overnight stops…' : 'Calculating drive times and rest windows…');

    // Phase 5 — finalizing
    msgs.push(to ? `Assembling your MEE time to ${to}…` : 'Assembling your trip…');

    // Phase 6 — almost done
    msgs.push('Almost ready…');
  }

  return msgs;
}

export function useCalculationMessages(
  isCalculating: boolean,
  locations: Location[],
  icebreakerOrigin?: boolean,
): string | null {
  const messages = useMemo(() => buildMessages(locations, icebreakerOrigin), [locations, icebreakerOrigin]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!isCalculating) {
      setIndex(0);
      return;
    }

    const id = setInterval(() => {
      setIndex(i => Math.min(i + 1, messages.length - 1));
    }, INTERVAL_MS);

    return () => clearInterval(id);
  }, [isCalculating, messages.length]);

  return isCalculating ? messages[index] : null;
}
