import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AcceptedItineraryInput } from '../../../lib/canonical-trip';
import type { SuggestedStop } from '../../../lib/stop-suggestions';
import type { ProcessedSegment, TripDay, TripSettings, TripSummary } from '../../../types';
import { ItineraryTimeline } from './ItineraryTimeline';
import { useTimelineData } from './useTimelineData';

vi.mock('./useTimelineData', async () => {
  const actual = await vi.importActual<typeof import('./useTimelineData')>('./useTimelineData');
  return {
    ...actual,
    useTimelineData: vi.fn(),
  };
});

const mockedUseTimelineData = vi.mocked(useTimelineData);

const LOC_A = { id: 'a', name: 'Winnipeg', lat: 49.895, lng: -97.138, type: 'waypoint' as const };
const LOC_B = { id: 'b', name: 'Thunder Bay', lat: 48.382, lng: -89.246, type: 'waypoint' as const };

function makeProcessedSegment(overrides: Partial<ProcessedSegment> = {}): ProcessedSegment {
  return {
    from: LOC_A,
    to: LOC_B,
    distanceKm: 700,
    durationMinutes: 480,
    fuelNeededLitres: 63,
    fuelCost: 97,
    _originalIndex: 0,
    ...overrides,
  };
}

function makeDay(dayNumber: number, date: string, segments: ProcessedSegment[], segmentIndices: number[]): TripDay {
  return {
    dayNumber,
    date,
    dateFormatted: date,
    route: segments.length ? `${segments[0].from.name} -> ${segments[segments.length - 1].to.name}` : 'Free Day',
    segments,
    segmentIndices,
    timezoneChanges: [],
    budget: { gasUsed: 0, hotelCost: 0, foodEstimate: 0, miscCost: 0, dayTotal: 0, bankRemaining: 1000 },
    totals: {
      distanceKm: segments.reduce((sum, segment) => sum + segment.distanceKm, 0),
      driveTimeMinutes: segments.reduce((sum, segment) => sum + segment.durationMinutes, 0),
      stopTimeMinutes: 0,
      departureTime: `${date}T08:00:00.000Z`,
      arrivalTime: `${date}T16:00:00.000Z`,
    },
  };
}

const SUMMARY: TripSummary = {
  totalDistanceKm: 700,
  totalDurationMinutes: 480,
  totalFuelLitres: 63,
  totalFuelCost: 97,
  gasStops: 0,
  costPerPerson: 49,
  drivingDays: 1,
  segments: [makeProcessedSegment()],
  fullGeometry: [],
};

const SETTINGS: TripSettings = {
  units: 'metric',
  currency: 'CAD',
  maxDriveHours: 8,
  numTravelers: 2,
  numDrivers: 1,
  budgetMode: 'open',
  budget: { mode: 'open', allocation: 'flexible', profile: 'balanced', weights: { gas: 25, hotel: 35, food: 25, misc: 15 }, gas: 0, hotel: 0, food: 0, misc: 0, total: 0 },
  departureDate: '2026-08-01',
  departureTime: '08:00',
  returnDate: '2026-08-02',
  arrivalDate: '2026-08-02',
  arrivalTime: '18:00',
  useArrivalTime: false,
  gasPrice: 1.6,
  hotelPricePerNight: 120,
  mealPricePerDay: 50,
  isRoundTrip: false,
  avoidTolls: false,
  avoidBorders: false,
  scenicMode: false,
  routePreference: 'fastest',
  stopFrequency: 'balanced',
  tripPreferences: [],
  targetArrivalHour: 21,
  dayTripDurationHours: 0,
};

const RAW_DAYS = [makeDay(1, '2026-08-01', [makeProcessedSegment()], [0])];
const ACCEPTED_DAYS = [
  makeDay(1, '2026-08-01', [makeProcessedSegment()], [0]),
  makeDay(2, '2026-08-02', [], []),
];

const PENDING_STOP: SuggestedStop = {
  id: 'stop-1',
  type: 'rest',
  afterSegmentIndex: 0,
  estimatedTime: new Date('2026-08-01T11:00:00.000Z'),
  duration: 15,
  reason: 'Break up the long drive.',
  priority: 'recommended',
  details: {},
  accepted: false,
  dismissed: false,
  dayNumber: 1,
};

function makeAcceptedItinerary(): AcceptedItineraryInput {
  return {
    summary: SUMMARY,
    days: ACCEPTED_DAYS.map(day => ({
      meta: day,
      events: [],
    })),
    events: [
      {
        id: 'evt-1',
        type: 'waypoint',
        arrivalTime: new Date('2026-08-01T16:00:00.000Z'),
        departureTime: new Date('2026-08-01T16:00:00.000Z'),
        durationMinutes: 0,
        distanceFromOriginKm: 700,
        locationHint: 'Thunder Bay',
        stops: [],
        timezone: 'America/Winnipeg',
        flatIndex: 0,
        originalIndex: 0,
        segment: SUMMARY.segments[0],
      },
    ],
  };
}

describe('ItineraryTimeline', () => {
  beforeEach(() => {
    mockedUseTimelineData.mockReset();
  });

  it('uses accepted itinerary days for header counts and wires inline suggestion actions', async () => {
    const handleAccept = vi.fn();
    const handleDismiss = vi.fn();

    mockedUseTimelineData.mockReturnValue({
      userOverrides: {},
      startTime: new Date('2026-08-01T08:00:00.000Z'),
      originTimezone: 'America/Winnipeg',
      pacingSuggestions: [],
      pacingSuggestionsByDay: new Map(),
      activeSuggestions: [],
      acceptedItinerary: makeAcceptedItinerary(),
      simulationItems: [{
        type: 'stop',
        segment: SUMMARY.segments[0],
        arrivalTime: new Date('2026-08-01T16:00:00.000Z'),
        timezone: 'America/Winnipeg',
        index: 0,
        originalIndex: 0,
      }],
      pendingSuggestions: [PENDING_STOP],
      pendingSuggestionsByDay: new Map([[1, [PENDING_STOP]]]),
      overnightNightsByDay: new Map(),
      driverRotation: null,
      driverBySegment: new Map(),
      dayStartMap: new Map([[0, [{ day: ACCEPTED_DAYS[0], isFirst: true }]]]),
      freeDaysAfterSegment: new Map([[0, [ACCEPTED_DAYS[1]]]]),
      handleAccept,
      handleDismiss,
      editingActivity: null,
      setEditingActivity: vi.fn(),
      editingOvernight: null,
      setEditingOvernight: vi.fn(),
    });

    render(
      <ItineraryTimeline
        summary={SUMMARY}
        settings={SETTINGS}
        days={RAW_DAYS}
      />,
    );

    // TripHeaderSummary now renders totalDays and the unit as separate spans.
    // Verify the trip-length section label and the driving breakdown sub-label.
    expect(screen.getByText('Trip Length')).toBeInTheDocument();
    expect(screen.getByText(/1 driving/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Add this stop'));
    expect(handleAccept).toHaveBeenCalledWith('stop-1', 15);

    fireEvent.click(screen.getByTitle('Dismiss suggestion'));
    expect(handleDismiss).toHaveBeenCalledWith('stop-1');
  });
});