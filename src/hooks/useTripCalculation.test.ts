/**
 * useTripCalculation — hook integration tests
 *
 * These tests verify state management, error paths, and action callbacks.
 * All external side effects are mocked; only the React state logic is tested.
 *
 * Provider: QueryClientProvider (needed for useQuery inside the hook).
 * Store: Zustand (no provider — globalsingleton, reset between tests).
 *
 * 💚 My Experience Engine
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TripSummary, Vehicle, TripSettings, Location, TripDay } from '../types';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../lib/trip-orchestrator', async () => {
  const { TripCalculationError } = await vi.importActual('../lib/trip-orchestrator') as typeof import('../lib/trip-orchestrator');
  return {
    TripCalculationError,
    orchestrateTrip: vi.fn(),
    orchestrateStopUpdate: vi.fn(),
    orchestrateStrategySwap: vi.fn(),
  };
});
vi.mock('../lib/fuel-stop-snapper', () => ({ snapFuelStopsToStations: vi.fn() }));
vi.mock('./useOvernightSnap', () => ({
  checkAndSetOvernightPrompt: vi.fn(),
  fireAndForgetOvernightPostProcessing: vi.fn(),
}));
vi.mock('../lib/storage', async (importOriginal) => {
  const actual = await importOriginal() as typeof import('../lib/storage');
  return { ...actual, addToHistory: vi.fn() };
});
vi.mock('../lib/url', () => ({ serializeStateToURL: vi.fn() }));
vi.mock('../lib/api', () => ({ fetchAllRouteStrategies: vi.fn() }));
vi.mock('../lib/trip-strategy-selector', () => ({ buildStrategyUpdate: vi.fn() }));

import { useTripCalculation } from './useTripCalculation';
import { orchestrateTrip, orchestrateStopUpdate, orchestrateStrategySwap, TripCalculationError } from '../lib/trip-orchestrator';
import { snapFuelStopsToStations } from '../lib/fuel-stop-snapper';
import { useTripStore } from '../stores/tripStore';

const mockOrchestrate = vi.mocked(orchestrateTrip);
const mockStopUpdate = vi.mocked(orchestrateStopUpdate);
const mockStrategySwap = vi.mocked(orchestrateStrategySwap);
const mockSnap = vi.mocked(snapFuelStopsToStations);

// ─── Test wrapper ─────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LOC_A: Location = { id: 'a', name: 'Winnipeg, MB', lat: 49.9, lng: -97.1, type: 'waypoint' };
const LOC_B: Location = { id: 'b', name: 'Brandon, MB', lat: 49.8, lng: -99.9, type: 'waypoint' };

const VEHICLE: Vehicle = {
  name: 'TestVan',
  fuelType: 'gasoline',
  fuelEconomyHwy: 9,
  tankSizeL: 80,
} as Vehicle;

const SETTINGS: TripSettings = {
  units: 'metric',
  currency: 'CAD',
  maxDriveHours: 10,
  numTravelers: 2,
  numDrivers: 1,
  budgetMode: 'plan-to-budget',
  budget: {
    mode: 'plan-to-budget', allocation: 'flexible', profile: 'balanced',
    weights: { gas: 25, hotel: 35, food: 30, misc: 10 },
    gas: 0, hotel: 0, food: 0, misc: 0, total: 1000,
  },
  departureDate: '2026-08-16',
  departureTime: '09:00',
  returnDate: '',
  arrivalDate: '',
  arrivalTime: '',
} as TripSettings;

const STUB_SUMMARY: Partial<TripSummary> = {
  segments: [],
  days: [
    {
      dayNumber: 1,
      date: '2026-08-16',
      dateFormatted: 'Sat, Aug 16',
      route: 'A → B',
      segments: [],
      segmentIndices: [],
      timezoneChanges: [],
      budget: { gasUsed: 0, hotelCost: 0, foodEstimate: 0, miscCost: 0, dayTotal: 0, bankRemaining: 1000 },
      totals: { distanceKm: 200, driveTimeMinutes: 120, stopTimeMinutes: 0, departureTime: '', arrivalTime: '' },
      notes: '',
    } as TripDay,
  ],
  totalDistanceKm: 200,
  totalDurationMinutes: 120,
  totalFuelCost: 24,
  costPerPerson: 12,
  fuelStops: 0,
  estimatedFuelUsed: 14,
  costBreakdown: { fuel: 24, hotel: 0, food: 0, misc: 0, total: 24, details: { fuel: [], hotel: [], food: [], misc: [] } },
  budgetStatus: 'on-track',
  budgetRemaining: 976,
};

const STUB_CANONICAL = { events: [], days: [], summary: STUB_SUMMARY, inputs: {} } as never;

const ORCHESTRATE_RESULT = {
  tripSummary: STUB_SUMMARY as TripSummary,
  canonicalTimeline: STUB_CANONICAL,
  projectedFuelStops: [],
  smartStops: [],
  roundTripMidpoint: undefined,
};

// ─── Setup ────────────────────────────────────────────────────────────────────

function makeHook(overrides: Partial<Parameters<typeof useTripCalculation>[0]> = {}) {
  return renderHook(
    () => useTripCalculation({ locations: [LOC_A, LOC_B], vehicle: VEHICLE, settings: SETTINGS, ...overrides }),
    { wrapper: createWrapper() },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset Zustand store between tests
  useTripStore.setState({ summary: null, canonicalTimeline: null });
  mockSnap.mockResolvedValue([]);
});

// ─── Initial state ────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('starts not calculating', () => {
    const { result } = makeHook();
    expect(result.current.isCalculating).toBe(false);
  });

  it('starts with no error', () => {
    const { result } = makeHook();
    expect(result.current.error).toBeNull();
  });

  it('starts with no shareUrl', () => {
    const { result } = makeHook();
    expect(result.current.shareUrl).toBeNull();
  });

  it('starts with empty strategicFuelStops', () => {
    const { result } = makeHook();
    expect(result.current.strategicFuelStops).toEqual([]);
  });

  it('starts with activeStrategyIndex 0', () => {
    const { result } = makeHook();
    expect(result.current.activeStrategyIndex).toBe(0);
  });

  it('starts with overnight prompt hidden', () => {
    const { result } = makeHook();
    expect(result.current.showOvernightPrompt).toBe(false);
  });
});

// ─── calculateTrip — happy path ───────────────────────────────────────────────

describe('calculateTrip success', () => {
  it('returns tripSummary from orchestrateTrip', async () => {
    mockOrchestrate.mockResolvedValueOnce(ORCHESTRATE_RESULT);
    const { result } = makeHook();

    const returned = await act(async () => result.current.calculateTrip());

    expect(returned).toBe(STUB_SUMMARY);
  });

  it('sets isCalculating to false after completion', async () => {
    mockOrchestrate.mockResolvedValueOnce(ORCHESTRATE_RESULT);
    const { result } = makeHook();

    await act(async () => { await result.current.calculateTrip(); });

    expect(result.current.isCalculating).toBe(false);
  });

  it('clears error on a new successful calculation', async () => {
    mockOrchestrate
      .mockRejectedValueOnce(new TripCalculationError('Something went wrong'))
      .mockResolvedValueOnce(ORCHESTRATE_RESULT);

    const { result } = makeHook();

    await act(async () => { await result.current.calculateTrip(); });
    expect(result.current.error).toBeTruthy();

    await act(async () => { await result.current.calculateTrip(); });
    expect(result.current.error).toBeNull();
  });

  it('sets strategyInputs after success (enabling route strategy fetch)', async () => {
    mockOrchestrate.mockResolvedValueOnce(ORCHESTRATE_RESULT);
    const { result } = makeHook();

    await act(async () => { await result.current.calculateTrip(); });

    // If strategyInputs was set, routeStrategies query becomes enabled
    // We can verify this indirectly by testing the returned routeStrategies isn't undefined
    expect(Array.isArray(result.current.routeStrategies)).toBe(true);
  });

  it('calls the onCalculationComplete callback after success', async () => {
    mockOrchestrate.mockResolvedValueOnce(ORCHESTRATE_RESULT);
    const onComplete = vi.fn();
    const { result } = makeHook({ onCalculationComplete: onComplete });

    await act(async () => { await result.current.calculateTrip(); });

    expect(onComplete).toHaveBeenCalledOnce();
  });
});

// ─── calculateTrip — error paths ──────────────────────────────────────────────

describe('calculateTrip error handling', () => {
  it('sets error from TripCalculationError message', async () => {
    mockOrchestrate.mockRejectedValueOnce(new TripCalculationError('Could not calculate route.'));
    const { result } = makeHook();

    await act(async () => { await result.current.calculateTrip(); });

    expect(result.current.error).toBe('Could not calculate route.');
  });

  it('sets generic error for unknown exceptions', async () => {
    mockOrchestrate.mockRejectedValueOnce(new Error('Network failure'));
    const { result } = makeHook();

    await act(async () => { await result.current.calculateTrip(); });

    expect(result.current.error).toMatch(/an error occurred/i);
  });

  it('returns null on error', async () => {
    mockOrchestrate.mockRejectedValueOnce(new TripCalculationError('oops'));
    const { result } = makeHook();

    const returned = await act(async () => result.current.calculateTrip());

    expect(returned).toBeNull();
  });

  it('sets isCalculating to false even after an error', async () => {
    mockOrchestrate.mockRejectedValueOnce(new TripCalculationError('oops'));
    const { result } = makeHook();

    await act(async () => { await result.current.calculateTrip(); });

    expect(result.current.isCalculating).toBe(false);
  });
});

// ─── clearError ───────────────────────────────────────────────────────────────

describe('clearError', () => {
  it('clears the error', async () => {
    mockOrchestrate.mockRejectedValueOnce(new TripCalculationError('fail'));
    const { result } = makeHook();

    await act(async () => { await result.current.calculateTrip(); });
    act(() => { result.current.clearError(); });

    expect(result.current.error).toBeNull();
  });
});

// ─── clearTripCalculation ─────────────────────────────────────────────────────

describe('clearTripCalculation', () => {
  it('resets all state to initial values', async () => {
    mockOrchestrate.mockResolvedValueOnce(ORCHESTRATE_RESULT);
    const { result } = makeHook();

    await act(async () => { await result.current.calculateTrip(); });

    act(() => { result.current.clearTripCalculation(); });

    expect(result.current.error).toBeNull();
    expect(result.current.shareUrl).toBeNull();
    expect(result.current.strategicFuelStops).toEqual([]);
    expect(result.current.activeStrategyIndex).toBe(0);
    expect(result.current.showOvernightPrompt).toBe(false);
  });
});

// ─── dismissOvernightPrompt ───────────────────────────────────────────────────

describe('dismissOvernightPrompt', () => {
  it('hides the overnight prompt', () => {
    const { result } = makeHook();

    act(() => { result.current.dismissOvernightPrompt(); });

    expect(result.current.showOvernightPrompt).toBe(false);
  });
});

// ─── updateStopType ───────────────────────────────────────────────────────────

describe('updateStopType', () => {
  it('calls orchestrateStopUpdate with correct segmentIndex and stopType', async () => {
    // First calculate a trip so summaryRef is populated
    mockOrchestrate.mockResolvedValueOnce(ORCHESTRATE_RESULT);
    const stopUpdateResult = {
      updatedSummary: STUB_SUMMARY as TripSummary,
      canonicalTimeline: STUB_CANONICAL,
      projectedFuelStops: [],
    };
    mockStopUpdate.mockReturnValueOnce(stopUpdateResult);

    const { result } = makeHook();
    await act(async () => { await result.current.calculateTrip(); });

    act(() => { result.current.updateStopType(2, 'overnight'); });

    expect(mockStopUpdate).toHaveBeenCalledOnce();
    const callArgs = mockStopUpdate.mock.calls[0];
    expect(callArgs[1]).toBe(2);             // segmentIndex
    expect(callArgs[2]).toBe('overnight');    // newStopType
  });

  it('does nothing when no summary is loaded', () => {
    const { result } = makeHook();

    act(() => { result.current.updateStopType(0, 'overnight'); });

    expect(mockStopUpdate).not.toHaveBeenCalled();
  });
});

// ─── day update utilities ─────────────────────────────────────────────────────

describe('day update utilities', () => {
  it('updateDayNotes patches notes on the correct day', async () => {
    mockOrchestrate.mockResolvedValueOnce(ORCHESTRATE_RESULT);
    const { result } = makeHook();

    await act(async () => { await result.current.calculateTrip(); });
    act(() => { result.current.updateDayNotes(1, 'Great day!'); });

    await waitFor(() => {
      const store = useTripStore.getState();
      expect(store.summary?.days?.[0]?.notes).toBe('Great day!');
    });
  });

  it('updateDayTitle patches title on the correct day', async () => {
    mockOrchestrate.mockResolvedValueOnce(ORCHESTRATE_RESULT);
    const { result } = makeHook();

    await act(async () => { await result.current.calculateTrip(); });
    act(() => { result.current.updateDayTitle(1, 'Day 1: The Adventure'); });

    await waitFor(() => {
      const store = useTripStore.getState();
      expect(store.summary?.days?.[0]?.title).toBe('Day 1: The Adventure');
    });
  });

  it('does nothing when no summary is loaded', () => {
    const { result } = makeHook();

    // Should not throw even with null summary
    expect(() => {
      act(() => { result.current.updateDayNotes(1, 'Note'); });
    }).not.toThrow();
  });
});
