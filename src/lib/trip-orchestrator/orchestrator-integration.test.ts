/**
 * orchestrator-integration.test.ts
 *
 * Integration tests for orchestrateTrip and orchestrateStopUpdate.
 * All external async/complex dependencies are mocked so these tests only
 * verify orchestration logic: error paths, pipeline sequencing, and the
 * shape of the returned result.
 *
 * orchestrator-helpers (assembleCanonicalTimeline, patchDaysFromCanonicalEvents,
 * projectFuelStopsFromSimulation) are also stubbed here — the real implementations
 * are tested separately in trip-orchestrator.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Location, Vehicle, TripSettings, TripSummary, TripDay, CostBreakdown } from '../../types';

// ── Mocks (hoisted) ───────────────────────────────────────────────────────────

vi.mock('../api', () => ({ calculateRoute: vi.fn() }));
vi.mock('../calculations', () => ({
  calculateTripCosts: vi.fn(),
  calculateArrivalTimes: vi.fn(),
}));
vi.mock('../trip-calculation-helpers', () => ({ buildRoundTripSegments: vi.fn() }));
vi.mock('../budget', () => ({
  splitTripByDays: vi.fn(),
  calculateCostBreakdown: vi.fn(),
  getBudgetStatus: vi.fn(),
}));
vi.mock('../stop-suggestions', () => ({
  generateSmartStops: vi.fn(),
  createStopConfig: vi.fn(),
  mergeSuggestedStops: vi.fn(),
}));
vi.mock('../weather', () => ({ fetchWeather: vi.fn() }));
vi.mock('../validate-inputs', () => ({ validateTripInputs: vi.fn() }));
vi.mock('../trip-timeline', () => ({ buildTimedTimeline: vi.fn() }));
vi.mock('../stop-consolidator', () => ({ applyComboOptimization: vi.fn() }));
vi.mock('../route-geocoder', () => ({ enrichSmartStopHubs: vi.fn() }));
vi.mock('./orchestrator-helpers', () => ({
  getRoundTripDayTripStayMinutes: vi.fn().mockReturnValue(0),
  projectFuelStopsFromSimulation: vi.fn().mockReturnValue([]),
  assembleCanonicalTimeline: vi.fn(),
  patchDaysFromCanonicalEvents: vi.fn(),
}));

// Import SUT and mock handles after vi.mock declarations.
import { orchestrateTrip } from './orchestrate-trip';
import { orchestrateStopUpdate as importedStopUpdate } from './orchestrate-stop-update';
import { TripCalculationError } from './orchestrator-types';
import { calculateRoute } from '../api';
import { calculateTripCosts, calculateArrivalTimes } from '../calculations';
import { splitTripByDays, calculateCostBreakdown, getBudgetStatus } from '../budget';
import { generateSmartStops, createStopConfig } from '../stop-suggestions';
import { fetchWeather } from '../weather';
import { validateTripInputs } from '../validate-inputs';
import { buildTimedTimeline } from '../trip-timeline';
import { applyComboOptimization } from '../stop-consolidator';
import { enrichSmartStopHubs } from '../route-geocoder';
import { buildRoundTripSegments } from '../trip-calculation-helpers';
import {
  assembleCanonicalTimeline,
  projectFuelStopsFromSimulation,
  getRoundTripDayTripStayMinutes,
} from './orchestrator-helpers';

// ─── Mock handles ─────────────────────────────────────────────────────────────

const mockCalcRoute = vi.mocked(calculateRoute);
const mockCalcCosts = vi.mocked(calculateTripCosts);
const mockCalcTimes = vi.mocked(calculateArrivalTimes);
const mockSplitDays = vi.mocked(splitTripByDays);
const mockCostBreakdown = vi.mocked(calculateCostBreakdown);
const mockBudgetStatus = vi.mocked(getBudgetStatus);
const mockSmartStops = vi.mocked(generateSmartStops);
const mockCreateConfig = vi.mocked(createStopConfig);
const mockWeather = vi.mocked(fetchWeather);
const mockValidate = vi.mocked(validateTripInputs);
const mockBuildTimeline = vi.mocked(buildTimedTimeline);
const mockComboOpt = vi.mocked(applyComboOptimization);
const mockEnrichHubs = vi.mocked(enrichSmartStopHubs);
const mockBuildRT = vi.mocked(buildRoundTripSegments);
const mockAssemble = vi.mocked(assembleCanonicalTimeline);
const mockProjectFuel = vi.mocked(projectFuelStopsFromSimulation);
const mockRTStay = vi.mocked(getRoundTripDayTripStayMinutes);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LOC_A: Location = { id: 'a', name: 'Winnipeg, MB', lat: 49.9, lng: -97.1, type: 'waypoint' };
const LOC_B: Location = { id: 'b', name: 'Brandon, MB', lat: 49.8, lng: -99.9, type: 'waypoint' };

const SEGMENT = {
  from: LOC_A,
  to: LOC_B,
  distanceKm: 200,
  durationMinutes: 120,
  fuelNeededLitres: 14,
  fuelCost: 24,
  _originalIndex: 0,
};

const ROUTE_DATA = {
  segments: [SEGMENT],
  fullGeometry: [[49.9, -97.1], [49.8, -99.9]] as [number, number][],
};

const COST_BREAKDOWN: CostBreakdown = {
  fuel: 24, accommodation: 0, meals: 0, misc: 0, total: 24, perPerson: 12,
};

const STUB_SUMMARY: Partial<TripSummary> = {
  segments: [SEGMENT] as TripSummary['segments'],
  days: [],
  totalDistanceKm: 200,
  totalDurationMinutes: 120,
  totalFuelCost: 24,
  costPerPerson: 24,
  costBreakdown: COST_BREAKDOWN,
  budgetStatus: 'at',
  budgetRemaining: 976,
};

const STUB_DAY: Partial<TripDay> = {
  dayNumber: 1,
  date: '2026-08-16',
  dateFormatted: 'Sat, Aug 16',
  route: 'Winnipeg, MB → Brandon, MB',
  segments: [SEGMENT] as TripDay['segments'],
  segmentIndices: [0],
  timezoneChanges: [],
  budget: { gasUsed: 0, hotelCost: 0, foodEstimate: 0, miscCost: 0, dayTotal: 0, bankRemaining: 1000 },
  totals: {
    distanceKm: 200,
    driveTimeMinutes: 120,
    stopTimeMinutes: 0,
    departureTime: '2026-08-16T09:00:00.000Z',
    arrivalTime: '2026-08-16T11:00:00.000Z',
  },
};

const STUB_CANONICAL = { events: [], days: [], summary: STUB_SUMMARY, inputs: {} } as never;

const VEHICLE: Vehicle = { year: '2022', make: 'Toyota', model: 'Camry', fuelEconomyCity: 10, fuelEconomyHwy: 8, tankSize: 50 };
const SETTINGS: TripSettings = {
  units: 'metric',
  currency: 'CAD',
  maxDriveHours: 10,
  numTravelers: 2,
  numDrivers: 1,
  budgetMode: 'plan-to-budget',
  budget: { mode: 'plan-to-budget', allocation: 'flexible', profile: 'balanced', weights: { gas: 25, hotel: 35, food: 30, misc: 10 }, gas: 0, hotel: 0, food: 0, misc: 0, total: 1000 },
  departureDate: '2026-08-16',
  departureTime: '09:00',
  returnDate: '',
  arrivalDate: '',
  arrivalTime: '',
} as TripSettings;

// ─── Default mock setup helper ─────────────────────────────────────────────────

function setupHappyPath() {
  mockCalcRoute.mockResolvedValue(ROUTE_DATA as never);
  mockValidate.mockReturnValue([]);
  mockCalcCosts.mockReturnValue({ ...STUB_SUMMARY } as TripSummary);
  mockWeather.mockResolvedValue(null);
  mockCalcTimes.mockReturnValue([SEGMENT] as TripSummary['segments']);
  mockSplitDays.mockReturnValue([STUB_DAY as TripDay]);
  mockCostBreakdown.mockReturnValue(COST_BREAKDOWN);
  mockBudgetStatus.mockReturnValue('at');
  mockCreateConfig.mockReturnValue({} as never);
  mockSmartStops.mockReturnValue([]);
  mockEnrichHubs.mockResolvedValue([]);
  mockBuildTimeline.mockReturnValue([]);
  mockComboOpt.mockReturnValue([]);
  mockAssemble.mockReturnValue(STUB_CANONICAL);
  mockProjectFuel.mockReturnValue([]);
  mockRTStay.mockReturnValue(0);
}

// ─── orchestrateTrip ──────────────────────────────────────────────────────────

describe('orchestrateTrip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it('throws TripCalculationError when calculateRoute returns null', async () => {
    mockCalcRoute.mockResolvedValueOnce(null as never);
    await expect(orchestrateTrip([LOC_A, LOC_B], VEHICLE, SETTINGS))
      .rejects.toThrow(TripCalculationError);
  });

  it('includes user-facing message in route-failure error', async () => {
    mockCalcRoute.mockResolvedValueOnce(null as never);
    await expect(orchestrateTrip([LOC_A, LOC_B], VEHICLE, SETTINGS))
      .rejects.toThrow('Could not calculate route');
  });

  it('throws TripCalculationError when validateTripInputs returns errors', async () => {
    mockValidate.mockReturnValueOnce(['Trip is too long for the given settings.']);
    await expect(orchestrateTrip([LOC_A, LOC_B], VEHICLE, SETTINGS))
      .rejects.toThrow(TripCalculationError);
  });

  it('uses the first validation error as the message', async () => {
    mockValidate.mockReturnValueOnce(['First error', 'Second error']);
    await expect(orchestrateTrip([LOC_A, LOC_B], VEHICLE, SETTINGS))
      .rejects.toThrow('First error');
  });

  it('returns { tripSummary, canonicalTimeline, projectedFuelStops, smartStops } on happy path', async () => {
    const result = await orchestrateTrip([LOC_A, LOC_B], VEHICLE, SETTINGS);
    expect(result).toMatchObject({
      tripSummary: expect.any(Object),
      canonicalTimeline: expect.any(Object),
      projectedFuelStops: expect.any(Array),
      smartStops: expect.any(Array),
    });
  });

  it('does not throw when fetchWeather rejects (weather is non-blocking)', async () => {
    mockWeather.mockRejectedValue(new Error('Weather API timeout'));
    await expect(orchestrateTrip([LOC_A, LOC_B], VEHICLE, SETTINGS)).resolves.toBeDefined();
  });

  it('calls buildRoundTripSegments and sets roundTripMidpoint when isRoundTrip is true', async () => {
    const rtSettings = { ...SETTINGS, isRoundTrip: true };
    mockBuildRT.mockReturnValueOnce({ segments: [SEGMENT] as never, roundTripMidpoint: 1 });
    mockCalcTimes.mockReturnValue([SEGMENT] as TripSummary['segments']);

    const result = await orchestrateTrip([LOC_A, LOC_B], VEHICLE, rtSettings);

    expect(mockBuildRT).toHaveBeenCalledOnce();
    expect(result.roundTripMidpoint).toBe(1);
  });

  it('does not call buildRoundTripSegments for a one-way trip', async () => {
    await orchestrateTrip([LOC_A, LOC_B], VEHICLE, { ...SETTINGS, isRoundTrip: false });
    expect(mockBuildRT).not.toHaveBeenCalled();
  });

  it('sets fullGeometry on tripSummary from routeData', async () => {
    const result = await orchestrateTrip([LOC_A, LOC_B], VEHICLE, SETTINGS);
    expect(result.tripSummary.fullGeometry).toBe(ROUTE_DATA.fullGeometry);
  });

  it('injects an intent fuel stop when a waypoint has intent.fuel', async () => {
    const segWithIntent = {
      ...SEGMENT,
      to: { ...LOC_B, type: 'waypoint' as const, intent: { fuel: true } },
    };
    const summaryWithIntent = {
      ...STUB_SUMMARY,
      segments: [segWithIntent],
    } as TripSummary;
    mockCalcCosts.mockReturnValueOnce(summaryWithIntent);
    mockCalcTimes.mockReturnValueOnce([segWithIntent] as TripSummary['segments']);

    const result = await orchestrateTrip([LOC_A, LOC_B], VEHICLE, SETTINGS);

    // smartStops should contain the intent fuel stop
    const intentFuelStop = result.smartStops.find(s => s.id.startsWith('intent-fuel-'));
    expect(intentFuelStop).toBeDefined();
    expect(intentFuelStop?.type).toBe('fuel');
    expect(intentFuelStop?.priority).toBe('required');
  });
});

// ─── orchestrateStopUpdate ───────────────────────────────────────────────────

describe('orchestrateStopUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCalcTimes.mockReturnValue([SEGMENT] as TripSummary['segments']);
    mockSplitDays.mockReturnValue([STUB_DAY as TripDay]);
    mockCostBreakdown.mockReturnValue(COST_BREAKDOWN);
    mockBudgetStatus.mockReturnValue('at');
    mockCreateConfig.mockReturnValue({} as never);
    mockSmartStops.mockReturnValue([]);
    mockBuildTimeline.mockReturnValue([]);
    mockComboOpt.mockReturnValue([]);
    mockAssemble.mockReturnValue(STUB_CANONICAL);
    mockProjectFuel.mockReturnValue([]);
    mockRTStay.mockReturnValue(0);
  });

  it('returns { updatedSummary, canonicalTimeline, projectedFuelStops }', () => {
    const result = importedStopUpdate(
      STUB_SUMMARY as TripSummary,
      0,
      'overnight',
      SETTINGS,
      VEHICLE,
      [LOC_A, LOC_B],
      undefined,
    );
    expect(result).toMatchObject({
      updatedSummary: expect.any(Object),
      canonicalTimeline: expect.any(Object),
      projectedFuelStops: expect.any(Array),
    });
  });

  it('applies newStopType to the segment at segmentIndex', () => {
    importedStopUpdate(
      STUB_SUMMARY as TripSummary,
      0,
      'overnight',
      SETTINGS,
      VEHICLE,
      [LOC_A, LOC_B],
      undefined,
    );
    // calculateArrivalTimes should receive the updated segment with stopType='overnight'
    const segmentsArg = mockCalcTimes.mock.calls[0][0] as typeof SEGMENT[];
    expect(segmentsArg[0]).toMatchObject({ stopType: 'overnight' });
  });

  it('does not mutate other segments when updating one', () => {
    const seg0 = { ...SEGMENT };
    const seg1 = { ...SEGMENT, _originalIndex: 1 };
    const twoSegSummary = { ...STUB_SUMMARY, segments: [seg0, seg1] } as TripSummary;

    importedStopUpdate(twoSegSummary, 0, 'overnight', SETTINGS, VEHICLE, [LOC_A, LOC_B], undefined);

    const segmentsArg = mockCalcTimes.mock.calls[0][0] as typeof SEGMENT[];
    expect(segmentsArg[0]).toMatchObject({ stopType: 'overnight' });
    expect(segmentsArg[1]).not.toHaveProperty('stopType', 'overnight');
  });

  it('uses original costBreakdown when splitTripByDays returns empty array', () => {
    mockSplitDays.mockReturnValueOnce([]);
    const result = importedStopUpdate(
      STUB_SUMMARY as TripSummary,
      0,
      'fuel',
      SETTINGS,
      VEHICLE,
      [LOC_A, LOC_B],
      undefined,
    );
    expect(result.updatedSummary.costBreakdown).toBe(STUB_SUMMARY.costBreakdown);
  });
});
