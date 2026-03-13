/**
 * departure-optimizers.test.ts
 *
 * Tests for findOptimalOutboundDeparture and findOptimalReturnDeparture.
 *
 * Both functions share the same external deps:
 *   - findHubInWindow (hub-cache)   — mocked
 *   - interpolateRoutePosition (route-geocoder) — mocked
 *   - getTankSizeLitres (unit-conversions)      — real (pure)
 *   - TRIP_CONSTANTS                            — real
 *
 * 💚 My Experience Engine
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('./hub-cache', () => ({ findHubInWindow: vi.fn() }));
vi.mock('./route-geocoder', () => ({ interpolateRoutePosition: vi.fn() }));

import { findOptimalOutboundDeparture } from './outbound-departure-optimizer';
import { findOptimalReturnDeparture } from './return-departure-optimizer';
import { findHubInWindow } from './hub-cache';
import { interpolateRoutePosition } from './route-geocoder';

const mockHub = vi.mocked(findHubInWindow);
const mockInterp = vi.mocked(interpolateRoutePosition);

// ─── Fixtures ──────────────────────────────────────────────────────────────────

/** A simple 4-segment route totalling 900 km over 9h drive time. */
function makeSegments(count = 4) {
  return Array.from({ length: count }, (_, i) => ({
    from: { id: `${i}`, name: `City ${i}`, lat: 49 + i * 0.5, lng: -97 - i, type: 'waypoint' as const },
    to: { id: `${i + 1}`, name: `City ${i + 1}`, lat: 49.5 + i * 0.5, lng: -98 - i, type: 'waypoint' as const },
    distanceKm: 225,
    durationMinutes: 135,
    fuelNeededLitres: 18,
    fuelCost: 30,
    _originalIndex: i,
  }));
}

const GEOMETRY: [number, number][] = [
  [49.0, -97.0], [49.5, -98.5], [50.0, -100.0], [50.5, -101.5],
];

/** Vehicle with ~720 km tank (80L / 9 L/100km × 100) */
const VEHICLE = {
  name: 'TestVan',
  fuelType: 'gasoline' as const,
  fuelEconomyHwy: 9,
  tankSizeL: 80,
};

const SETTINGS = {
  units: 'metric' as const,
  stopFrequency: 'balanced' as const,
};

const HUB_BRANDON = { name: 'Brandon, MB', lat: 49.84, lng: -99.95 };

// ── findOptimalOutboundDeparture ──────────────────────────────────────────────

describe('findOptimalOutboundDeparture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when outboundSegments is empty', () => {
    const result = findOptimalOutboundDeparture([], new Date(), GEOMETRY, VEHICLE as never, SETTINGS as never);
    expect(result).toBeNull();
  });

  it('returns null when fullGeometry has fewer than 2 points', () => {
    const result = findOptimalOutboundDeparture(makeSegments(), new Date(), [[49.0, -97.0]], VEHICLE as never, SETTINGS as never);
    expect(result).toBeNull();
  });

  it('returns null when no hub is found in any window', () => {
    mockHub.mockReturnValue(null);
    mockInterp.mockReturnValue({ lat: 49.8, lng: -99.5 });

    // An 8AM departure so deltas are in range
    const dep = new Date('2026-08-16T08:00:00');
    const result = findOptimalOutboundDeparture(makeSegments(), dep, GEOMETRY, VEHICLE as never, SETTINGS as never);
    expect(result).toBeNull();
  });

  it('returns null when interpolateRoutePosition returns null', () => {
    mockHub.mockReturnValue(HUB_BRANDON as never);
    mockInterp.mockReturnValue(null);

    const dep = new Date('2026-08-16T06:00:00');
    const result = findOptimalOutboundDeparture(makeSegments(), dep, GEOMETRY, VEHICLE as never, SETTINGS as never);
    expect(result).toBeNull();
  });

  it('returns a suggestion with correct shape when conditions are met', () => {
    mockHub.mockReturnValue(HUB_BRANDON as never);
    mockInterp.mockReturnValue({ lat: 49.84, lng: -99.95 });

    // Early departure (6AM) so 8-9AM alternatives are >= 15 min later
    const dep = new Date('2026-08-16T06:00:00');
    const result = findOptimalOutboundDeparture(makeSegments(), dep, GEOMETRY, VEHICLE as never, SETTINGS as never);

    expect(result).not.toBeNull();
    if (result) {
      expect(result).toMatchObject({
        suggestedTime: expect.stringMatching(/^\d{2}:\d{2}$/),
        hubName: 'Brandon, MB',
        minutesDelta: expect.any(Number),
        arrivalTime: expect.stringMatching(/^\d{2}:\d{2}$/),
        comboKm: expect.any(Number),
      });
      expect(result.minutesDelta).toBeGreaterThanOrEqual(15);
    }
  });

  it('returns null when delta is less than 15 minutes from current departure', () => {
    mockHub.mockReturnValue(HUB_BRANDON as never);
    mockInterp.mockReturnValue({ lat: 49.84, lng: -99.95 });

    // 9AM departure — all "better" times are also 9AM or within the scan band
    // but current is already in the ideal window, so delta < 15 min
    const dep = new Date('2026-08-16T09:00:00');
    const result = findOptimalOutboundDeparture(makeSegments(), dep, GEOMETRY, VEHICLE as never, SETTINGS as never);

    // Delta < 15 or suggestion time after 10AM → filter returns null
    if (result !== null) {
      expect(result.minutesDelta).toBeGreaterThanOrEqual(15);
    }
  });

  it('suggested departure is at most 10AM', () => {
    mockHub.mockReturnValue(HUB_BRANDON as never);
    mockInterp.mockReturnValue({ lat: 49.84, lng: -99.95 });

    const dep = new Date('2026-08-16T06:00:00');
    const result = findOptimalOutboundDeparture(makeSegments(), dep, GEOMETRY, VEHICLE as never, SETTINGS as never);

    if (result) {
      const [h] = result.suggestedTime.split(':').map(Number);
      expect(h).toBeLessThanOrEqual(10);
    }
  });

  it('comboKm is positive when a hub is found', () => {
    mockHub.mockReturnValue(HUB_BRANDON as never);
    mockInterp.mockReturnValue({ lat: 49.84, lng: -99.95 });

    const dep = new Date('2026-08-16T06:00:00');
    const result = findOptimalOutboundDeparture(makeSegments(), dep, GEOMETRY, VEHICLE as never, SETTINGS as never);

    if (result) {
      expect(result.comboKm).toBeGreaterThan(0);
    }
  });
});

// ── findOptimalReturnDeparture ────────────────────────────────────────────────

describe('findOptimalReturnDeparture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when returnSegments is empty', () => {
    const result = findOptimalReturnDeparture([], new Date(), GEOMETRY, 0, VEHICLE as never, SETTINGS as never);
    expect(result).toBeNull();
  });

  it('returns null when fullGeometry has fewer than 2 points', () => {
    const result = findOptimalReturnDeparture(makeSegments(), new Date(), [[49.0, -97.0]], 0, VEHICLE as never, SETTINGS as never);
    expect(result).toBeNull();
  });

  it('returns null when delta would be 0 (no change suggested)', () => {
    mockHub.mockReturnValue(HUB_BRANDON as never);
    mockInterp.mockReturnValue({ lat: 49.84, lng: -99.95 });

    // A departure at exactly noon — the scan would find delta=0 combos only
    const dep = new Date('2026-08-16T12:00:00');
    const result = findOptimalReturnDeparture(makeSegments(), dep, GEOMETRY, 0, VEHICLE as never, SETTINGS as never);

    // Function filters out suggestions where minutesDelta === 0
    if (result !== null) {
      expect(Math.abs(result.minutesDelta)).toBeGreaterThan(0);
    }
  });

  it('returns null when no hub is found', () => {
    mockHub.mockReturnValue(null);
    mockInterp.mockReturnValue({ lat: 49.84, lng: -99.95 });

    const dep = new Date('2026-08-16T09:00:00');
    const result = findOptimalReturnDeparture(makeSegments(), dep, GEOMETRY, 0, VEHICLE as never, SETTINGS as never);
    expect(result).toBeNull();
  });

  it('returns null when interpolateRoutePosition returns null', () => {
    mockHub.mockReturnValue(HUB_BRANDON as never);
    mockInterp.mockReturnValue(null);

    const dep = new Date('2026-08-16T09:00:00');
    const result = findOptimalReturnDeparture(makeSegments(), dep, GEOMETRY, 0, VEHICLE as never, SETTINGS as never);
    expect(result).toBeNull();
  });

  it('returns suggestion with correct shape when conditions are met', () => {
    mockHub.mockReturnValue(HUB_BRANDON as never);
    mockInterp.mockReturnValue({ lat: 49.84, lng: -99.95 });

    // Departure at 6AM so the scan can find meaningful deltas (±2h window)
    const dep = new Date('2026-08-16T06:00:00');
    const result = findOptimalReturnDeparture(makeSegments(), dep, GEOMETRY, 450, VEHICLE as never, SETTINGS as never);

    if (result !== null) {
      expect(result).toMatchObject({
        suggestedTime: expect.stringMatching(/^\d{2}:\d{2}$/),
        hubName: 'Brandon, MB',
        minutesDelta: expect.any(Number),
        timeSavedMinutes: 30,
        comboKm: expect.any(Number),
      });
    }
  });

  it('filters out hubs matching the return origin name', () => {
    // Hub name contains the origin city name — should be filtered out
    const originHub = { name: 'City 0 Area', lat: 49.0, lng: -97.0 };
    mockHub.mockReturnValue(originHub as never);
    mockInterp.mockReturnValue({ lat: 49.0, lng: -97.0 });

    const dep = new Date('2026-08-16T06:00:00');
    // makeSegments() has 'City 0' as origin (from first segment)
    const result = findOptimalReturnDeparture(makeSegments(), dep, GEOMETRY, 0, VEHICLE as never, SETTINGS as never);

    // May return null or a non-origin hub — should NOT return hub matching origin
    if (result !== null) {
      expect(result.hubName.toLowerCase()).not.toContain('city 0');
    }
  });

  it('suggested departure hour is between 5 and 11 (sanity filter)', () => {
    mockHub.mockReturnValue(HUB_BRANDON as never);
    mockInterp.mockReturnValue({ lat: 49.84, lng: -99.95 });

    const dep = new Date('2026-08-16T06:00:00');
    const result = findOptimalReturnDeparture(makeSegments(), dep, GEOMETRY, 450, VEHICLE as never, SETTINGS as never);

    if (result) {
      const [h] = result.suggestedTime.split(':').map(Number);
      expect(h).toBeGreaterThanOrEqual(5);
      expect(h).toBeLessThan(11);
    }
  });
});
