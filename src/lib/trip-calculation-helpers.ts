/**
 * Pure helpers extracted from useTripCalculation to keep the calculateTrip
 * callback readable. None of these functions use React hooks or setState callbacks.
 *
 * React-adjacent helpers (checkAndSetOvernightPrompt, fireAndForgetOvernightSnap)
 * live in src/hooks/useOvernightSnap.ts.
 */
import type { CanonicalTripTimeline, CanonicalTripDay } from './canonical-trip';
import type { TripSummary, TripSettings, Vehicle, TripDay, RouteSegment } from '../types';
import { calculateArrivalTimes, calculateHumanFuelCosts } from './calculations';
import { getTankSizeLitres, getWeightedFuelEconomyL100km, estimateGasStops } from './unit-conversions';

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
  // A round trip is only a "day trip" if: (a) departure and return are on the same calendar date,
  // AND (b) total driving time fits within maxDriveHours. Without (a), an overnight round trip
  // (e.g. 4h+4h with a hotel night) would falsely inject a destination dwell event and corrupt
  // Day 2's departure time.
  const isSameDayReturn = !settings.returnDate || settings.returnDate === settings.departureDate;
  const isRTDayTrip = isSameDayReturn && totalRTMinutes <= settings.maxDriveHours * 60;
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
  tripSummary.fullGeometry = [...outboundGeo, ...returnGeo.slice(1)];

  return { segments, roundTripMidpoint };
}

function usesSyntheticTransitDeparture(nextDay: TripDay): boolean {
  const firstSegment = nextDay.segments[0];
  if (!firstSegment) return false;

  const fromName = firstSegment.from.name.trim();
  const routeFrom = nextDay.route.split(' → ')[0]?.trim() ?? '';

  return fromName === 'Overnight Stop'
    || fromName.includes('(transit)')
    || fromName.includes(' → ')
    || routeFrom.startsWith('En route from ');
}

export function shouldPropagateSnappedOvernightToNextDay(nextDay: TripDay): boolean {
  return usesSyntheticTransitDeparture(nextDay);
}

function patchRouteArrival(route: string, arrivalName: string): string {
  const parts = route.split(' → ');
  if (parts.length <= 1) return route;
  return `${parts[0]} → ${arrivalName}`;
}

function patchRouteDeparture(route: string, departureName: string): string {
  const parts = route.split(' → ');
  if (parts.length <= 1) return route;
  return `${departureName} → ${parts.slice(1).join(' → ')}`;
}

function patchDayEventsForOvernight(day: CanonicalTripDay, overnightName: string): CanonicalTripDay {
  return {
    ...day,
    events: day.events.map(event =>
      event.type === 'overnight'
        ? { ...event, locationHint: overnightName }
        : event
    ),
  };
}

function patchDayEventsForDeparture(day: CanonicalTripDay, departureName: string): CanonicalTripDay {
  return {
    ...day,
    events: day.events.map(event =>
      event.type === 'departure'
        ? { ...event, locationHint: departureName }
        : event
    ),
  };
}

export function applySnappedOvernightsToCanonicalTimeline(
  canonicalTimeline: CanonicalTripTimeline,
  updatedSummary: TripSummary,
  snapped: Array<{ dayNumber: number; lat: number; lng: number; name: string }>,
): CanonicalTripTimeline {
  const updatedDays = canonicalTimeline.days.map(day => ({
    ...day,
    meta: { ...day.meta },
    events: [...day.events],
  }));

  for (const snap of snapped) {
    const dayIndex = updatedDays.findIndex(day => day.meta.dayNumber === snap.dayNumber);
    if (dayIndex < 0) continue;

    const currentDay = updatedDays[dayIndex];
    updatedDays[dayIndex] = patchDayEventsForOvernight(
      {
        ...currentDay,
        meta: {
          ...currentDay.meta,
          route: patchRouteArrival(currentDay.meta.route, snap.name),
          overnight: currentDay.meta.overnight
            ? {
                ...currentDay.meta.overnight,
                location: {
                  ...currentDay.meta.overnight.location,
                  lat: snap.lat,
                  lng: snap.lng,
                  name: snap.name,
                },
              }
            : currentDay.meta.overnight,
        },
      },
      snap.name,
    );

    const nextDay = updatedDays[dayIndex + 1];
    if (!nextDay || !shouldPropagateSnappedOvernightToNextDay(nextDay.meta)) continue;

    updatedDays[dayIndex + 1] = patchDayEventsForDeparture(
      {
        ...nextDay,
        meta: {
          ...nextDay.meta,
          route: patchRouteDeparture(nextDay.meta.route, snap.name),
          segments: nextDay.meta.segments.length > 0
            ? [
                {
                  ...nextDay.meta.segments[0],
                  from: {
                    ...nextDay.meta.segments[0].from,
                    lat: snap.lat,
                    lng: snap.lng,
                    name: snap.name,
                  },
                },
                ...nextDay.meta.segments.slice(1),
              ]
            : nextDay.meta.segments,
        },
      },
      snap.name,
    );
  }

  return {
    ...canonicalTimeline,
    summary: updatedSummary,
    days: updatedDays,
    events: updatedDays.flatMap(day => day.events),
  };
}
