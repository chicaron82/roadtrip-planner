import { describe, it, expect } from 'vitest';
import { analyzeFeasibility, compareRefinements } from './feasibility';
import type { TripSummary, TripSettings, TripDay, RouteSegment, TripBudget } from '../types';

// ==================== HELPERS ====================

function makeSegment(overrides: Partial<RouteSegment> = {}): RouteSegment {
  return {
    from: { id: 'a', name: 'A', lat: 0, lng: 0, type: 'waypoint' },
    to: { id: 'b', name: 'B', lat: 0, lng: 0, type: 'waypoint' },
    distanceKm: 200,
    durationMinutes: 120,
    fuelNeededLitres: 15,
    fuelCost: 25,
    ...overrides,
  };
}

function makeBudget(overrides: Partial<TripBudget> = {}): TripBudget {
  return {
    mode: 'plan-to-budget',
    allocation: 'flexible',
    profile: 'balanced',
    weights: { gas: 25, hotel: 35, food: 30, misc: 10 },
    gas: 600,
    hotel: 800,
    food: 400,
    misc: 200,
    total: 2000,
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
    budgetMode: 'plan-to-budget',
    budget: makeBudget(),
    departureDate: '2025-08-16',
    departureTime: '03:30',
    arrivalDate: '2025-08-21',
    arrivalTime: '22:00',
    useArrivalTime: false,
    gasPrice: 1.50,
    hotelPricePerNight: 150,
    mealPricePerDay: 40,
    isRoundTrip: false,
    avoidTolls: false,
    scenicMode: false,
    routePreference: 'fastest',
    stopFrequency: 'balanced',
    tripPreferences: [],
    ...overrides,
  };
}

function makeDay(overrides: Partial<TripDay> = {}): TripDay {
  return {
    dayNumber: 1,
    date: '2025-08-16',
    dateFormatted: 'Sat, Aug 16',
    route: 'Winnipeg → Sault Ste. Marie',
    segments: [makeSegment()],
    segmentIndices: [0],
    timezoneChanges: [],
    budget: {
      gasUsed: 150,
      hotelCost: 204,
      foodEstimate: 80,
      miscCost: 0,
      dayTotal: 434,
      gasRemaining: 450,
      hotelRemaining: 596,
      foodRemaining: 320,
    },
    totals: {
      distanceKm: 1421,
      driveTimeMinutes: 940, // 15h 40m
      stopTimeMinutes: 90,
      departureTime: '2025-08-16T03:30:00',
      arrivalTime: '2025-08-16T22:45:00',
    },
    ...overrides,
  };
}

function makeSummary(days: TripDay[]): TripSummary {
  const segments = days.flatMap(d => d.segments);
  return {
    totalDistanceKm: days.reduce((sum, d) => sum + d.totals.distanceKm, 0),
    totalDurationMinutes: days.reduce((sum, d) => sum + d.totals.driveTimeMinutes, 0),
    totalFuelLitres: 200,
    totalFuelCost: 300,
    gasStops: 4,
    costPerPerson: 500,
    drivingDays: days.length,
    segments,
    fullGeometry: [],
    days,
  };
}

// ==================== TESTS: analyzeFeasibility ====================

describe('analyzeFeasibility', () => {
  describe('budget analysis', () => {
    it('returns on-track when well within budget', () => {
      const day = makeDay({
        budget: { gasUsed: 100, hotelCost: 150, foodEstimate: 60, miscCost: 0, dayTotal: 310, gasRemaining: 500, hotelRemaining: 650, foodRemaining: 340 },
        totals: { distanceKm: 400, driveTimeMinutes: 300, stopTimeMinutes: 30, departureTime: '2025-08-16T09:00:00', arrivalTime: '2025-08-16T15:00:00' },
      });
      const summary = makeSummary([day]);
      const settings = makeSettings({ budget: makeBudget({ total: 2000 }), numDrivers: 2 });

      const result = analyzeFeasibility(summary, settings);
      expect(result.status).toBe('on-track');
      expect(result.warnings.filter(w => w.category === 'budget')).toHaveLength(0);
    });

    it('returns tight when budget is 85-100% used', () => {
      const day = makeDay({
        budget: { gasUsed: 500, hotelCost: 700, foodEstimate: 300, miscCost: 200, dayTotal: 1700, gasRemaining: 100, hotelRemaining: 100, foodRemaining: 100 },
        totals: { distanceKm: 400, driveTimeMinutes: 300, stopTimeMinutes: 30, departureTime: '2025-08-17T09:00:00', arrivalTime: '2025-08-17T15:00:00' },
      });
      const summary = makeSummary([day]);
      const settings = makeSettings({ budget: makeBudget({ total: 2000 }), numDrivers: 2 });

      const result = analyzeFeasibility(summary, settings);
      expect(result.status).toBe('tight');
      expect(result.warnings.some(w => w.category === 'budget' && w.severity === 'warning')).toBe(true);
    });

    it('returns over when budget is exceeded', () => {
      const day = makeDay({
        budget: { gasUsed: 800, hotelCost: 900, foodEstimate: 400, miscCost: 200, dayTotal: 2300, gasRemaining: -200, hotelRemaining: -100, foodRemaining: 0 },
      });
      const summary = makeSummary([day]);
      const settings = makeSettings({ budget: makeBudget({ total: 2000 }) });

      const result = analyzeFeasibility(summary, settings);
      expect(result.status).toBe('over');
      expect(result.warnings.some(w => w.category === 'budget' && w.severity === 'critical')).toBe(true);
    });

    it('skips budget analysis in open mode', () => {
      const day = makeDay({
        budget: { gasUsed: 9999, hotelCost: 9999, foodEstimate: 9999, miscCost: 9999, dayTotal: 39996, gasRemaining: 0, hotelRemaining: 0, foodRemaining: 0 },
      });
      const summary = makeSummary([day]);
      const settings = makeSettings({ budget: makeBudget({ mode: 'open', total: 100 }) });

      const result = analyzeFeasibility(summary, settings);
      expect(result.warnings.filter(w => w.category === 'budget')).toHaveLength(0);
    });

    it('warns when gas category exceeds gas budget', () => {
      const day = makeDay({
        budget: { gasUsed: 700, hotelCost: 200, foodEstimate: 100, miscCost: 0, dayTotal: 1000, gasRemaining: -100, hotelRemaining: 600, foodRemaining: 300 },
      });
      const summary = makeSummary([day]);
      const settings = makeSettings({ budget: makeBudget({ gas: 600, total: 2000 }) });

      const result = analyzeFeasibility(summary, settings);
      expect(result.warnings.some(w => w.message.includes('Gas budget exceeded'))).toBe(true);
    });

    it('warns when hotel category exceeds hotel budget', () => {
      const day = makeDay({
        budget: { gasUsed: 100, hotelCost: 900, foodEstimate: 100, miscCost: 0, dayTotal: 1100, gasRemaining: 500, hotelRemaining: -100, foodRemaining: 300 },
      });
      const summary = makeSummary([day]);
      const settings = makeSettings({ budget: makeBudget({ hotel: 800, total: 2000 }) });

      const result = analyzeFeasibility(summary, settings);
      expect(result.warnings.some(w => w.message.includes('Hotel budget exceeded'))).toBe(true);
    });
  });

  describe('drive time analysis', () => {
    it('warns when a day exceeds max drive hours', () => {
      // Day 1 of the real trip: 15h 40m with 10h limit
      const day = makeDay({
        totals: { distanceKm: 1421, driveTimeMinutes: 940, stopTimeMinutes: 90, departureTime: '2025-08-16T03:30:00', arrivalTime: '2025-08-16T22:45:00' },
      });
      const summary = makeSummary([day]);
      const settings = makeSettings({ maxDriveHours: 10 });

      const result = analyzeFeasibility(summary, settings);
      expect(result.warnings.some(w => w.category === 'drive-time' && w.severity === 'critical')).toBe(true);
      expect(result.warnings.some(w => w.message.includes('Day 1'))).toBe(true);
    });

    it('warns when drive time is close to limit (90%+)', () => {
      const day = makeDay({
        totals: { distanceKm: 700, driveTimeMinutes: 555, stopTimeMinutes: 30, departureTime: '2025-08-17T09:00:00', arrivalTime: '2025-08-17T18:15:00' },
      });
      const summary = makeSummary([day]);
      const settings = makeSettings({ maxDriveHours: 10 });

      const result = analyzeFeasibility(summary, settings);
      expect(result.warnings.some(w => w.category === 'drive-time' && w.severity === 'warning')).toBe(true);
    });

    it('no warning when drive time is well within limit', () => {
      const day = makeDay({
        totals: { distanceKm: 400, driveTimeMinutes: 300, stopTimeMinutes: 30, departureTime: '2025-08-18T09:00:00', arrivalTime: '2025-08-18T14:30:00' },
      });
      const summary = makeSummary([day]);
      const settings = makeSettings({ maxDriveHours: 10 });

      const result = analyzeFeasibility(summary, settings);
      expect(result.warnings.filter(w => w.category === 'drive-time')).toHaveLength(0);
    });
  });

  describe('driver fatigue analysis', () => {
    it('warns about single driver on long days', () => {
      // Real scenario: 4→3 people, 2→1 driver, Day 1 is 15h 40m
      const day = makeDay({
        totals: { distanceKm: 1421, driveTimeMinutes: 940, stopTimeMinutes: 90, departureTime: '2025-08-16T03:30:00', arrivalTime: '2025-08-16T22:45:00' },
      });
      const summary = makeSummary([day]);
      const settings = makeSettings({ numDrivers: 1 });

      const result = analyzeFeasibility(summary, settings);
      expect(result.warnings.some(w => w.category === 'driver' && w.severity === 'warning')).toBe(true);
      expect(result.warnings.some(w => w.message.includes('1 driver'))).toBe(true);
    });

    it('no driver warning with 2+ drivers', () => {
      const day = makeDay({
        totals: { distanceKm: 1421, driveTimeMinutes: 940, stopTimeMinutes: 90, departureTime: '2025-08-16T03:30:00', arrivalTime: '2025-08-16T22:45:00' },
      });
      const summary = makeSummary([day]);
      const settings = makeSettings({ numDrivers: 2 });

      const result = analyzeFeasibility(summary, settings);
      expect(result.warnings.filter(w => w.category === 'driver')).toHaveLength(0);
    });

    it('no driver warning when drive time is under 8 hours', () => {
      const day = makeDay({
        totals: { distanceKm: 400, driveTimeMinutes: 300, stopTimeMinutes: 30, departureTime: '2025-08-17T09:00:00', arrivalTime: '2025-08-17T14:30:00' },
      });
      const summary = makeSummary([day]);
      const settings = makeSettings({ numDrivers: 1 });

      const result = analyzeFeasibility(summary, settings);
      expect(result.warnings.filter(w => w.category === 'driver')).toHaveLength(0);
    });
  });

  describe('timing analysis', () => {
    it('warns about late arrivals (after 10 PM)', () => {
      const day = makeDay({
        totals: { distanceKm: 1421, driveTimeMinutes: 940, stopTimeMinutes: 90, departureTime: '2025-08-16T03:30:00', arrivalTime: '2025-08-16T22:45:00' },
      });
      const summary = makeSummary([day]);
      const settings = makeSettings();

      const result = analyzeFeasibility(summary, settings);
      expect(result.warnings.some(w => w.category === 'timing' && w.message.includes('Late arrival'))).toBe(true);
    });

    it('notes early departures (before 4 AM)', () => {
      const day = makeDay({
        totals: { distanceKm: 1421, driveTimeMinutes: 940, stopTimeMinutes: 90, departureTime: '2025-08-16T03:30:00', arrivalTime: '2025-08-16T18:00:00' },
      });
      const summary = makeSummary([day]);
      const settings = makeSettings();

      const result = analyzeFeasibility(summary, settings);
      expect(result.warnings.some(w => w.category === 'timing' && w.message.includes('Early departure'))).toBe(true);
    });

    it('no timing warnings for normal hours', () => {
      const day = makeDay({
        totals: { distanceKm: 700, driveTimeMinutes: 540, stopTimeMinutes: 30, departureTime: '2025-08-17T09:00:00', arrivalTime: '2025-08-17T18:00:00' },
      });
      const summary = makeSummary([day]);
      const settings = makeSettings();

      const result = analyzeFeasibility(summary, settings);
      expect(result.warnings.filter(w => w.category === 'timing')).toHaveLength(0);
    });
  });

  describe('per-person cost analysis', () => {
    it('warns when per-person cost exceeds per-person budget', () => {
      const day = makeDay({
        budget: { gasUsed: 600, hotelCost: 800, foodEstimate: 400, miscCost: 200, dayTotal: 2000, gasRemaining: 0, hotelRemaining: 0, foodRemaining: 0 },
      });
      const summary = makeSummary([day]);
      // 3 travelers splitting $2000 = $667/person, but budget is $1500 / 3 = $500/person
      const settings = makeSettings({ numTravelers: 3, budget: makeBudget({ total: 1500 }) });

      const result = analyzeFeasibility(summary, settings);
      expect(result.warnings.some(w => w.category === 'passenger')).toBe(true);
    });
  });

  describe('summary calculations', () => {
    it('calculates budget utilization correctly', () => {
      const day = makeDay({
        budget: { gasUsed: 300, hotelCost: 400, foodEstimate: 200, miscCost: 100, dayTotal: 1000, gasRemaining: 300, hotelRemaining: 400, foodRemaining: 200 },
      });
      const summary = makeSummary([day]);
      const settings = makeSettings({ budget: makeBudget({ total: 2000 }) });

      const result = analyzeFeasibility(summary, settings);
      expect(result.summary.budgetUtilization).toBe(0.5);
      expect(result.summary.totalBudgetUsed).toBe(1000);
      expect(result.summary.totalBudgetAvailable).toBe(2000);
    });

    it('finds longest drive day', () => {
      const day1 = makeDay({
        dayNumber: 1,
        totals: { distanceKm: 1421, driveTimeMinutes: 940, stopTimeMinutes: 90, departureTime: '2025-08-16T03:30:00', arrivalTime: '2025-08-16T22:45:00' },
      });
      const day2 = makeDay({
        dayNumber: 2,
        totals: { distanceKm: 720, driveTimeMinutes: 540, stopTimeMinutes: 30, departureTime: '2025-08-17T09:00:00', arrivalTime: '2025-08-17T18:00:00' },
      });
      const summary = makeSummary([day1, day2]);
      const settings = makeSettings();

      const result = analyzeFeasibility(summary, settings);
      expect(result.summary.longestDriveDay).toBe(940);
    });

    it('calculates per-person cost', () => {
      const day = makeDay({
        budget: { gasUsed: 150, hotelCost: 204, foodEstimate: 80, miscCost: 0, dayTotal: 434, gasRemaining: 450, hotelRemaining: 596, foodRemaining: 320 },
      });
      const summary = makeSummary([day]);
      const settings = makeSettings({ numTravelers: 4 });

      const result = analyzeFeasibility(summary, settings);
      expect(result.summary.perPersonCost).toBe(109); // 434 / 4 = 108.5 → 109 rounded
    });

    it('handles zero travelers gracefully', () => {
      const day = makeDay();
      const summary = makeSummary([day]);
      const settings = makeSettings({ numTravelers: 0 });

      const result = analyzeFeasibility(summary, settings);
      expect(result.summary.perPersonCost).toBe(0);
    });
  });
});

// ==================== TESTS: compareRefinements ====================

describe('compareRefinements', () => {
  it('reports per-person cost change when travelers decrease', () => {
    // Real scenario: 4 → 3 travelers
    const dayBefore = makeDay({
      budget: { gasUsed: 600, hotelCost: 800, foodEstimate: 400, miscCost: 0, dayTotal: 1800, gasRemaining: 0, hotelRemaining: 0, foodRemaining: 0 },
    });
    const summaryBefore = makeSummary([dayBefore]);
    const settingsBefore = makeSettings({ numTravelers: 4 });
    const before = analyzeFeasibility(summaryBefore, settingsBefore);

    const settingsAfter = makeSettings({ numTravelers: 3 });
    const after = analyzeFeasibility(summaryBefore, settingsAfter);

    const warnings = compareRefinements(before, after, {
      travelersBefore: 4,
      travelersAfter: 3,
    });

    expect(warnings.some(w => w.category === 'passenger')).toBe(true);
    expect(warnings.some(w => w.message.includes('1 traveler removed'))).toBe(true);
  });

  it('reports driver reduction warning', () => {
    // Real scenario: 2 → 1 driver
    const day = makeDay();
    const summary = makeSummary([day]);

    const before = analyzeFeasibility(summary, makeSettings({ numDrivers: 2 }));
    const after = analyzeFeasibility(summary, makeSettings({ numDrivers: 1 }));

    const warnings = compareRefinements(before, after, {
      driversBefore: 2,
      driversAfter: 1,
    });

    expect(warnings.some(w => w.category === 'driver')).toBe(true);
    expect(warnings.some(w => w.message.includes('1'))).toBe(true);
    expect(warnings.some(w => w.severity === 'warning')).toBe(true);
  });

  it('reports when plan goes from on-track to over budget', () => {
    const safeDay = {
      totals: { distanceKm: 400, driveTimeMinutes: 300, stopTimeMinutes: 30, departureTime: '2025-08-17T09:00:00', arrivalTime: '2025-08-17T15:00:00' },
    };
    const dayUnder = makeDay({
      ...safeDay,
      budget: { gasUsed: 300, hotelCost: 400, foodEstimate: 200, miscCost: 0, dayTotal: 900, gasRemaining: 300, hotelRemaining: 400, foodRemaining: 200 },
    });
    const dayOver = makeDay({
      ...safeDay,
      budget: { gasUsed: 800, hotelCost: 900, foodEstimate: 500, miscCost: 200, dayTotal: 2400, gasRemaining: -200, hotelRemaining: -100, foodRemaining: -100 },
    });

    const safeSettings = makeSettings({ budget: makeBudget({ total: 2000 }), numDrivers: 2 });
    const before = analyzeFeasibility(makeSummary([dayUnder]), safeSettings);
    const after = analyzeFeasibility(makeSummary([dayOver]), safeSettings);

    const warnings = compareRefinements(before, after, {});
    expect(warnings.some(w => w.severity === 'critical' && w.message.includes('no longer within budget'))).toBe(true);
  });

  it('reports recovery when plan goes from over to on-track', () => {
    const safeDay = {
      totals: { distanceKm: 400, driveTimeMinutes: 300, stopTimeMinutes: 30, departureTime: '2025-08-17T09:00:00', arrivalTime: '2025-08-17T15:00:00' },
    };
    const dayOver = makeDay({
      ...safeDay,
      budget: { gasUsed: 800, hotelCost: 900, foodEstimate: 500, miscCost: 200, dayTotal: 2400, gasRemaining: -200, hotelRemaining: -100, foodRemaining: -100 },
    });
    const dayUnder = makeDay({
      ...safeDay,
      budget: { gasUsed: 300, hotelCost: 400, foodEstimate: 200, miscCost: 0, dayTotal: 900, gasRemaining: 300, hotelRemaining: 400, foodRemaining: 200 },
    });

    const safeSettings = makeSettings({ budget: makeBudget({ total: 2000 }), numDrivers: 2 });
    const before = analyzeFeasibility(makeSummary([dayOver]), safeSettings);
    const after = analyzeFeasibility(makeSummary([dayUnder]), safeSettings);

    const warnings = compareRefinements(before, after, {});
    expect(warnings.some(w => w.message.includes('back on track'))).toBe(true);
  });

  it('handles no changes gracefully', () => {
    const day = makeDay();
    const summary = makeSummary([day]);
    const settings = makeSettings();

    const result = analyzeFeasibility(summary, settings);
    const warnings = compareRefinements(result, result, {});

    // No status change = no status warnings
    expect(warnings.filter(w => w.category === 'budget' && w.message.includes('no longer'))).toHaveLength(0);
  });
});

// ==================== REAL SCENARIO: WINNIPEG→TORONTO TRIP ====================

describe('real scenario: Winnipeg→Toronto trip changes', () => {
  it('catches all cascading issues from 4→3 travelers + 2→1 drivers', () => {
    // Day 1: Winnipeg → Sault Ste. Marie (15h 40m drive)
    const day1 = makeDay({
      dayNumber: 1,
      totals: { distanceKm: 1421, driveTimeMinutes: 940, stopTimeMinutes: 90, departureTime: '2025-08-16T03:30:00', arrivalTime: '2025-08-16T22:45:00' },
      budget: { gasUsed: 150, hotelCost: 204, foodEstimate: 120, miscCost: 0, dayTotal: 474, gasRemaining: 450, hotelRemaining: 596, foodRemaining: 280 },
    });

    // Day 2: Sault Ste. Marie → Burlington (9h drive)
    const day2 = makeDay({
      dayNumber: 2,
      totals: { distanceKm: 720, driveTimeMinutes: 540, stopTimeMinutes: 30, departureTime: '2025-08-17T09:00:00', arrivalTime: '2025-08-17T18:00:00' },
      budget: { gasUsed: 70, hotelCost: 428, foodEstimate: 120, miscCost: 0, dayTotal: 618, gasRemaining: 380, hotelRemaining: 168, foodRemaining: 160 },
    });

    const summary = makeSummary([day1, day2]);

    // Before: 4 travelers, 2 drivers, $1500 budget
    const settingsBefore = makeSettings({
      numTravelers: 4,
      numDrivers: 2,
      maxDriveHours: 10,
      budget: makeBudget({ total: 1500 }),
    });

    // After: 3 travelers, 1 driver (someone backed out)
    const settingsAfter = makeSettings({
      numTravelers: 3,
      numDrivers: 1,
      maxDriveHours: 10,
      budget: makeBudget({ total: 1500 }),
    });

    const before = analyzeFeasibility(summary, settingsBefore);
    const after = analyzeFeasibility(summary, settingsAfter);

    // Drive time: Day 1 at 15h 40m should flag as critical (exceeds 10h)
    expect(after.warnings.some(w => w.category === 'drive-time' && w.severity === 'critical')).toBe(true);

    // Driver: Single driver on 15h 40m day should warn
    expect(after.warnings.some(w => w.category === 'driver')).toBe(true);

    // Late arrival: 10:45 PM
    expect(after.warnings.some(w => w.category === 'timing' && w.message.includes('Late arrival'))).toBe(true);

    // Early departure: 3:30 AM
    expect(after.warnings.some(w => w.category === 'timing' && w.message.includes('Early departure'))).toBe(true);

    // Compare refinements
    const refinementWarnings = compareRefinements(before, after, {
      travelersBefore: 4,
      travelersAfter: 3,
      driversBefore: 2,
      driversAfter: 1,
    });

    // Should mention per-person cost increase
    expect(refinementWarnings.some(w => w.category === 'passenger')).toBe(true);

    // Should warn about driver reduction to 1
    expect(refinementWarnings.some(w => w.category === 'driver')).toBe(true);
  });
});
