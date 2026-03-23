/**
 * useStep3Models.ts — unit tests for Step 3 view-model builder functions.
 *
 * These builders are pure functions (no hooks, no context) that derive
 * view-model shapes from raw domain data. Tests focus on:
 *   - null-guard returns (when required data is absent)
 *   - computed fields (hoursBeforeStop, distanceBeforeStop, totalDays)
 *   - pass-through fidelity (callbacks, enums, optional fields)
 */

import { describe, it, expect, vi } from 'vitest';
import type { TripSummary, Vehicle, Location } from '../../types';
import type { Step3HealthSummary } from '../../lib/trip-summary-slices';
import type { ViewMode } from '../../components/Trip/Journal/JournalModeToggle';
import {
  buildStep3OvernightPromptModel,
  buildStep3HealthModel,
  buildStep3ViewerModel,
  buildStep3CommitModel,
} from './useStep3Models';
import { makeSettings as _makeSettings, makeBudget } from '../../test/fixtures';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LOC: Location = { id: 'tb', name: 'Thunder Bay', lat: 48.381, lng: -89.247, type: 'destination' };

function makeSummary(overrides: Partial<TripSummary> = {}): TripSummary {
  return {
    totalDistanceKm: 700,
    totalDurationMinutes: 600,
    totalFuelLitres: 60,
    totalFuelCost: 120,
    gasStops: 1,
    costPerPerson: 100,
    drivingDays: 1,
    segments: [],
    fullGeometry: [],
    ...overrides,
  };
}

const makeSettings = () => _makeSettings({
  numTravelers: 2, numDrivers: 1,
  budget: makeBudget({ gas: 0, hotel: 0, food: 0, misc: 0, total: 0 }),
  departureDate: '2026-08-16', returnDate: '', arrivalDate: '', arrivalTime: '',
});

const VEHICLE: Vehicle = {
  year: '2022', make: 'Toyota', model: 'Sienna',
  fuelEconomyCity: 10, fuelEconomyHwy: 9, tankSize: 80,
};

// ─── buildStep3OvernightPromptModel ──────────────────────────────────────────

describe('buildStep3OvernightPromptModel', () => {
  const base = {
    showOvernightPrompt: true,
    suggestedOvernightStop: LOC,
    summary: makeSummary(),
    numTravelers: 2,
    arrivalTime: '17:00',
    departureTime: '09:00',
    onAccept: vi.fn(),
    onDecline: vi.fn(),
  };

  it('returns null when showOvernightPrompt is false', () => {
    expect(buildStep3OvernightPromptModel({ ...base, showOvernightPrompt: false })).toBeNull();
  });

  it('returns null when suggestedOvernightStop is null', () => {
    expect(buildStep3OvernightPromptModel({ ...base, suggestedOvernightStop: null })).toBeNull();
  });

  it('returns null when summary is null', () => {
    expect(buildStep3OvernightPromptModel({ ...base, summary: null })).toBeNull();
  });

  it('computes hoursBeforeStop as 50% of total drive hours', () => {
    // 600 min = 10h → 50% = 5h
    const model = buildStep3OvernightPromptModel(base)!;
    expect(model.hoursBeforeStop).toBeCloseTo(5, 5);
  });

  it('computes distanceBeforeStop as 50% of total distance', () => {
    // 700km → 50% = 350km
    const model = buildStep3OvernightPromptModel(base)!;
    expect(model.distanceBeforeStop).toBeCloseTo(350, 5);
  });

  it('passes through suggestedLocation, numTravelers, arrivalTime, departureTime', () => {
    const model = buildStep3OvernightPromptModel(base)!;
    expect(model.suggestedLocation).toBe(LOC);
    expect(model.numTravelers).toBe(2);
    expect(model.arrivalTime).toBe('17:00');
    expect(model.departureTime).toBe('09:00');
  });

  it('passes through onAccept and onDecline callbacks', () => {
    const onAccept  = vi.fn();
    const onDecline = vi.fn();
    const model = buildStep3OvernightPromptModel({ ...base, onAccept, onDecline })!;
    model.onAccept();
    model.onDecline();
    expect(onAccept).toHaveBeenCalledOnce();
    expect(onDecline).toHaveBeenCalledOnce();
  });
});

// ─── buildStep3HealthModel ────────────────────────────────────────────────────

describe('buildStep3HealthModel', () => {
  const base = {
    summary: {} as Step3HealthSummary,
    settings: makeSettings(),
    viewMode: 'plan' as ViewMode,
    tripMode: 'plan' as const,
    activeJournal: null,
    tripConfirmed: false,
    arrivalInfo: null,
    feasibility: null,
    setViewMode: vi.fn(),
  };

  it('returns null when summary is null', () => {
    expect(buildStep3HealthModel({ ...base, summary: null })).toBeNull();
  });

  it('returns a model with all fields when summary is present', () => {
    const model = buildStep3HealthModel(base)!;
    expect(model).not.toBeNull();
    expect(model.summary).toBe(base.summary);
    expect(model.settings).toBe(base.settings);
    expect(model.viewMode).toBe('plan');
    expect(model.tripMode).toBe('plan');
    expect(model.tripConfirmed).toBe(false);
  });

  it('passes through setViewMode callback', () => {
    const setViewMode = vi.fn();
    const model = buildStep3HealthModel({ ...base, setViewMode })!;
    model.setViewMode('journal');
    expect(setViewMode).toHaveBeenCalledWith('journal');
  });

  it('surfaces tripConfirmed=true when passed', () => {
    const model = buildStep3HealthModel({ ...base, tripConfirmed: true })!;
    expect(model.tripConfirmed).toBe(true);
  });
});

// ─── buildStep3ViewerModel ────────────────────────────────────────────────────

describe('buildStep3ViewerModel', () => {
  const base = {
    summary: makeSummary(),
    settings: makeSettings(),
    vehicle: VEHICLE,
    canonicalTimeline: null,
    viewMode: 'plan' as ViewMode,
    activeJournal: null,
    tripMode: 'plan' as const,
    onStartJournal: vi.fn(),
    onUpdateJournal: vi.fn(),
    onUpdateStopType: vi.fn(),
    onUpdateDayNotes: vi.fn(),
    onUpdateDayTitle: vi.fn(),
    onUpdateDayType: vi.fn(),
    onAddDayActivity: vi.fn(),
    onUpdateDayActivity: vi.fn(),
    onRemoveDayActivity: vi.fn(),
    onUpdateOvernight: vi.fn(),
    poiSuggestions: [],
    isLoadingPOIs: false,
    onAddPOI: vi.fn(),
    onDismissPOI: vi.fn(),
  };

  it('returns null when summary is null', () => {
    expect(buildStep3ViewerModel({ ...base, summary: null })).toBeNull();
  });

  it('returns a model with summary when present', () => {
    const model = buildStep3ViewerModel(base)!;
    expect(model.summary).toBe(base.summary);
  });

  it('passes through vehicle and settings', () => {
    const model = buildStep3ViewerModel(base)!;
    expect(model.vehicle).toBe(VEHICLE);
    expect(model.settings).toBe(base.settings);
  });
});

// ─── buildStep3CommitModel ────────────────────────────────────────────────────

describe('buildStep3CommitModel', () => {
  const base = {
    printInput: { days: [{}] } as never,
    viewMode: 'plan' as ViewMode,
    tripConfirmed: false,
    addedStopCount: 0,
    shareUrl: null,
    onConfirmTrip: vi.fn(),
    onUnconfirmTrip: vi.fn(),
    onSetJournalMode: vi.fn(),
    onOpenGoogleMaps: vi.fn(),
    onCopyShareLink: vi.fn(),
    onOpenShareScreen: vi.fn(),
  };

  it('returns null when printInput is undefined', () => {
    expect(buildStep3CommitModel({ ...base, printInput: undefined })).toBeNull();
  });

  it('derives totalDays from printInput.days.length', () => {
    const model = buildStep3CommitModel({
      ...base,
      printInput: { days: [{}, {}, {}] } as never,
    })!;
    expect(model.totalDays).toBe(3);
  });

  it('uses 1 for totalDays when days array is empty', () => {
    const model = buildStep3CommitModel({
      ...base,
      printInput: { days: [] } as never,
    })!;
    expect(model.totalDays).toBe(1);
  });

  it('passes through tripConfirmed, addedStopCount, shareUrl', () => {
    const model = buildStep3CommitModel({ ...base, tripConfirmed: true, addedStopCount: 3, shareUrl: 'https://example.com' })!;
    expect(model.tripConfirmed).toBe(true);
    expect(model.addedStopCount).toBe(3);
    expect(model.shareUrl).toBe('https://example.com');
  });

  it('passes through all action callbacks', () => {
    const onConfirmTrip    = vi.fn();
    const onUnconfirmTrip  = vi.fn();
    const onOpenGoogleMaps = vi.fn();
    const onCopyShareLink  = vi.fn();
    const model = buildStep3CommitModel({ ...base, onConfirmTrip, onUnconfirmTrip, onOpenGoogleMaps, onCopyShareLink })!;
    model.onConfirmTrip();
    model.onUnconfirmTrip();
    model.onOpenGoogleMaps();
    model.onCopyShareLink();
    expect(onConfirmTrip).toHaveBeenCalledOnce();
    expect(onUnconfirmTrip).toHaveBeenCalledOnce();
    expect(onOpenGoogleMaps).toHaveBeenCalledOnce();
    expect(onCopyShareLink).toHaveBeenCalledOnce();
  });
});
