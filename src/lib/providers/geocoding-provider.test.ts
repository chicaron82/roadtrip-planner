/**
 * geocoding-provider.test.ts — Unit tests for the geocoding dispatcher.
 *
 * Covers: Google happy path, fallback to Nominatim, empty query, dedup,
 * ProviderHttpError status propagation, both providers failing.
 *
 * 💚 My Experience Engine — Geocoding provider tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GeocodingResult } from './provider-types';
import { makeProviderHttpError } from './provider-types';

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('./provider-config', () => ({
  getActiveGeocodingProvider: vi.fn(() => 'google' as const),
  hasGoogleKey: true,
  GOOGLE_MAPS_KEY: 'test-key',
  PROVIDER_URLS: { nominatim: 'https://nominatim.example.com' },
  PROVIDER_CONFIG: { google: { timeoutMs: 10_000 }, osrm: { durationCorrectionFactor: 0.85, timeoutMs: 15_000 } },
  getActiveRoutingProvider: vi.fn(() => 'google' as const),
  getActivePOIProvider: vi.fn(() => 'google' as const),
}));

const mockSearchWithNominatim = vi.fn();
vi.mock('../api-geocoding', () => ({
  searchWithNominatim: (q: string) => mockSearchWithNominatim(q),
}));

const mockSearchWithGoogle = vi.fn();
vi.mock('./google/google-geocoding', () => ({
  searchWithGoogle: (q: string) => mockSearchWithGoogle(q),
}));

vi.mock('./provider-telemetry', () => ({
  recordProviderEvent: vi.fn(),
}));

import { searchLocations } from './geocoding-provider';
import { getActiveGeocodingProvider } from './provider-config';
import { recordProviderEvent } from './provider-telemetry';

const mockGetProvider = vi.mocked(getActiveGeocodingProvider);
const mockRecord = vi.mocked(recordProviderEvent);

// ── Fixtures ──────────────────────────────────────────────────────────────

function makeResult(name: string): GeocodingResult {
  return { id: name, name, address: `${name}, MB`, lat: 49.9, lng: -97.1 };
}

const WINNIPEG = makeResult('Winnipeg');
const BRANDON = makeResult('Brandon');

// ── Tests ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetProvider.mockReturnValue('google');
});

describe('searchLocations — empty query', () => {
  it('returns [] immediately for empty string', async () => {
    const result = await searchLocations('');
    expect(result).toEqual([]);
    expect(mockSearchWithGoogle).not.toHaveBeenCalled();
  });

  it('returns [] immediately for whitespace-only string', async () => {
    const result = await searchLocations('   ');
    expect(result).toEqual([]);
    expect(mockSearchWithGoogle).not.toHaveBeenCalled();
  });
});

describe('searchLocations — Google primary path', () => {
  it('returns Google results when available', async () => {
    mockSearchWithGoogle.mockResolvedValue([WINNIPEG, BRANDON]);
    const result = await searchLocations('Winnipeg');
    expect(result).toEqual([WINNIPEG, BRANDON]);
    expect(mockSearchWithNominatim).not.toHaveBeenCalled();
  });

  it('records success telemetry for Google', async () => {
    mockSearchWithGoogle.mockResolvedValue([WINNIPEG]);
    await searchLocations('Winnipeg');
    expect(mockRecord).toHaveBeenCalledWith('geocoding', 'google', 'success', expect.any(Number));
  });

  it('falls through to Nominatim when Google returns empty array', async () => {
    mockSearchWithGoogle.mockResolvedValue([]);
    mockSearchWithNominatim.mockResolvedValue([BRANDON]);
    const result = await searchLocations('Brandon');
    expect(result).toEqual([BRANDON]);
    expect(mockSearchWithNominatim).toHaveBeenCalled();
  });

  it('falls through to Nominatim when Google throws', async () => {
    mockSearchWithGoogle.mockRejectedValue(new Error('network error'));
    mockSearchWithNominatim.mockResolvedValue([BRANDON]);
    const result = await searchLocations('Brandon');
    expect(result).toEqual([BRANDON]);
  });

  it('records failure telemetry with status code for ProviderHttpError', async () => {
    mockSearchWithGoogle.mockRejectedValue(makeProviderHttpError('Places API 429: Too Many Requests', 429));
    mockSearchWithNominatim.mockResolvedValue([]);
    await searchLocations('Winnipeg');
    expect(mockRecord).toHaveBeenCalledWith('geocoding', 'google', 'failure', expect.any(Number), 429);
  });

  it('records failure telemetry without status code for generic errors', async () => {
    mockSearchWithGoogle.mockRejectedValue(new Error('timeout'));
    mockSearchWithNominatim.mockResolvedValue([]);
    await searchLocations('Winnipeg');
    expect(mockRecord).toHaveBeenCalledWith('geocoding', 'google', 'failure', expect.any(Number), undefined);
  });
});

describe('searchLocations — Nominatim fallback', () => {
  it('uses Nominatim directly when no Google key', async () => {
    mockGetProvider.mockReturnValue('nominatim');
    mockSearchWithNominatim.mockResolvedValue([WINNIPEG]);
    const result = await searchLocations('Winnipeg');
    expect(result).toEqual([WINNIPEG]);
    expect(mockSearchWithGoogle).not.toHaveBeenCalled();
  });

  it('records Nominatim success telemetry', async () => {
    mockGetProvider.mockReturnValue('nominatim');
    mockSearchWithNominatim.mockResolvedValue([WINNIPEG]);
    await searchLocations('Winnipeg');
    expect(mockRecord).toHaveBeenCalledWith('geocoding', 'nominatim', 'success', expect.any(Number));
  });

  it('returns [] when Nominatim throws', async () => {
    mockGetProvider.mockReturnValue('nominatim');
    mockSearchWithNominatim.mockRejectedValue(new Error('503'));
    const result = await searchLocations('Anywhere');
    expect(result).toEqual([]);
  });
});

describe('searchLocations — both providers fail', () => {
  it('returns [] when Google and Nominatim both fail', async () => {
    mockSearchWithGoogle.mockRejectedValue(new Error('down'));
    mockSearchWithNominatim.mockRejectedValue(new Error('down'));
    const result = await searchLocations('Anywhere');
    expect(result).toEqual([]);
  });
});

describe('searchLocations — in-flight deduplication', () => {
  it('does not fire two concurrent requests for the same query', async () => {
    let resolve!: (v: GeocodingResult[]) => void;
    const pending = new Promise<GeocodingResult[]>(r => { resolve = r; });
    mockSearchWithGoogle.mockReturnValue(pending);

    // Start both requests before awaiting — then resolve to avoid deadlock
    const p1 = searchLocations('dedup-query');
    const p2 = searchLocations('dedup-query');

    resolve([WINNIPEG]);

    const [a, b] = await Promise.all([p1, p2]);

    // Both calls should resolve to the same result
    expect(a).toEqual(b);
    // Google should only have been called once
    expect(mockSearchWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('allows a new request after a previous one completes', async () => {
    mockSearchWithGoogle
      .mockResolvedValueOnce([WINNIPEG])
      .mockResolvedValueOnce([BRANDON]);

    await searchLocations('sequential-query');
    const result = await searchLocations('sequential-query');

    // Second call fires a fresh request (in-flight entry was removed after first settled)
    expect(mockSearchWithGoogle).toHaveBeenCalledTimes(2);
    expect(result).toEqual([BRANDON]);
  });
});
