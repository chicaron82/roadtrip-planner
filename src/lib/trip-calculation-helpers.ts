/**
 * Pure helpers extracted from useTripCalculation to keep the calculateTrip
 * callback readable. None of these functions use React hooks.
 */
import type { TripSummary, TripSettings, Vehicle, Location, TripDay, RouteSegment } from '../types';
import { calculateArrivalTimes, calculateHumanFuelCosts } from './calculations';
import { getTankSizeLitres, getWeightedFuelEconomyL100km, estimateGasStops } from './unit-conversions';
import { snapOvernightsToTowns } from './overnight-snapper';

// ── buildRoundTripSegments ─────────────────────────────────────────────────
// Duplicates outbound segments in reverse, recalculates arrival times and
// fuel totals for the full round trip. Mutates tripSummary in place (same
// pattern as the original calculateTrip code it was extracted from).
export function buildRoundTripSegments(
  outboundSegments: RouteSegment[],
  tripSummary: TripSummary,
  settings: TripSettings,
  vehicle: Vehicle,
): { segments: RouteSegment[]; roundTripMidpoint: number } {
  const roundTripMidpoint = outboundSegments.length;

  const returnSegments = [...outboundSegments].reverse().map((seg) => ({
    ...seg,
    from: seg.to,
    to: seg.from,
    departureTime: undefined,
    arrivalTime: undefined,
    stopDuration: undefined,
    stopType: 'drive' as const,
  }));

  const fullRoundTripSegments = [...outboundSegments, ...returnSegments];
  const totalRTMinutes = fullRoundTripSegments.reduce((sum, s) => sum + s.durationMinutes, 0);
  const isRTDayTrip = totalRTMinutes <= settings.maxDriveHours * 60;
  const segments = calculateArrivalTimes(
    fullRoundTripSegments,
    settings.departureDate,
    settings.departureTime,
    roundTripMidpoint,
    isRTDayTrip ? (settings.dayTripDurationHours ?? 0) * 60 : undefined,
  );

  // Recalculate totals from duplicated segments
  tripSummary.totalDistanceKm = segments.reduce((sum, s) => sum + s.distanceKm, 0);
  tripSummary.totalDurationMinutes = segments.reduce((sum, s) => sum + s.durationMinutes, 0);
  tripSummary.totalFuelLitres = segments.reduce((sum, s) => sum + s.fuelNeededLitres, 0);
  const segmentFuelCost = segments.reduce((sum, s) => sum + s.fuelCost, 0);

  const tankSizeLitres = getTankSizeLitres(vehicle, settings.units);
  tripSummary.gasStops = estimateGasStops(tripSummary.totalFuelLitres, tankSizeLitres);

  const fuelEconomy = getWeightedFuelEconomyL100km(vehicle, settings.units);
  const lastSeg = segments[segments.length - 1];
  const averageGasPrice = tripSummary.totalFuelLitres > 0
    ? segmentFuelCost / tripSummary.totalFuelLitres
    : settings.gasPrice;

  const humanFuel = calculateHumanFuelCosts(
    tripSummary.gasStops, tankSizeLitres, averageGasPrice,
    lastSeg?.distanceKm ?? 0, fuelEconomy,
  );
  tripSummary.totalFuelCost = Math.max(segmentFuelCost, humanFuel.totalFuelCost);
  tripSummary.costPerPerson = settings.numTravelers > 0
    ? tripSummary.totalFuelCost / settings.numTravelers
    : tripSummary.totalFuelCost;
  tripSummary.drivingDays = Math.ceil(
    tripSummary.totalDurationMinutes / 60 / settings.maxDriveHours
  );

  // Extend fullGeometry to cover both legs (return follows road in reverse)
  const outboundGeo = tripSummary.fullGeometry ?? [];
  const returnGeo = [...outboundGeo].reverse();
  tripSummary.fullGeometry = [...outboundGeo, ...returnGeo.slice(1)] as [number, number][];

  return { segments, roundTripMidpoint };
}

// ── checkAndSetOvernightPrompt ─────────────────────────────────────────────
// Shows an overnight-stop suggestion if the trip exceeds maxDriveHours and
// the day-splitter hasn't already split it into multiple days.
export function checkAndSetOvernightPrompt(
  tripSummary: TripSummary,
  tripDays: TripDay[],
  settings: TripSettings,
  setSuggestedOvernightStop: (loc: Location | null) => void,
  setShowOvernightPrompt: (v: boolean) => void,
): void {
  const totalHours = tripSummary.totalDurationMinutes / 60;
  const exceedsMaxHours = totalHours > settings.maxDriveHours;

  if (exceedsMaxHours && tripDays.length <= 1) {
    const targetDistance = tripSummary.totalDistanceKm * 0.5;
    let currentDist = 0;
    let overnightLocation: Location | null = null;

    for (const segment of tripSummary.segments) {
      currentDist += segment.distanceKm;
      if (currentDist >= targetDistance) {
        overnightLocation = segment.to;
        break;
      }
    }

    if (overnightLocation) {
      setSuggestedOvernightStop(overnightLocation);
      setShowOvernightPrompt(true);
    }
  } else {
    setShowOvernightPrompt(false);
  }
}

// ── fireAndForgetOvernightSnap ─────────────────────────────────────────────
// Async fire-and-forget: snaps transit-split overnight locations to real OSM
// town centres. Updates summary state once the Overpass query resolves.
export function fireAndForgetOvernightSnap(
  tripDays: TripDay[],
  tripSummary: TripSummary,
  geocodeController: AbortController,
  setLocalSummary: (s: TripSummary) => void,
  onSummaryChange: (s: TripSummary | null) => void,
): void {
  snapOvernightsToTowns(tripDays, geocodeController.signal)
    .then(snapped => {
      if (geocodeController.signal.aborted || snapped.length === 0) return;

      const enriched = tripDays.map(d => ({ ...d }));
      let changed = false;

      for (const snap of snapped) {
        const idx = enriched.findIndex(d => d.dayNumber === snap.dayNumber);
        if (idx < 0) continue;

        const day = enriched[idx];
        const firstFrom = day.segments[0]?.from.name ?? '';
        const clonedSegments = [...day.segments];

        if (clonedSegments.length > 0) {
          const lastSegIdx = clonedSegments.length - 1;
          clonedSegments[lastSegIdx] = {
            ...clonedSegments[lastSegIdx],
            to: {
              ...clonedSegments[lastSegIdx].to,
              lat: snap.lat,
              lng: snap.lng,
              name: snap.name,
            },
          };
        }

        enriched[idx] = {
          ...day,
          route: `${firstFrom} \u2192 ${snap.name}`,
          segments: clonedSegments,
          overnight: {
            ...day.overnight!,
            location: {
              ...day.overnight!.location,
              lat: snap.lat,
              lng: snap.lng,
              name: snap.name,
            },
          },
        };

        // Propagate snapped coords to next day's departure point
        if (idx + 1 < enriched.length) {
          const nextDay = enriched[idx + 1];
          const nextCloned = [...nextDay.segments];
          if (nextCloned.length > 0 && nextCloned[0].from.name === 'Overnight Stop') {
            nextCloned[0] = {
              ...nextCloned[0],
              from: {
                ...nextCloned[0].from,
                lat: snap.lat,
                lng: snap.lng,
                name: snap.name,
              },
            };
            const nextLastTo = nextCloned[nextCloned.length - 1]?.to.name ?? 'Destination';
            enriched[idx + 1] = {
              ...nextDay,
              route: `${snap.name} \u2192 ${nextLastTo}`,
              segments: nextCloned,
            };
          }
        }

        changed = true;
      }

      if (changed) {
        const updatedSummary = { ...tripSummary, days: enriched };
        setLocalSummary(updatedSummary);
        onSummaryChange(updatedSummary);
      }
    })
    .catch(() => {
      // Silently keep geometry-interpolated positions if Overpass is unavailable
    });
}
