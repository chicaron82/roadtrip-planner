import { useMemo } from 'react';
import type { TripSummary, TripSettings, Vehicle, TripMode, Location } from '../types';
import type { TimedEvent } from '../lib/trip-timeline';
import { analyzeFeasibility } from '../lib/feasibility';
import type { FeasibilityResult } from '../lib/feasibility/types';
import { generateEstimate } from '../lib/estimate-service';
import type { TripEstimate } from '../lib/estimate-service';
import { generateTripOverview } from '../lib/trip-analyzer';
import type { Step3ArrivalInfo } from '../components/Steps/step3-types';

interface UseStep3ControllerOptions {
  summary: TripSummary | null;
  settings: TripSettings;
  vehicle: Vehicle;
  tripMode: TripMode;
  precomputedEvents?: TimedEvent[];
  suggestedOvernightStop: Location | null;
}

export interface UseStep3ControllerReturn {
  feasibility: FeasibilityResult | null;
  estimate: TripEstimate | null;
  overview: ReturnType<typeof generateTripOverview> | null;
  arrivalInfo: Step3ArrivalInfo | null;
  overnightTimes: { arrivalTime: string; departureTime: string };
}

/**
 * Step 3 derived-state controller.
 *
 * Houses all business-logic derivations for the Step 3 results view so that
 * Step3Content is a pure layout component (renders what it receives, emits
 * user intents upward) rather than an inline analytics engine.
 *
 * Owns:
 *  - Trip feasibility analysis     (analyzeFeasibility)
 *  - Estimate-mode cost summary     (generateEstimate, only in estimate mode)
 *  - Difficulty / confidence badge  (generateTripOverview)
 *  - Arrival hero info              (destination name + ETA from canonical events)
 *  - Overnight prompt timing        (arrival/departure strings for the overnight prompt)
 */
export function useStep3Controller({
  summary,
  settings,
  vehicle,
  tripMode,
  precomputedEvents,
  suggestedOvernightStop,
}: UseStep3ControllerOptions): UseStep3ControllerReturn {
  const feasibility = useMemo(
    () => (summary ? analyzeFeasibility(summary, settings) : null),
    [summary, settings],
  );

  const estimate = useMemo(() => {
    if (tripMode !== 'estimate' || !summary) return null;
    return generateEstimate(summary, vehicle, settings);
  }, [tripMode, summary, vehicle, settings]);

  const overview = useMemo(
    () => (summary ? generateTripOverview(summary, settings) : null),
    [summary, settings],
  );

  const arrivalInfo = useMemo<Step3ArrivalInfo | null>(() => {
    if (!summary) return null;
    const lastSeg = summary.segments.at(-1);
    const canonicalArrival = precomputedEvents
      ?.filter(event => event.type === 'arrival')
      .at(-1);
    const arrivalTime = canonicalArrival?.arrivalTime
      ?? (lastSeg?.arrivalTime ? new Date(lastSeg.arrivalTime) : null);
    if (!arrivalTime) return null;
    const d = new Date(arrivalTime);
    if (isNaN(d.getTime())) return null;
    const time = d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (settings.isRoundTrip && summary.roundTripMidpoint) {
      const destSeg = summary.segments[summary.roundTripMidpoint - 1];
      return { dest: destSeg?.to.name ?? lastSeg?.to.name ?? 'Destination', time, isRoundTrip: true as const };
    }
    return { dest: lastSeg?.to.name ?? 'Destination', time, isRoundTrip: false as const };
  }, [precomputedEvents, summary, settings]);

  const overnightTimes = useMemo(() => {
    let arrivalTime = '5:00 PM';
    let departureTime = '8:00 AM';

    if (suggestedOvernightStop && summary) {
      const overnightSeg = summary.segments.find(seg => seg.to.name === suggestedOvernightStop.name);
      if (overnightSeg?.arrivalTime) {
        const d = new Date(overnightSeg.arrivalTime);
        if (!isNaN(d.getTime())) {
          arrivalTime = d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
        }
      }
    }

    if (settings.departureTime) {
      const [hStr, mStr] = settings.departureTime.split(':');
      const h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10);
      if (!isNaN(h) && !isNaN(m)) {
        const d = new Date();
        d.setHours(h, m, 0, 0);
        departureTime = d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
      }
    }

    return { arrivalTime, departureTime };
  }, [suggestedOvernightStop, summary, settings.departureTime]);

  return { feasibility, estimate, overview, arrivalInfo, overnightTimes };
}
