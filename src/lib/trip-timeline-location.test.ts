import { describe, expect, it } from 'vitest';
import type { ProcessedSegment, RouteSegment } from '../types';
import { buildSegmentEndKm, createTimelineLocationResolver } from './trip-timeline-location';

function makeSegment(overrides: Partial<RouteSegment> = {}): RouteSegment {
  return {
    from: { id: 'a', name: 'A', lat: 0, lng: 0, type: 'waypoint' },
    to: { id: 'b', name: 'B', lat: 1, lng: 1, type: 'waypoint' },
    distanceKm: 100,
    durationMinutes: 60,
    fuelNeededLitres: 10,
    fuelCost: 15,
    ...overrides,
  };
}

describe('createTimelineLocationResolver', () => {
  it('does not leak the final destination name into an early transit stop', () => {
    const segments: RouteSegment[] = [
      makeSegment({
        from: { id: 'wdw', name: 'Walt Disney World, Florida', lat: 28.38, lng: -81.56, type: 'waypoint' },
        to: { id: 'dl', name: 'Disneyland, Anaheim', lat: 33.81, lng: -117.92, type: 'waypoint' },
        distanceKm: 3800,
        durationMinutes: 2200,
      }),
    ];
    const iterSegments: ProcessedSegment[] = [
      {
        ...segments[0],
        to: { id: 'dl', name: 'Disneyland, Anaheim', lat: 33.81, lng: -117.92, type: 'waypoint' },
        _originalIndex: 0,
        _transitPart: { index: 0, total: 3 },
        distanceKm: 1300,
        durationMinutes: 747,
      },
    ];

    const resolver = createTimelineLocationResolver(
      'Walt Disney World, Florida',
      segments,
      buildSegmentEndKm(segments),
      iterSegments,
      buildSegmentEndKm(iterSegments),
    );

    const name = resolver.resolveWaypointName({ afterSegmentIndex: 0.01 } as never, 1290);

    expect(name).toBeUndefined();
    expect(resolver.makeLocationHint(1290, name, 'Lake Charles')).toBe('near Lake Charles');
  });

  it('still uses a real intermediate endpoint when it is not the final destination', () => {
    const segments: RouteSegment[] = [
      makeSegment({
        from: { id: 'wdw', name: 'Walt Disney World, Florida', lat: 28.38, lng: -81.56, type: 'waypoint' },
        to: { id: 'dl', name: 'Disneyland, Anaheim', lat: 33.81, lng: -117.92, type: 'waypoint' },
        distanceKm: 3800,
        durationMinutes: 2200,
      }),
    ];
    const iterSegments: ProcessedSegment[] = [
      {
        ...segments[0],
        to: { id: 'lc', name: 'Lake Charles', lat: 30.23, lng: -93.21, type: 'waypoint' },
        _originalIndex: 0,
        _transitPart: { index: 0, total: 3 },
        distanceKm: 1300,
        durationMinutes: 747,
      },
    ];

    const resolver = createTimelineLocationResolver(
      'Walt Disney World, Florida',
      segments,
      buildSegmentEndKm(segments),
      iterSegments,
      buildSegmentEndKm(iterSegments),
    );

    expect(resolver.resolveWaypointName({ afterSegmentIndex: 0.01 } as never, 1290)).toBe('Lake Charles');
  });

  it('does not leak the trip origin into a mid-route stop on a round trip', () => {
    const segments: RouteSegment[] = [
      makeSegment({
        from: { id: 'dl', name: 'Disneyland, Anaheim', lat: 33.81, lng: -117.92, type: 'waypoint' },
        to: { id: 'wdw', name: 'Walt Disney World, Florida', lat: 28.38, lng: -81.56, type: 'waypoint' },
        distanceKm: 4033,
        durationMinutes: 2230,
      }),
      makeSegment({
        from: { id: 'wdw', name: 'Walt Disney World, Florida', lat: 28.38, lng: -81.56, type: 'waypoint' },
        to: { id: 'dl', name: 'Disneyland, Anaheim', lat: 33.81, lng: -117.92, type: 'waypoint' },
        distanceKm: 4033,
        durationMinutes: 2230,
      }),
    ];

    const resolver = createTimelineLocationResolver(
      'Disneyland, Anaheim',
      segments,
      buildSegmentEndKm(segments),
      [] as ProcessedSegment[],
      [],
    );

    expect(resolver.makeLocationHint(4033 - 200, 'Disneyland, Anaheim')).toBe('~3835 km into trip');
  });

  it('does not leak the trip origin into a mid-route stop via hub names either', () => {
    const segments: RouteSegment[] = [
      makeSegment({
        from: { id: 'dl', name: 'Disneyland, Anaheim', lat: 33.81, lng: -117.92, type: 'waypoint' },
        to: { id: 'wdw', name: 'Walt Disney World, Florida', lat: 28.38, lng: -81.56, type: 'waypoint' },
        distanceKm: 4033,
        durationMinutes: 2230,
      }),
      makeSegment({
        from: { id: 'wdw', name: 'Walt Disney World, Florida', lat: 28.38, lng: -81.56, type: 'waypoint' },
        to: { id: 'dl', name: 'Disneyland, Anaheim', lat: 33.81, lng: -117.92, type: 'waypoint' },
        distanceKm: 4033,
        durationMinutes: 2230,
      }),
    ];

    const resolver = createTimelineLocationResolver(
      'Disneyland, Anaheim',
      segments,
      buildSegmentEndKm(segments),
      [] as ProcessedSegment[],
      [],
    );

    expect(resolver.makeLocationHint(4033 - 200, undefined, 'Disneyland, Anaheim')).toBe('~3835 km into trip');
  });

  it('still allows the turnaround destination name when the stop is actually near that boundary', () => {
    const segments: RouteSegment[] = [
      makeSegment({
        from: { id: 'dl', name: 'Disneyland, Anaheim', lat: 33.81, lng: -117.92, type: 'waypoint' },
        to: { id: 'wdw', name: 'Walt Disney World, Florida', lat: 28.38, lng: -81.56, type: 'waypoint' },
        distanceKm: 4033,
        durationMinutes: 2230,
      }),
      makeSegment({
        from: { id: 'wdw', name: 'Walt Disney World, Florida', lat: 28.38, lng: -81.56, type: 'waypoint' },
        to: { id: 'dl', name: 'Disneyland, Anaheim', lat: 33.81, lng: -117.92, type: 'waypoint' },
        distanceKm: 4033,
        durationMinutes: 2230,
      }),
    ];

    const resolver = createTimelineLocationResolver(
      'Disneyland, Anaheim',
      segments,
      buildSegmentEndKm(segments),
      [] as ProcessedSegment[],
      [],
    );

    expect(resolver.makeLocationHint(4033 + 25, undefined, 'Walt Disney World, Florida')).toBe('near Walt Disney World, Florida');
  });
});