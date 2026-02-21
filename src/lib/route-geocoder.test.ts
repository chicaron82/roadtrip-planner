import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  interpolateRoutePosition,
  reverseGeocodeTown,
  resolveStopTowns,
} from './route-geocoder';
import type { TimedEvent } from './trip-timeline';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Straight north-south line: (0,0)→(1,0)→(2,0). Each degree lat ≈ 111.195 km */
const STRAIGHT_LINE: number[][] = [[0, 0], [1, 0], [2, 0]];
const DEG_KM = 111.195; // Approx km per degree latitude

const BASE_DATE = new Date('2026-08-01T10:00:00');

/** Minimal TimedEvent for resolveStopTowns */
function makeEvent(id: string, km: number, hint = `~${km} km`): TimedEvent {
  return {
    id,
    type: 'fuel',
    locationHint: hint,
    arrivalTime: BASE_DATE,
    departureTime: BASE_DATE,
    durationMinutes: 15,
    distanceFromOriginKm: km,
    stops: [],
  } as TimedEvent;
}

/** Mock a successful Nominatim response */
function mockNominatimResponse(fields: Record<string, string>) {
  return {
    ok: true,
    json: async () => ({ address: fields }),
  };
}

// ─── interpolateRoutePosition ─────────────────────────────────────────────────

describe('interpolateRoutePosition', () => {
  it('returns null for targetKm <= 0', () => {
    expect(interpolateRoutePosition(STRAIGHT_LINE, 0)).toBeNull();
    expect(interpolateRoutePosition(STRAIGHT_LINE, -5)).toBeNull();
  });

  it('returns null for geometry with fewer than 2 points', () => {
    expect(interpolateRoutePosition([[0, 0]], 50)).toBeNull();
    expect(interpolateRoutePosition([], 50)).toBeNull();
  });

  it('returns start-of-segment point for very small targetKm', () => {
    const result = interpolateRoutePosition(STRAIGHT_LINE, 1);
    expect(result).not.toBeNull();
    // Should be near the start of the first segment
    expect(result!.lat).toBeCloseTo(0, 0);
    expect(result!.lng).toBeCloseTo(0, 0);
  });

  it('interpolates midpoint of first segment correctly', () => {
    const halfDeg = DEG_KM / 2; // ~55.6 km → lat=0.5
    const result = interpolateRoutePosition(STRAIGHT_LINE, halfDeg);
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(0.5, 1);
    expect(result!.lng).toBeCloseTo(0, 3);
  });

  it('reaches second segment for targetKm > first segment length', () => {
    const intoDeg2 = DEG_KM + DEG_KM / 2; // 1.5 degrees ≈ 1.5 × DEG_KM
    const result = interpolateRoutePosition(STRAIGHT_LINE, intoDeg2);
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(1.5, 1);
  });

  it('returns last point when targetKm exceeds total route length', () => {
    const result = interpolateRoutePosition(STRAIGHT_LINE, DEG_KM * 10);
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(2, 3);
    expect(result!.lng).toBeCloseTo(0, 3);
  });

  it('handles a single-hop two-point geometry', () => {
    const twoPoint: number[][] = [[49.9, -97.1], [49.9, -96.0]];
    const result = interpolateRoutePosition(twoPoint, 10);
    expect(result).not.toBeNull();
  });
});

// ─── reverseGeocodeTown ───────────────────────────────────────────────────────

describe('reverseGeocodeTown', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns city name when addr.city is present', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockNominatimResponse({ city: 'Thunder Bay' }) as Response);
    const result = await reverseGeocodeTown(48.38, -89.24);
    expect(result).toBe('Thunder Bay');
  });

  it('falls back to town when city is absent', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockNominatimResponse({ town: 'Dryden' }) as Response);
    const result = await reverseGeocodeTown(49.78, -92.84);
    expect(result).toBe('Dryden');
  });

  it('falls back to village when city/town absent', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockNominatimResponse({ village: 'Upsala' }) as Response);
    const result = await reverseGeocodeTown(49.04, -90.47);
    expect(result).toBe('Upsala');
  });

  it('falls back to hamlet', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockNominatimResponse({ hamlet: 'Raith' }) as Response);
    const result = await reverseGeocodeTown(49.3, -88.9);
    expect(result).toBe('Raith');
  });

  it('strips "Unorganized " prefix from county fallback', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockNominatimResponse({ county: 'Unorganized Kenora District' }) as Response
    );
    const result = await reverseGeocodeTown(50.0, -94.0);
    expect(result).toBe('Kenora');
  });

  it('strips " District" suffix from county fallback', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockNominatimResponse({ county: 'Thunder Bay District' }) as Response
    );
    const result = await reverseGeocodeTown(48.5, -89.0);
    expect(result).toBe('Thunder Bay');
  });

  it('strips " County" suffix from county fallback', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockNominatimResponse({ county: 'Prescott County' }) as Response
    );
    const result = await reverseGeocodeTown(45.5, -75.0);
    expect(result).toBe('Prescott');
  });

  it('prefers direct name over county fallback', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockNominatimResponse({ town: 'Kenora', county: 'Unorganized Kenora District' }) as Response
    );
    const result = await reverseGeocodeTown(49.77, -94.49);
    expect(result).toBe('Kenora');
  });

  it('returns null on HTTP error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    const result = await reverseGeocodeTown(50.0, -90.0);
    expect(result).toBeNull();
  });

  it('returns null when address is missing from response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);
    const result = await reverseGeocodeTown(50.0, -90.0);
    expect(result).toBeNull();
  });

  it('returns null when all addr fields are absent', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockNominatimResponse({}) as Response);
    const result = await reverseGeocodeTown(50.0, -90.0);
    expect(result).toBeNull();
  });

  it('returns null on network error (fetch throws)', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'));
    const result = await reverseGeocodeTown(50.0, -90.0);
    expect(result).toBeNull();
  });

  it('returns null when aborted', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
    const controller = new AbortController();
    controller.abort();
    const result = await reverseGeocodeTown(50.0, -90.0, controller.signal);
    expect(result).toBeNull();
  });
});

// ─── resolveStopTowns ─────────────────────────────────────────────────────────

describe('resolveStopTowns', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns empty Map for geometry with fewer than 2 points', async () => {
    const result = await resolveStopTowns([], [], undefined);
    expect(result.size).toBe(0);
  });

  it('returns empty Map when no events need enrichment', async () => {
    // Events without "~" prefix don't need geocoding
    const events: TimedEvent[] = [
      makeEvent('e1', 100, 'Dryden'), // already a real name
    ];
    const result = await resolveStopTowns(events, STRAIGHT_LINE, undefined);
    expect(result.size).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('skips departure/arrival/drive event types', async () => {
    const events = [
      { ...makeEvent('e1', 100), type: 'departure' as const },
      { ...makeEvent('e2', 200), type: 'arrival' as const },
      { ...makeEvent('e3', 300), type: 'drive' as const },
    ] as TimedEvent[];
    const result = await resolveStopTowns(events, STRAIGHT_LINE, undefined);
    expect(result.size).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('resolves a single stop with a "~" hint to its town', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockNominatimResponse({ town: 'Upsala' }) as Response
    );
    const events = [makeEvent('stop1', DEG_KM * 0.5)];
    const result = await resolveStopTowns(events, STRAIGHT_LINE, undefined);
    expect(result.get('stop1')).toBe('Upsala');
  });

  it('returns empty Map when aborted before any requests', async () => {
    const controller = new AbortController();
    controller.abort();
    const events = [makeEvent('stop1', 50)];
    const result = await resolveStopTowns(events, STRAIGHT_LINE, controller.signal);
    expect(result.size).toBe(0);
  });
});
