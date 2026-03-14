/**
 * trip-signature-card-model.ts — unit tests
 *
 * Pure functions — no mocks needed.
 * Covers: buildAutoTitle, buildSubtitle, buildTripRead, buildHealthPhrase,
 *         buildSignatureCardModel (integration).
 */

import { describe, it, expect } from 'vitest';
import type { TripSummary, TripSettings } from '../types';
import type { FeasibilityResult } from './feasibility';
import type { SignatureCardInput } from './trip-signature-card-model';
import {
  buildAutoTitle,
  buildSubtitle,
  buildTripRead,
  buildHealthPhrase,
  buildSignatureCardModel,
} from './trip-signature-card-model';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeSummary(overrides: Partial<TripSummary> = {}): TripSummary {
  return {
    totalDistanceKm: 1401,
    totalDurationMinutes: 1001,   // 16h 41m
    totalFuelLitres: 120,
    totalFuelCost: 180,
    gasStops: 1,
    costPerPerson: 450,
    drivingDays: 3,
    segments: [],
    fullGeometry: [],
    ...overrides,
  };
}

function makeSettings(overrides: Partial<TripSettings> = {}): TripSettings {
  return {
    units: 'metric',
    currency: 'CAD',
    maxDriveHours: 10,
    numTravelers: 4,
    numDrivers: 2,
    numRooms: 1,
    budgetMode: 'plan-to-budget',
    budget: {
      mode: 'plan-to-budget', allocation: 'flexible', profile: 'balanced',
      weights: { gas: 25, hotel: 35, food: 30, misc: 10 },
      gas: 0, hotel: 0, food: 0, misc: 0, total: 1000,
    },
    departureDate: '2026-09-12',
    departureTime: '09:00',
    returnDate: '',
    arrivalDate: '',
    arrivalTime: '',
    isRoundTrip: false,
    avoidTolls: false,
    avoidBorders: false,
    scenicMode: false,
    ...overrides,
  } as TripSettings;
}

function makeFeasibility(
  status: FeasibilityResult['status'] = 'on-track',
  warningCategories: string[] = [],
): FeasibilityResult {
  return {
    status,
    warnings: warningCategories.map(category => ({
      category: category as FeasibilityResult['warnings'][number]['category'],
      severity: 'warning' as const,
      message: `${category} warning`,
    })),
    summary: {
      totalBudgetUsed: 800,
      totalBudgetAvailable: 1000,
      budgetUtilization: 0.8,
      longestDriveDay: 480,
      maxDriveLimit: 600,
      perPersonCost: 450,
      totalDays: 3,
    },
  };
}

function makeInput(overrides: Partial<SignatureCardInput> = {}): SignatureCardInput {
  return {
    summary: makeSummary(),
    settings: makeSettings(),
    feasibility: makeFeasibility(),
    originName: 'Winnipeg, MB',
    destinationName: 'Thunder Bay, ON',
    ...overrides,
  };
}

// ─── buildAutoTitle ───────────────────────────────────────────────────────────

describe('buildAutoTitle', () => {
  it('formats "Your MEE time in {city}"', () => {
    expect(buildAutoTitle('Thunder Bay, ON')).toBe('Your MEE time in Thunder Bay');
  });

  it('strips province/state from destination', () => {
    expect(buildAutoTitle('Banff, AB')).toBe('Your MEE time in Banff');
  });

  it('works with city-only (no comma)', () => {
    expect(buildAutoTitle('Fargo')).toBe('Your MEE time in Fargo');
  });

  it('trims whitespace', () => {
    expect(buildAutoTitle('  Niagara Falls , ON')).toBe('Your MEE time in Niagara Falls');
  });
});

// ─── buildSubtitle ────────────────────────────────────────────────────────────

describe('buildSubtitle', () => {
  it('auto mode: "Built by MEE · {dateRange}"', () => {
    expect(buildSubtitle('auto', 'Thunder Bay, ON', 'Sep 12–15'))
      .toBe('Built by MEE · Sep 12–15');
  });

  it('auto mode without date: "Built by MEE"', () => {
    expect(buildSubtitle('auto', 'Thunder Bay, ON', undefined))
      .toBe('Built by MEE');
  });

  it('custom mode: "Your MEE time in {city} · {dateRange}"', () => {
    expect(buildSubtitle('custom', 'Thunder Bay, ON', 'Sep 12–15'))
      .toBe('Your MEE time in Thunder Bay · Sep 12–15');
  });

  it('custom mode without date: city only', () => {
    expect(buildSubtitle('custom', 'Banff, AB', undefined))
      .toBe('Your MEE time in Banff');
  });

  it('strips province from custom subtitle', () => {
    expect(buildSubtitle('custom', 'Niagara Falls, ON', 'Aug 1–3'))
      .toBe('Your MEE time in Niagara Falls · Aug 1–3');
  });
});

// ─── buildTripRead ────────────────────────────────────────────────────────────

describe('buildTripRead', () => {
  it('mentions budget review when over budget', () => {
    const input = makeInput({
      feasibility: makeFeasibility('over', ['budget']),
    });
    const result = buildTripRead(input);
    expect(result.toLowerCase()).toMatch(/budget/);
  });

  it('highlights named reset point on multi-day trips', () => {
    const input = makeInput({ namedResetPoint: 'Dryden, ON' });
    const result = buildTripRead(input);
    expect(result).toMatch(/Dryden/);
    expect(result).toMatch(/reset/);
  });

  it('uses "demanding" flavor for tight trips with reset point', () => {
    const input = makeInput({
      feasibility: makeFeasibility('tight'),
      namedResetPoint: 'Dryden, ON',
    });
    expect(buildTripRead(input)).toMatch(/demanding/);
  });

  it('notes shared driving on multi-day on-track trips', () => {
    const input = makeInput({
      settings: makeSettings({ numDrivers: 2 }),
      namedResetPoint: undefined,
    });
    const result = buildTripRead(input);
    expect(result.toLowerCase()).toMatch(/shared|rotation/);
  });

  it('shared driving + tight → "longer push, but manageable"', () => {
    const input = makeInput({
      feasibility: makeFeasibility('tight'),
      settings: makeSettings({ numDrivers: 2 }),
    });
    expect(buildTripRead(input)).toMatch(/manageable/);
  });

  it('tight without shared drivers → ambitious pacing', () => {
    const input = makeInput({
      feasibility: makeFeasibility('tight'),
      settings: makeSettings({ numDrivers: 1 }),
    });
    expect(buildTripRead(input).toLowerCase()).toMatch(/ambitious/);
  });

  it('drive-time warning → mentions long day', () => {
    const input = makeInput({
      feasibility: makeFeasibility('on-track', ['drive-time']),
      settings: makeSettings({ numDrivers: 1 }),
    });
    expect(buildTripRead(input).toLowerCase()).toMatch(/long/);
  });

  it('single day, on-track → clean single-day read', () => {
    const input = makeInput({
      summary: makeSummary({ drivingDays: 1 }),
      settings: makeSettings({ numDrivers: 1 }),
    });
    expect(buildTripRead(input).toLowerCase()).toMatch(/single/);
  });

  it('multi-day on-track → comfort or balanced', () => {
    const input = makeInput({
      summary: makeSummary({ drivingDays: 3 }),
      feasibility: makeFeasibility('on-track'),
      settings: makeSettings({ numDrivers: 1 }),
    });
    const result = buildTripRead(input).toLowerCase();
    expect(result.match(/comfort|balanced/)).toBeTruthy();
  });

  it('returns a single sentence (ends with period)', () => {
    const result = buildTripRead(makeInput());
    expect(result.trim()).toMatch(/\.$/);
  });
});

// ─── buildHealthPhrase ────────────────────────────────────────────────────────

describe('buildHealthPhrase', () => {
  it('over budget → "Over budget — worth reviewing"', () => {
    const input = makeInput({ feasibility: makeFeasibility('over', ['budget']) });
    expect(buildHealthPhrase(input)).toBe('Over budget — worth reviewing');
  });

  it('tight + shared drivers → "Ambitious but manageable"', () => {
    const input = makeInput({
      feasibility: makeFeasibility('tight'),
      settings: makeSettings({ numDrivers: 2 }),
    });
    expect(buildHealthPhrase(input)).toBe('Ambitious but manageable');
  });

  it('tight + single driver → "Tight but doable"', () => {
    const input = makeInput({
      feasibility: makeFeasibility('tight'),
      settings: makeSettings({ numDrivers: 1 }),
    });
    expect(buildHealthPhrase(input)).toBe('Tight but doable');
  });

  it('drive-time warning → "Long push ahead"', () => {
    const input = makeInput({
      feasibility: makeFeasibility('on-track', ['drive-time']),
      settings: makeSettings({ numDrivers: 1 }),
    });
    expect(buildHealthPhrase(input)).toBe('Long push ahead');
  });

  it('shared drivers on multi-day on-track → "Well suited to shared driving"', () => {
    const input = makeInput({
      feasibility: makeFeasibility('on-track'),
      settings: makeSettings({ numDrivers: 2 }),
      summary: makeSummary({ drivingDays: 3 }),
    });
    expect(buildHealthPhrase(input)).toBe('Well suited to shared driving');
  });

  it('single day → "Balanced"', () => {
    const input = makeInput({ summary: makeSummary({ drivingDays: 1 }) });
    expect(buildHealthPhrase(input)).toBe('Balanced');
  });

  it('relaxed pace (longest day < 60% of limit) → "Relaxed pace"', () => {
    const input = makeInput({
      feasibility: {
        ...makeFeasibility('on-track'),
        summary: {
          ...makeFeasibility().summary,
          longestDriveDay: 300,
          maxDriveLimit: 600,  // 50% utilization
        },
      },
      settings: makeSettings({ numDrivers: 1 }),
      summary: makeSummary({ drivingDays: 3 }),
    });
    expect(buildHealthPhrase(input)).toBe('Relaxed pace');
  });
});

// ─── buildSignatureCardModel (integration) ────────────────────────────────────

describe('buildSignatureCardModel', () => {
  it('auto title derives from destination', () => {
    const model = buildSignatureCardModel(makeInput());
    expect(model.title).toBe('Your MEE time in Thunder Bay');
    expect(model.titleMode).toBe('auto');
  });

  it('custom title is used verbatim', () => {
    const model = buildSignatureCardModel(makeInput({ customTitle: 'Lake Superior Escape' }));
    expect(model.title).toBe('Lake Superior Escape');
    expect(model.titleMode).toBe('custom');
  });

  it('route label is "Origin → Destination" using city names only', () => {
    const model = buildSignatureCardModel(makeInput());
    expect(model.routeLabel).toBe('Winnipeg → Thunder Bay');
  });

  it('nights = drivingDays - 1', () => {
    const model = buildSignatureCardModel(makeInput({ summary: makeSummary({ drivingDays: 3 }) }));
    expect(model.metrics.nights).toBe(2);
  });

  it('nights is 0 for single-day trip', () => {
    const model = buildSignatureCardModel(makeInput({ summary: makeSummary({ drivingDays: 1 }) }));
    expect(model.metrics.nights).toBe(0);
  });

  it('rooms comes from settings.numRooms', () => {
    const model = buildSignatureCardModel(makeInput({ settings: makeSettings({ numRooms: 2 }) }));
    expect(model.metrics.rooms).toBe(2);
  });

  it('rooms defaults to 1 when numRooms is undefined', () => {
    const settings = makeSettings();
    delete (settings as Partial<TripSettings>).numRooms;
    const model = buildSignatureCardModel(makeInput({ settings }));
    expect(model.metrics.rooms).toBe(1);
  });

  it('drivers is omitted when numDrivers = 1', () => {
    const model = buildSignatureCardModel(makeInput({ settings: makeSettings({ numDrivers: 1 }) }));
    expect(model.metrics.drivers).toBeUndefined();
  });

  it('drivers is set when numDrivers > 1', () => {
    const model = buildSignatureCardModel(makeInput({ settings: makeSettings({ numDrivers: 2 }) }));
    expect(model.metrics.drivers).toBe(2);
  });

  it('mode label: plan → "Plan"', () => {
    const model = buildSignatureCardModel(makeInput({ tripMode: 'plan' }));
    expect(model.metrics.mode).toBe('Plan');
  });

  it('mode label: adventure → "Adventure"', () => {
    const model = buildSignatureCardModel(makeInput({ tripMode: 'adventure' }));
    expect(model.metrics.mode).toBe('Adventure');
  });

  it('mode label: null → "Plan" (default)', () => {
    const model = buildSignatureCardModel(makeInput({ tripMode: null }));
    expect(model.metrics.mode).toBe('Plan');
  });

  it('driveTime is formatted string', () => {
    const model = buildSignatureCardModel(makeInput());
    expect(model.metrics.driveTime).toMatch(/h/);
  });

  it('distance is formatted with units', () => {
    const model = buildSignatureCardModel(makeInput());
    expect(model.metrics.distance).toMatch(/km/);
  });

  it('subtitle includes dateRange when provided', () => {
    const model = buildSignatureCardModel(makeInput({ dateRange: 'Sep 12–15' }));
    expect(model.subtitle).toContain('Sep 12–15');
  });

  it('subtitle omits date when not provided', () => {
    const model = buildSignatureCardModel(makeInput({ dateRange: undefined }));
    expect(model.subtitle).not.toMatch(/–/);
  });
});
