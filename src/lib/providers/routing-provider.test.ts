/**
 * routing-provider.test.ts — Unit tests for the routing dispatcher.
 *
 * Covers: Google happy path, avoidBorders forces OSRM, Google failure
 * fallback, no-key OSRM direct path, strategy definitions, strategy
 * filtering (Canada-only, scenic delta), ProviderHttpError status propagation.
 *
 * 💚 My Experience Engine — Routing provider tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RouteSegment } from '../../types';
import { makeProviderHttpError } from './provider-types';

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockGetRoutingProvider = vi.fn(() => 'google' as 'google' | 'osrm');

vi.mock('./provider-config', () => ({
  getActiveRoutingProvider: () => mockGetRoutingProvider(),
  hasGoogleKey: true,
  GOOGLE_MAPS_KEY: 'test-key',
  PROVIDER_URLS: {},
  PROVIDER_CONFIG: { google: { timeoutMs: 10_000 }, osrm: { durationCorrectionFactor: 0.85, timeoutMs: 15_000 } },
  getActiveGeocodingProvider: vi.fn(() => 'google' as const),
  getActivePOIProvider: vi.fn(() => 'google' as const),
}));

const mockOsrmCalculateRoute = vi.fn();
const mockFetchRouteGeometry = vi.fn();
const mockFetchOSRMRoute = vi.fn();

vi.mock('../api-routing', () => ({
  calculateRoute: (locs: unknown, opts: unknown) => mockOsrmCalculateRoute(locs, opts),
  fetchRouteGeometry: (...args: unknown[]) => mockFetchRouteGeometry(...args),
  fetchOSRMRoute: (locs: unknown, opts: unknown) => mockFetchOSRMRoute(locs, opts),
}));

const mockRouteWithGoogle = vi.fn();
vi.mock('./google/google-routing', () => ({
  routeWithGoogle: (locs: unknown, opts: unknown) => mockRouteWithGoogle(locs, opts),
}));

const mockDetectBorderCrossing = vi.fn(() => ({ crossesUS: false, crossingRegions: new Set<string>() }));
vi.mock('../border-avoidance', () => ({
  detectBorderCrossing: (_geo: unknown) => mockDetectBorderCrossing(),
  getGuardWaypoints: vi.fn(() => []),
  insertGuardWaypoints: vi.fn((locs: unknown[]) => locs),
  shouldTryLakeSuperiorCorridor: vi.fn(() => false),
}));

vi.mock('./provider-telemetry', () => ({
  recordProviderEvent: vi.fn(),
}));

import { calculateRoute, fetchAllRouteStrategies } from './routing-provider';
import { recordProviderEvent } from './provider-telemetry';

const mockRecord = vi.mocked(recordProviderEvent);

// ── Fixtures ──────────────────────────────────────────────────────────────

const LOCATIONS = [
  { id: 'a', name: 'Winnipeg', lat: 49.8, lng: -97.1,  type: 'origin'      as const },
  { id: 'b', name: 'Regina',   lat: 50.4, lng: -104.6, type: 'destination' as const },
];

function makeSegment(distanceKm = 580, durationMinutes = 350): RouteSegment {
  return {
    from: LOCATIONS[0],
    to: LOCATIONS[1],
    distanceKm,
    durationMinutes,
    fuelNeededLitres: 0,
    fuelCost: 0,
  };
}

function makeRouteResult(distanceKm = 580, durationMinutes = 350) {
  const seg = makeSegment(distanceKm, durationMinutes);
  return { segments: [seg], fullGeometry: [[49.8, -97.1], [50.4, -104.6]] as [number, number][] };
}

// ── Tests ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // mockReset clears the Once queue — prevents stale values leaking between tests
  mockRouteWithGoogle.mockReset();
  mockOsrmCalculateRoute.mockReset();
  mockGetRoutingProvider.mockReturnValue('google');
  mockDetectBorderCrossing.mockReturnValue({ crossesUS: false, crossingRegions: new Set() });
});

describe('calculateRoute — Google primary path', () => {
  it('returns Google result when available', async () => {
    mockRouteWithGoogle.mockResolvedValue(makeRouteResult());
    const result = await calculateRoute(LOCATIONS);
    expect(result).not.toBeNull();
    expect(result!.segments[0].distanceKm).toBe(580);
    expect(mockOsrmCalculateRoute).not.toHaveBeenCalled();
  });

  it('records Google success telemetry', async () => {
    mockRouteWithGoogle.mockResolvedValue(makeRouteResult());
    await calculateRoute(LOCATIONS);
    expect(mockRecord).toHaveBeenCalledWith('routing', 'google', 'success', expect.any(Number));
  });

  it('falls through to OSRM when Google returns null', async () => {
    mockRouteWithGoogle.mockResolvedValue(null);
    mockOsrmCalculateRoute.mockResolvedValue(makeRouteResult());
    const result = await calculateRoute(LOCATIONS);
    expect(result).not.toBeNull();
    expect(mockOsrmCalculateRoute).toHaveBeenCalled();
  });

  it('falls through to OSRM when Google throws', async () => {
    mockRouteWithGoogle.mockRejectedValue(new Error('network error'));
    mockOsrmCalculateRoute.mockResolvedValue(makeRouteResult());
    const result = await calculateRoute(LOCATIONS);
    expect(result).not.toBeNull();
    expect(mockOsrmCalculateRoute).toHaveBeenCalled();
  });

  it('records failure telemetry with status code for ProviderHttpError', async () => {
    mockRouteWithGoogle.mockRejectedValue(makeProviderHttpError('Routes API 429: Too Many Requests', 429));
    mockOsrmCalculateRoute.mockResolvedValue(makeRouteResult());
    await calculateRoute(LOCATIONS);
    expect(mockRecord).toHaveBeenCalledWith('routing', 'google', 'failure', expect.any(Number), 429);
  });

  it('records failure telemetry without status code for generic errors', async () => {
    mockRouteWithGoogle.mockRejectedValue(new Error('timeout'));
    mockOsrmCalculateRoute.mockResolvedValue(makeRouteResult());
    await calculateRoute(LOCATIONS);
    expect(mockRecord).toHaveBeenCalledWith('routing', 'google', 'failure', expect.any(Number), undefined);
  });
});

describe('calculateRoute — avoidBorders forces OSRM', () => {
  it('skips Google and calls OSRM when avoidBorders=true', async () => {
    mockOsrmCalculateRoute.mockResolvedValue(makeRouteResult());
    await calculateRoute(LOCATIONS, { avoidBorders: true });
    expect(mockRouteWithGoogle).not.toHaveBeenCalled();
    expect(mockOsrmCalculateRoute).toHaveBeenCalledWith(LOCATIONS, expect.objectContaining({ avoidBorders: true }));
  });

  it('still uses OSRM for avoidBorders even with Google key present', async () => {
    mockGetRoutingProvider.mockReturnValue('google');
    mockOsrmCalculateRoute.mockResolvedValue(makeRouteResult());
    const result = await calculateRoute(LOCATIONS, { avoidBorders: true });
    expect(mockRouteWithGoogle).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
  });
});

describe('calculateRoute — no Google key', () => {
  it('calls OSRM directly when provider is osrm', async () => {
    mockGetRoutingProvider.mockReturnValue('osrm');
    mockOsrmCalculateRoute.mockResolvedValue(makeRouteResult());
    const result = await calculateRoute(LOCATIONS);
    expect(mockRouteWithGoogle).not.toHaveBeenCalled();
    expect(mockOsrmCalculateRoute).toHaveBeenCalled();
    expect(result).not.toBeNull();
  });
});

describe('calculateRoute — both providers fail', () => {
  it('returns null when Google and OSRM both fail', async () => {
    mockRouteWithGoogle.mockRejectedValue(new Error('down'));
    mockOsrmCalculateRoute.mockRejectedValue(new Error('down'));
    const result = await calculateRoute(LOCATIONS);
    expect(result).toBeNull();
  });
});

describe('fetchAllRouteStrategies — strategy definitions', () => {
  it('returns fastest strategy', async () => {
    mockRouteWithGoogle.mockResolvedValue(makeRouteResult(580, 350));
    const strategies = await fetchAllRouteStrategies(LOCATIONS, false);
    expect(strategies.some(s => s.id === 'fastest')).toBe(true);
  });

  it('hides Canada-only when fastest does not cross US', async () => {
    mockDetectBorderCrossing.mockReturnValue({ crossesUS: false, crossingRegions: new Set() });
    mockRouteWithGoogle.mockResolvedValue(makeRouteResult(580, 350));
    const strategies = await fetchAllRouteStrategies(LOCATIONS, false);
    expect(strategies.some(s => s.id === 'canada-only')).toBe(false);
  });

  it('shows Canada-only when fastest crosses US', async () => {
    // fastest gets Google, canada-only triggers avoidBorders→OSRM, scenic gets Google
    mockRouteWithGoogle
      .mockResolvedValueOnce(makeRouteResult(580, 350))  // fastest
      .mockResolvedValueOnce(makeRouteResult(620, 380)); // scenic
    mockOsrmCalculateRoute.mockResolvedValue(makeRouteResult(600, 360)); // canada-only

    mockDetectBorderCrossing.mockReturnValue({ crossesUS: true, crossingRegions: new Set(['west']) });

    const strategies = await fetchAllRouteStrategies(LOCATIONS, false);
    expect(strategies.some(s => s.id === 'canada-only')).toBe(true);
  });

  it('hides scenic when distance delta is less than 3%', async () => {
    // Both Google and OSRM return 580km so scenic distance = 580 regardless
    // of which provider answers — delta vs fastest (also 580) = 0% → hidden.
    mockRouteWithGoogle.mockResolvedValue(makeRouteResult(580, 350));
    mockOsrmCalculateRoute.mockResolvedValue(makeRouteResult(580, 350));

    const strategies = await fetchAllRouteStrategies(LOCATIONS, false);
    expect(strategies.some(s => s.id === 'scenic')).toBe(false);
  });

  it('shows scenic when distance delta exceeds 3%', async () => {
    // fastest=580, scenic=650 → delta ~12% > 3% → shown
    // Implementation keyed by scenicMode flag — passes even if call order flips
    // (580 vs 650 gives >3% delta in either direction)
    mockRouteWithGoogle.mockImplementation(
      (_locs: unknown, opts: { scenicMode?: boolean } | undefined) =>
        Promise.resolve(makeRouteResult(opts?.scenicMode ? 650 : 580, 350)),
    );
    mockOsrmCalculateRoute.mockResolvedValue(makeRouteResult(600, 360));

    const strategies = await fetchAllRouteStrategies(LOCATIONS, false);
    expect(strategies.some(s => s.id === 'scenic')).toBe(true);
  });
});
