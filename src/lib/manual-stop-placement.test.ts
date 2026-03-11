import { describe, expect, it } from 'vitest';
import { deriveManualStopPlacement } from './manual-stop-placement';
import { mergeSuggestedStops } from './stop-suggestions';
import type { RouteSegment } from '../types';
import type { SuggestedStop } from './stop-suggestion-types';

const segments: RouteSegment[] = [
  {
    from: { id: 'a', name: 'Regina', lat: 50, lng: -104, type: 'waypoint' },
    to: { id: 'b', name: 'Thunder Bay', lat: 48.38, lng: -89.25, type: 'waypoint' },
    distanceKm: 1000,
    durationMinutes: 600,
    fuelNeededLitres: 80,
    fuelCost: 100,
  },
];

const fullGeometry = [
  [50, -104],
  [49.5, -100],
  [49, -97],
  [49, -94],
  [48.6, -91],
  [48.38, -89.25],
];

function makeFuelStop(id: string, afterSegmentIndex: number, estimatedTime: string): SuggestedStop {
  return {
    id,
    type: 'fuel',
    reason: id,
    afterSegmentIndex,
    estimatedTime: new Date(estimatedTime),
    duration: 15,
    priority: 'recommended',
    details: {},
    accepted: true,
  };
}

describe('deriveManualStopPlacement', () => {
  it('orders long single-segment manual stops by route progress', () => {
    const brandon = deriveManualStopPlacement({
      lat: 49.85,
      lng: -99.95,
      segments,
      fullGeometry,
      totalDurationMinutes: 600,
      departureDate: '2026-08-01',
      departureTime: '08:00',
      originLng: segments[0].from.lng,
      fallbackSegmentIndex: 0,
    });
    const winnipeg = deriveManualStopPlacement({
      lat: 49.89,
      lng: -97.14,
      segments,
      fullGeometry,
      totalDurationMinutes: 600,
      departureDate: '2026-08-01',
      departureTime: '08:00',
      originLng: segments[0].from.lng,
      fallbackSegmentIndex: 0,
    });
    const dryden = deriveManualStopPlacement({
      lat: 49.78,
      lng: -92.84,
      segments,
      fullGeometry,
      totalDurationMinutes: 600,
      departureDate: '2026-08-01',
      departureTime: '08:00',
      originLng: segments[0].from.lng,
      fallbackSegmentIndex: 0,
    });

    expect(brandon.afterSegmentIndex).toBeLessThan(winnipeg.afterSegmentIndex);
    expect(winnipeg.afterSegmentIndex).toBeLessThan(dryden.afterSegmentIndex);
    expect(brandon.estimatedTime.getTime()).toBeLessThan(winnipeg.estimatedTime.getTime());
    expect(winnipeg.estimatedTime.getTime()).toBeLessThan(dryden.estimatedTime.getTime());
  });
});

describe('mergeSuggestedStops', () => {
  it('collapses nearby auto and manual fuel stops into one plan', () => {
    const merged = mergeSuggestedStops([
      makeFuelStop('auto-fuel', -0.7, '2026-08-01T10:00:00Z'),
      makeFuelStop('manual-fuel', -0.68, '2026-08-01T10:08:00Z'),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].type).toBe('fuel');
  });
});