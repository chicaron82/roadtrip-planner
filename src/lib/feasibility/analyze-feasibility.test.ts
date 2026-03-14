/**
 * feasibility analyzers — unit tests
 *
 * analyzeDriveTime, analyzeDriverFatigue, analyzeBudget, analyzePerPersonCosts.
 * All pure functions — no mocks needed.
 *
 * TripDay fixtures use non-UTC arrivalTime strings (no 'Z') so the code
 * falls back to the drive-time arithmetic path, avoiding timezone flakiness.
 */

import { describe, it, expect } from 'vitest';
import type { TripDay, TripSettings } from '../../types';
import { analyzeDriveTime, analyzeDriverFatigue } from './analyze-drive-time';
import { analyzeBudget } from './analyze-budget';
import { analyzePerPersonCosts } from './analyze-costs';
import type { FeasibilitySummary } from '../trip-summary-slices';
import { makeSettings as _makeSettings, makeBudget } from '../../test/fixtures';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeSettings = (overrides: Partial<TripSettings> = {}) => _makeSettings({
  numTravelers: 2, numDrivers: 1,
  budget: makeBudget({ gas: 0, hotel: 0, food: 0, misc: 0, total: 1000 }),
  departureDate: '2026-08-16', returnDate: '', arrivalDate: '', arrivalTime: '',
  ...overrides,
});

const LOC_WPG = { id: 'wpg', name: 'Winnipeg',    lat: 49.895, lng: -97.138, type: 'origin'      as const };
const LOC_TB  = { id: 'tb',  name: 'Thunder Bay', lat: 48.381, lng: -89.247, type: 'destination' as const };

function makeDay(dayNumber: number, driveMinutes: number, overrides: Partial<TripDay> = {}): TripDay {
  return {
    dayNumber,
    date: '2026-08-16',
    dateFormatted: 'Sat, Aug 16',
    route: 'Winnipeg → Thunder Bay',
    segments: [{ from: LOC_WPG, to: LOC_TB, distanceKm: 700, durationMinutes: driveMinutes,
      fuelCost: 120, fuelLitres: 60, region: 'MB', _originalIndex: 0 } as unknown as TripDay['segments'][number]],
    segmentIndices: [0],
    timezoneChanges: [],
    budget: { gasUsed: 120, hotelCost: 150, foodEstimate: 60, miscCost: 10, dayTotal: 340, bankRemaining: 660 },
    totals: { distanceKm: 700, driveTimeMinutes: driveMinutes, stopTimeMinutes: 30,
      // Non-UTC format — forces arithmetic fallback path in analyzeDriveTime
      departureTime: '2026-08-16T09:00:00', arrivalTime: '2026-08-16T19:00:00' },
    ...overrides,
  } as TripDay;
}

// ─── analyzeDriveTime ────────────────────────────────────────────────────────

describe('analyzeDriveTime', () => {
  it('returns no warnings when drive time is well within limit', () => {
    const warnings = analyzeDriveTime([makeDay(1, 300)], makeSettings()); // 5h < 10h limit
    const driveWarnings = warnings.filter(w => w.category === 'drive-time');
    expect(driveWarnings).toHaveLength(0);
  });

  it('emits critical warning when drive time far exceeds limit', () => {
    // 10h limit + 1h grace = 11h hard limit. 12h = over.
    const warnings = analyzeDriveTime([makeDay(1, 720)], makeSettings()); // 12h
    const critical = warnings.filter(w => w.severity === 'critical');
    expect(critical.length).toBeGreaterThan(0);
    expect(critical[0].category).toBe('drive-time');
  });

  it('emits warning (not critical) when drive time is close to limit', () => {
    // 90% of 10h = 9h = 540 min — tight threshold
    const warnings = analyzeDriveTime([makeDay(1, 570)], makeSettings()); // 9.5h — tight
    const tight = warnings.filter(w => w.severity === 'warning' && w.category === 'drive-time');
    expect(tight.length).toBeGreaterThan(0);
  });

  it('includes dayNumber in warning', () => {
    const warnings = analyzeDriveTime([makeDay(3, 720)], makeSettings());
    const w = warnings.find(x => x.category === 'drive-time' && x.severity === 'critical');
    expect(w?.dayNumber).toBe(3);
  });

  it('emits per-day warnings independently for multiple days', () => {
    const days = [makeDay(1, 300), makeDay(2, 720), makeDay(3, 720)];
    const warnings = analyzeDriveTime(days, makeSettings());
    const criticals = warnings.filter(w => w.severity === 'critical' && w.category === 'drive-time');
    expect(criticals).toHaveLength(2); // days 2 and 3
  });

  it('critical warning includes an overnight-stop suggestion', () => {
    const warnings = analyzeDriveTime([makeDay(1, 720)], makeSettings());
    const w = warnings.find(x => x.severity === 'critical');
    expect(w?.suggestion).toMatch(/overnight/i);
  });

  it('returns empty array for empty days list', () => {
    expect(analyzeDriveTime([], makeSettings())).toEqual([]);
  });
});

// ─── analyzeDriverFatigue ─────────────────────────────────────────────────────

describe('analyzeDriverFatigue', () => {
  it('returns no warnings for a single driver with short drive', () => {
    const warnings = analyzeDriverFatigue([makeDay(1, 300)], makeSettings()); // 5h < 10h
    expect(warnings.filter(w => w.severity !== 'info')).toHaveLength(0);
  });

  it('warns when single driver exceeds maxDriveHours', () => {
    const warnings = analyzeDriverFatigue([makeDay(1, 720)], makeSettings()); // 12h > 10h
    const w = warnings.filter(w => w.category === 'driver' && w.severity === 'warning');
    expect(w.length).toBeGreaterThan(0);
    expect(w[0].message).toMatch(/1 driver/i);
  });

  it('emits per-shift info for rotating drivers', () => {
    const settings = makeSettings({ numDrivers: 2 });
    const warnings = analyzeDriverFatigue([makeDay(1, 600)], settings); // 10h / 2 drivers
    const info = warnings.filter(w => w.category === 'driver' && w.severity === 'info');
    expect(info.length).toBeGreaterThan(0);
    expect(info[0].message).toMatch(/rotating/i);
  });

  it('emits under-utilization hint when multi-driver + low daily limit', () => {
    const settings = makeSettings({ numDrivers: 2, maxDriveHours: 8 });
    const warnings = analyzeDriverFatigue([makeDay(1, 420)], settings); // 7h
    const hint = warnings.find(w => w.message.includes('could safely drive'));
    expect(hint).toBeDefined();
    expect(hint?.severity).toBe('info');
  });

  it('returns empty for numDrivers < 1', () => {
    const settings = makeSettings({ numDrivers: 0 });
    expect(analyzeDriverFatigue([makeDay(1, 720)], settings)).toEqual([]);
  });

  it('returns empty for empty days', () => {
    expect(analyzeDriverFatigue([], makeSettings())).toEqual([]);
  });
});

// ─── analyzeBudget ────────────────────────────────────────────────────────────

describe('analyzeBudget', () => {
  function makeSummary(days: TripDay[]): FeasibilitySummary {
    return { days };
  }

  it('returns no warnings when budget.total is 0', () => {
    const settings = makeSettings({ budget: { ...makeSettings().budget, total: 0 } });
    expect(analyzeBudget(makeSummary([makeDay(1, 300)]), settings)).toEqual([]);
  });

  it('returns no warnings when under budget', () => {
    // bankRemaining=660, budget.total=1000 → utilization=34% < tight threshold
    const day = makeDay(1, 300); // bankRemaining=660
    const warnings = analyzeBudget(makeSummary([day]), makeSettings({ budget: { ...makeSettings().budget, total: 1000 } }));
    expect(warnings.filter(w => w.severity !== 'info')).toHaveLength(0);
  });

  it('warns when bank goes negative (over budget)', () => {
    const day = makeDay(1, 300, {
      budget: { gasUsed: 600, hotelCost: 600, foodEstimate: 0, miscCost: 0, dayTotal: 1200, bankRemaining: -200 },
    });
    const warnings = analyzeBudget(makeSummary([day]), makeSettings({ budget: { ...makeSettings().budget, total: 1000 } }));
    const w = warnings.find(x => x.severity === 'warning' && x.category === 'budget');
    expect(w).toBeDefined();
    expect(w?.message).toMatch(/over estimate/i);
  });

  it('warns when budget is tight (>= tightThreshold utilization)', () => {
    // tightThreshold is 0.85 → 850/1000. bankRemaining = 140 → totalUsed = 860 (86%)
    const day = makeDay(1, 300, {
      budget: { gasUsed: 500, hotelCost: 300, foodEstimate: 60, miscCost: 0, dayTotal: 860, bankRemaining: 140 },
    });
    const warnings = analyzeBudget(makeSummary([day]), makeSettings({ budget: { ...makeSettings().budget, total: 1000 } }));
    const w = warnings.find(x => x.category === 'budget');
    expect(w).toBeDefined();
    expect(w?.message).toMatch(/tight/i);
  });

  it('in open mode, emits info only when clearly over reference', () => {
    const settings = makeSettings({
      budgetMode: 'open',
      budget: { ...makeSettings().budget, mode: 'open', total: 500 },
    });
    // totalUsed = budget.total - bankRemaining. We need utilization > overThreshold
    // bankRemaining=660 → totalUsed=500-660 = negative → utilization < 0 → no warning
    // Flip: budget.total=500, bankRemaining=-200 → totalUsed=700 → util=1.4 > 1.0
    const day = makeDay(1, 300, {
      budget: { gasUsed: 700, hotelCost: 0, foodEstimate: 0, miscCost: 0, dayTotal: 700, bankRemaining: -200 },
    });
    const warnings = analyzeBudget(makeSummary([day]), settings);
    const w = warnings.find(x => x.category === 'budget' && x.severity === 'info');
    expect(w).toBeDefined();
  });

  it('suggests hotels when hotel spend is largest overage item', () => {
    const day = makeDay(1, 300, {
      budget: { gasUsed: 100, hotelCost: 900, foodEstimate: 50, miscCost: 0, dayTotal: 1050, bankRemaining: -50 },
    });
    const warnings = analyzeBudget(makeSummary([day]), makeSettings({ budget: { ...makeSettings().budget, total: 1000 } }));
    const w = warnings.find(x => x.category === 'budget');
    expect(w?.suggestion).toMatch(/hotel/i);
  });

  it('suggests food when food spend is largest overage item', () => {
    const day = makeDay(1, 300, {
      budget: { gasUsed: 100, hotelCost: 100, foodEstimate: 900, miscCost: 0, dayTotal: 1100, bankRemaining: -100 },
    });
    const warnings = analyzeBudget(makeSummary([day]), makeSettings({ budget: { ...makeSettings().budget, total: 1000 } }));
    const w = warnings.find(x => x.category === 'budget');
    expect(w?.suggestion).toMatch(/meal/i);
  });
});

// ─── analyzePerPersonCosts ────────────────────────────────────────────────────

describe('analyzePerPersonCosts', () => {
  function makeSummary(days: TripDay[]): FeasibilitySummary {
    return { days };
  }

  it('returns no warnings when numTravelers <= 0', () => {
    const settings = makeSettings({ numTravelers: 0 });
    expect(analyzePerPersonCosts(makeSummary([makeDay(1, 300)]), settings)).toEqual([]);
  });

  it('returns no warnings when not in plan-to-budget mode', () => {
    const settings = makeSettings({ budgetMode: 'open', budget: { ...makeSettings().budget, mode: 'open' } });
    expect(analyzePerPersonCosts(makeSummary([makeDay(1, 300)]), settings)).toHaveLength(0);
  });

  it('warns when per-person cost exceeds per-person budget', () => {
    // dayTotal=600, numTravelers=2 → perPerson=300. perPersonBudget=1000/2=500
    // Need perPerson > perPersonBudget: dayTotal=1200, numTravelers=2 → 600 > 500
    const day = makeDay(1, 300, {
      budget: { gasUsed: 1200, hotelCost: 0, foodEstimate: 0, miscCost: 0, dayTotal: 1200, bankRemaining: -200 },
    });
    const settings = makeSettings({ numTravelers: 2, budget: { ...makeSettings().budget, total: 1000 } });
    const warnings = analyzePerPersonCosts(makeSummary([day]), settings);
    const w = warnings.find(x => x.category === 'passenger');
    expect(w).toBeDefined();
    expect(w?.message).toMatch(/per-person/i);
  });

  it('returns no warnings when per-person cost is under budget', () => {
    // dayTotal=300, numTravelers=2 → perPerson=150. budget=1000 → perPersonBudget=500 → 150 < 500
    const day = makeDay(1, 300, {
      budget: { gasUsed: 300, hotelCost: 0, foodEstimate: 0, miscCost: 0, dayTotal: 300, bankRemaining: 700 },
    });
    const settings = makeSettings({ numTravelers: 2, budget: { ...makeSettings().budget, total: 1000 } });
    const warnings = analyzePerPersonCosts(makeSummary([day]), settings);
    expect(warnings.filter(w => w.category === 'passenger')).toHaveLength(0);
  });

  it('references traveler count in the warning detail', () => {
    const day = makeDay(1, 300, {
      budget: { gasUsed: 1200, hotelCost: 0, foodEstimate: 0, miscCost: 0, dayTotal: 1200, bankRemaining: -200 },
    });
    const settings = makeSettings({ numTravelers: 3, budget: { ...makeSettings().budget, total: 900 } });
    const warnings = analyzePerPersonCosts(makeSummary([day]), settings);
    const w = warnings.find(x => x.category === 'passenger');
    expect(w?.detail).toMatch(/3 traveler/i);
  });
});
