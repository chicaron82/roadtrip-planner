import type { RouteSegment, Location } from '../../types';
import { interpolateRoutePosition } from '../route-geocoder';

// ---------------------------------------------------------------------------
// Internal type & helper for long-segment splitting
// ---------------------------------------------------------------------------

/** RouteSegment extended with original-index tracking for split sub-segments. */
export type ProcessedSegment = RouteSegment & {
  /** Index into the original `segments` array this sub-segment was derived from. */
  _originalIndex: number;
  /** Populated when the original segment was split; tracks which part this is. */
  _transitPart?: { index: number; total: number };
};

/**
 * Pre-process the segments array so that any single segment whose
 * `durationMinutes` exceeds `maxDriveMinutes` is split into proportional
 * sub-segments, each fitting within one driving day.
 *
 * The `_originalIndex` field lets downstream code map back to the original
 * segment (important for `roundTripMidpoint` boundary detection).
 */
export function splitLongSegments(
  segments: RouteSegment[],
  maxDriveMinutes: number,
  /**
   * Actual OSRM road polyline for the outbound leg ([lat,lng][]).
   * When provided, split-point coordinates walk along the real road instead
   * of a straight line between the segment endpoints.
   */
  routeGeometry?: [number, number][],
  /**
   * Cumulative km from the route origin at the start of each segment.
   * segKmStarts[i] = sum of distanceKm for segments[0..i-1].
   */
  segKmStarts?: number[],
  /**
   * Total km of the outbound leg (sum of outbound segment distances).
   * Used to mirror return-leg split points onto the outbound geometry.
   */
  outboundTotalKm?: number,
): ProcessedSegment[] {
  const result: ProcessedSegment[] = [];

  for (let origIdx = 0; origIdx < segments.length; origIdx++) {
    const seg = segments[origIdx];

    if (seg.durationMinutes <= maxDriveMinutes) {
      result.push({ ...seg, _originalIndex: origIdx });
      continue;
    }

    const numParts = Math.ceil(seg.durationMinutes / maxDriveMinutes);

    // Distribute drive time evenly across sub-segments instead of filling each
    // part to maxDriveMinutes. Fill-to-max creates heavily imbalanced splits
    // like [8h, 1h] for a 9h segment — the near-empty tail forces a needless
    // extra day. Even distribution (e.g. [4.5h, 4.5h]) lets the stacking loop
    // combine the second half with the next leg, reducing total day count.
    const evenPartMinutes = Math.round(seg.durationMinutes / numParts);

    // Pre-compute split-point locations.
    // If fullGeometry is available we walk the actual road polyline;
    // otherwise we fall back to straight-line interpolation.
    const splitPoints: Location[] = [];
    for (let sp = 0; sp < numParts - 1; sp++) {
      // At this split boundary, what fraction of the segment has elapsed?
      const timeFraction = (evenPartMinutes * (sp + 1)) / seg.durationMinutes;
      // Proportional km into this segment at the split boundary
      const splitKmAlongSeg = timeFraction * seg.distanceKm;

      let lat: number;
      let lng: number;

      if (routeGeometry && segKmStarts && outboundTotalKm !== undefined) {
        const segKmStart = segKmStarts[origIdx] ?? 0;

        // Map this split onto the outbound geometry.
        // For outbound segments: walk forward from the route origin.
        // For return segments: mirror back — the road is the same in reverse.
        let kmOnOutbound: number;
        if (segKmStart < outboundTotalKm) {
          kmOnOutbound = segKmStart + splitKmAlongSeg;
        } else {
          // Return leg — distance from the return origin (destination city)
          const kmFromReturnOrigin = (segKmStart - outboundTotalKm) + splitKmAlongSeg;
          kmOnOutbound = outboundTotalKm - kmFromReturnOrigin;
        }

        const pos = interpolateRoutePosition(
          routeGeometry as number[][],
          Math.max(0, kmOnOutbound),
        );
        if (pos) {
          lat = pos.lat;
          lng = pos.lng;
        } else {
          // Geometry exhausted — fall back to straight-line
          lat = seg.from.lat + timeFraction * (seg.to.lat - seg.from.lat);
          lng = seg.from.lng + timeFraction * (seg.to.lng - seg.from.lng);
        }
      } else {
        // No geometry provided — straight-line interpolation
        lat = seg.from.lat + timeFraction * (seg.to.lat - seg.from.lat);
        lng = seg.from.lng + timeFraction * (seg.to.lng - seg.from.lng);
      }

      const fromCity = seg.from.name.split(',')[0].trim();
      const toCity = seg.to.name.split(',')[0].trim();
      splitPoints.push({
        id: `transit-split-${origIdx}-${sp}`,
        name: `${fromCity} → ${toCity} (transit)`, // replaced by reverse geocoder async
        type: 'waypoint',
        lat,
        lng,
      });
    }

    for (let part = 0; part < numParts; part++) {
      const partMinutes =
        part < numParts - 1
          ? evenPartMinutes
          : seg.durationMinutes - evenPartMinutes * (numParts - 1);
      const ratio = partMinutes / seg.durationMinutes;

      const fromLoc: Location = part === 0 ? seg.from : splitPoints[part - 1];
      const toLoc: Location   = part === numParts - 1 ? seg.to : splitPoints[part];

      result.push({
        ...seg,
        from: fromLoc,
        to: toLoc,
        _originalIndex: origIdx,
        durationMinutes: Math.round(partMinutes),
        distanceKm: Math.round(seg.distanceKm * ratio * 10) / 10,
        fuelCost: Math.round(seg.fuelCost * ratio * 100) / 100,
        fuelNeededLitres: Math.round(seg.fuelNeededLitres * ratio * 100) / 100,
        // Only the first sub-segment inherits the departure time; only the
        // last inherits the arrival time — intermediates have neither.
        departureTime: part === 0 ? seg.departureTime : undefined,
        arrivalTime: part === numParts - 1 ? seg.arrivalTime : undefined,
        _transitPart: { index: part, total: numParts },
      });
    }
  }

  return result;
}
