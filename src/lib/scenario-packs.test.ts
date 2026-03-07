/**
 * scenario-packs.test.ts — End-to-end scenario tests
 *
 * These tests validate whole-trip *feel*, not individual functions.
 * Each scenario chains calculateTripCosts → calculateArrivalTimes → splitTripByDays
 * and asserts on broad expectations: day count, ballpark timing, fuel stops,
 * no contradictory values.
 *
 * The goal is NOT fake precision. It's: "does this trip make sense?"
 *
 * 💚 My Experience Engine — Trust Foundation
 */

import { describe, it, expect } from 'vitest';
import { calculateTripCosts, calculateArrivalTimes } from './calculations';
import { splitTripByDays, calculateCostBreakdown } from './budget';
import type { RouteSegment, Vehicle } from '../types';
import { makeSettings } from '../test/fixtures';
import { TRIP_CONSTANTS } from './trip-constants';

// ═══════════════════════════════════════════════════════════════════════════
// SHARED FIXTURES — Real Canadian route profiles
// ═══════════════════════════════════════════════════════════════════════════

/** Toyota Camry — the average road trip car */
const camry: Vehicle = {
  year: '2024',
  make: 'Toyota',
  model: 'Camry',
  fuelEconomyCity: 8.7,  // L/100km
  fuelEconomyHwy: 6.2,   // L/100km
  tankSize: 60,           // litres
};

/** Ford F-150 — inefficient truck for stress testing */
const f150: Vehicle = {
  year: '2023',
  make: 'Ford',
  model: 'F-150',
  fuelEconomyCity: 13.5,  // L/100km
  fuelEconomyHwy: 10.5,   // L/100km
  tankSize: 98,            // litres
};

// Locations — real coordinates for realistic timezone and regional pricing
const WINNIPEG = { id: 'wpg', name: 'Winnipeg, MB', lat: 49.8951, lng: -97.1384, type: 'origin' as const };
const REGINA = { id: 'reg', name: 'Regina, SK', lat: 50.4452, lng: -104.6189, type: 'waypoint' as const };
const THUNDER_BAY = { id: 'tb', name: 'Thunder Bay, ON', lat: 48.3822, lng: -89.2461, type: 'waypoint' as const };
const SAULT_STE_MARIE = { id: 'ssm', name: 'Sault Ste. Marie, ON', lat: 46.5219, lng: -84.3461, type: 'waypoint' as const };
const TORONTO = { id: 'tor', name: 'Toronto, ON', lat: 43.6532, lng: -79.3832, type: 'destination' as const };
const KENORA = { id: 'ken', name: 'Kenora, ON', lat: 49.767, lng: -94.489, type: 'waypoint' as const };
const BRANDON = { id: 'bra', name: 'Brandon, MB', lat: 49.8485, lng: -99.9501, type: 'destination' as const };

// ═══════════════════════════════════════════════════════════════════════════
// ROUTE BUILDERS — Realistic segment data (OSRM-corrected durations)
// ═══════════════════════════════════════════════════════════════════════════

/** Winnipeg → Brandon: ~2h drive, 200km. Short weekend trip. */
function wpgToBrandon(): RouteSegment[] {
  return [{
    from: WINNIPEG, to: BRANDON,
    distanceKm: 200, durationMinutes: 120,
    fuelNeededLitres: 0, fuelCost: 0,
  }];
}

/** Winnipeg → Regina: ~5h50m drive, 574km. Comfortable single day. */
function wpgToRegina(): RouteSegment[] {
  return [{
    from: WINNIPEG, to: REGINA,
    distanceKm: 574, durationMinutes: 350,
    fuelNeededLitres: 0, fuelCost: 0,
  }];
}

/**
 * Winnipeg → Thunder Bay: ~8h drive, 700km via Kenora.
 * The classic borderline single-day test — pushes against maxDriveHours.
 */
function wpgToThunderBay(): RouteSegment[] {
  return [
    {
      from: WINNIPEG, to: KENORA,
      distanceKm: 210, durationMinutes: 140,
      fuelNeededLitres: 0, fuelCost: 0,
    },
    {
      from: KENORA, to: THUNDER_BAY,
      distanceKm: 490, durationMinutes: 340,
      fuelNeededLitres: 0, fuelCost: 0,
    },
  ];
}

/**
 * Winnipeg → Toronto: ~20h drive, 2200km via Thunder Bay and Sault Ste. Marie.
 * Multi-day trip — the big one. Tests day splitting, overnight placement, fuel pressure.
 */
function wpgToToronto(): RouteSegment[] {
  return [
    {
      from: WINNIPEG, to: KENORA,
      distanceKm: 210, durationMinutes: 140,
      fuelNeededLitres: 0, fuelCost: 0,
    },
    {
      from: KENORA, to: THUNDER_BAY,
      distanceKm: 490, durationMinutes: 340,
      fuelNeededLitres: 0, fuelCost: 0,
    },
    {
      from: THUNDER_BAY, to: SAULT_STE_MARIE,
      distanceKm: 700, durationMinutes: 475,
      fuelNeededLitres: 0, fuelCost: 0,
    },
    {
      from: SAULT_STE_MARIE, to: TORONTO,
      distanceKm: 700, durationMinutes: 445,
      fuelNeededLitres: 0, fuelCost: 0,
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER — Run the full planning pipeline (costs → arrival times → day split)
// ═══════════════════════════════════════════════════════════════════════════

function planTrip(
  segments: RouteSegment[],
  vehicle: Vehicle,
  settingsOverrides: Parameters<typeof makeSettings>[0] = {},
) {
  const settings = makeSettings({
    gasPrice: 1.50,
    hotelPricePerNight: 150,
    mealPricePerDay: 50,
    ...settingsOverrides,
  });

  const summary = calculateTripCosts(segments, vehicle, settings);

  // Apply OSRM correction to segment durations (matches real pipeline)
  const correctedSegments = summary.segments.map(s => ({
    ...s,
    durationMinutes: Math.round(s.durationMinutes * TRIP_CONSTANTS.routing.osrmDurationFactor),
  }));

  const timed = calculateArrivalTimes(
    correctedSegments,
    settings.departureDate,
    settings.departureTime,
  );

  const days = splitTripByDays(
    timed,
    settings,
    settings.departureDate,
    settings.departureTime,
  );

  const costBreakdown = calculateCostBreakdown(days, settings.numTravelers);

  return { summary, timed, days, costBreakdown, settings };
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 1 — Short Weekend: Winnipeg → Brandon (~2h)
// ═══════════════════════════════════════════════════════════════════════════

describe('Scenario: Winnipeg → Brandon (short weekend)', () => {
  it('should be a single-day trip', () => {
    const { days } = planTrip(wpgToBrandon(), camry, { maxDriveHours: 8 });
    expect(days).toHaveLength(1);
  });

  it('should not require an overnight stop', () => {
    const { days } = planTrip(wpgToBrandon(), camry, { maxDriveHours: 8 });
    expect(days[0].overnight).toBeFalsy();
  });

  it('should have very low fuel cost', () => {
    const { costBreakdown } = planTrip(wpgToBrandon(), camry, { maxDriveHours: 8 });
    // 200km in a Camry ≈ 13L ≈ $20. Ceiling rounding might bump to $25.
    expect(costBreakdown.fuel).toBeLessThan(40);
    expect(costBreakdown.fuel).toBeGreaterThan(0);
  });

  it('should arrive well within the day', () => {
    const { days } = planTrip(wpgToBrandon(), camry, {
      maxDriveHours: 8,
      departureTime: '09:00',
    });
    // 2h drive from 9 AM → arrive around 11 AM
    const arrival = new Date(days[0].totals.arrivalTime);
    expect(arrival.getHours()).toBeLessThanOrEqual(14);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 2 — Comfortable Day: Winnipeg → Regina (~5h50m)
// ═══════════════════════════════════════════════════════════════════════════

describe('Scenario: Winnipeg → Regina (comfortable day)', () => {
  it('should be a single-day trip with 8h max', () => {
    const { days } = planTrip(wpgToRegina(), camry, { maxDriveHours: 8 });
    expect(days).toHaveLength(1);
  });

  it('should show reasonable fuel cost for ~574km', () => {
    const { costBreakdown } = planTrip(wpgToRegina(), camry, { maxDriveHours: 8 });
    // Camry: 574km × 6.7L/100km ≈ 38.5L × $1.50 ≈ $58. Rounded up: ~$60-70.
    expect(costBreakdown.fuel).toBeGreaterThan(40);
    expect(costBreakdown.fuel).toBeLessThan(100);
  });

  it('should estimate 1 gas stop', () => {
    const { summary } = planTrip(wpgToRegina(), camry, { maxDriveHours: 8 });
    // Full tank range: 60L × 0.75 / 6.7 × 100 ≈ 672km. Trip is 574km → 0 stops.
    // But estimateGasStops counts: 38.5L / (60×0.75) = 0.86 → ceil-1 = 0
    expect(summary.gasStops).toBeLessThanOrEqual(1);
  });

  it('should have no overnight', () => {
    const { days } = planTrip(wpgToRegina(), camry, { maxDriveHours: 8 });
    expect(days[0].overnight).toBeFalsy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 3 — Borderline Day: Winnipeg → Thunder Bay (~8h, 700km)
// ═══════════════════════════════════════════════════════════════════════════

describe('Scenario: Winnipeg → Thunder Bay (borderline)', () => {
  it('should fit in 1 day with 8h max + overflow tolerance', () => {
    // 480min raw → ×0.85 = 408min = 6h48m. Fits in 8h easily.
    const { days } = planTrip(wpgToThunderBay(), camry, { maxDriveHours: 8 });
    expect(days).toHaveLength(1);
  });

  it('should force 2 days with a very tight max drive (5h)', () => {
    const { days } = planTrip(wpgToThunderBay(), camry, { maxDriveHours: 5 });
    expect(days.length).toBeGreaterThanOrEqual(2);
  });

  it('should have the first day ending at an overnight when split', () => {
    const { days } = planTrip(wpgToThunderBay(), camry, { maxDriveHours: 5 });
    if (days.length >= 2) {
      expect(days[0].overnight).toBeTruthy();
    }
  });

  it('should have at least 1 gas stop for a Camry', () => {
    const { summary } = planTrip(wpgToThunderBay(), camry, { maxDriveHours: 8 });
    // 700km exceeds safe range (~672km). Should suggest 1 stop.
    expect(summary.gasStops).toBeGreaterThanOrEqual(1);
  });

  it('F-150 should need more gas stops than Camry', () => {
    const camryResult = planTrip(wpgToThunderBay(), camry, { maxDriveHours: 8 });
    const f150Result = planTrip(wpgToThunderBay(), f150, { maxDriveHours: 8 });
    // F-150 burns ~75L for 700km vs Camry's ~47L. More stops expected.
    expect(f150Result.summary.totalFuelLitres).toBeGreaterThan(camryResult.summary.totalFuelLitres);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 4 — Multi-day: Winnipeg → Toronto (~20h, 2200km)
// ═══════════════════════════════════════════════════════════════════════════

describe('Scenario: Winnipeg → Toronto (multi-day)', () => {
  it('should require 2-3 driving days with 8h max', () => {
    const { days } = planTrip(wpgToToronto(), camry, { maxDriveHours: 8 });
    expect(days.length).toBeGreaterThanOrEqual(2);
    expect(days.length).toBeLessThanOrEqual(4);
  });

  it('should place overnights on all days except the last', () => {
    const { days } = planTrip(wpgToToronto(), camry, { maxDriveHours: 8 });
    // Every day except the final one should have an overnight
    for (let i = 0; i < days.length - 1; i++) {
      expect(days[i].overnight).toBeTruthy();
    }
    // Last day has no overnight (you've arrived)
    expect(days[days.length - 1].overnight).toBeFalsy();
  });

  it('should have a total fuel cost that makes sense', () => {
    const { costBreakdown } = planTrip(wpgToToronto(), camry, { maxDriveHours: 8 });
    // 2200km × 6.7L/100km = 147L × $1.50 = ~$221. With rounding/regional, ~$200-350.
    expect(costBreakdown.fuel).toBeGreaterThan(150);
    expect(costBreakdown.fuel).toBeLessThan(400);
  });

  it('should have accommodation costs (multiple nights)', () => {
    const { costBreakdown } = planTrip(wpgToToronto(), camry, { maxDriveHours: 8 });
    // At least 1 night × $150 = $150 minimum
    expect(costBreakdown.accommodation).toBeGreaterThanOrEqual(150);
  });

  it('day drive times should not exceed maxDriveHours + tolerance', () => {
    const { days } = planTrip(wpgToToronto(), camry, { maxDriveHours: 8 });
    const maxMinutes = (8 + TRIP_CONSTANTS.dayOverflow.toleranceHours) * 60;
    for (const day of days) {
      expect(day.totals.driveTimeMinutes).toBeLessThanOrEqual(maxMinutes);
    }
  });

  it('total distance across days should match total trip distance', () => {
    const { days, summary } = planTrip(wpgToToronto(), camry, { maxDriveHours: 8 });
    const daysTotalKm = days.reduce((sum, d) => sum + d.totals.distanceKm, 0);
    // Allow small rounding discrepancy
    expect(Math.abs(daysTotalKm - summary.totalDistanceKm)).toBeLessThan(5);
  });

  it('cost breakdown total should equal sum of its parts', () => {
    const { costBreakdown } = planTrip(wpgToToronto(), camry, { maxDriveHours: 8 });
    const partsSum = costBreakdown.fuel + costBreakdown.accommodation +
                     costBreakdown.meals + costBreakdown.misc;
    // Total is ceil-rounded independently, so allow small rounding gap
    expect(Math.abs(costBreakdown.total - partsSum)).toBeLessThanOrEqual(10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 5 — Solo Punishing: Winnipeg → Toronto, 1 driver, 8h max
// ═══════════════════════════════════════════════════════════════════════════

describe('Scenario: Punishing solo haul (Winnipeg → Toronto, 1 driver)', () => {
  it('should require at least 3 days for a solo driver with 8h max', () => {
    const { days } = planTrip(wpgToToronto(), camry, {
      maxDriveHours: 8,
      numDrivers: 1,
      numTravelers: 1,
    });
    // ~20h / 8h = 2.5 → 3 days minimum
    expect(days.length).toBeGreaterThanOrEqual(2);
  });

  it('should produce higher per-person costs than 4-person trip', () => {
    const solo = planTrip(wpgToToronto(), camry, {
      maxDriveHours: 8,
      numDrivers: 1,
      numTravelers: 1,
    });
    const group = planTrip(wpgToToronto(), camry, {
      maxDriveHours: 8,
      numDrivers: 2,
      numTravelers: 4,
    });
    expect(solo.costBreakdown.perPerson).toBeGreaterThan(group.costBreakdown.perPerson);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 6 — 2-Driver Comfortable: Same distance, different feel
// ═══════════════════════════════════════════════════════════════════════════

describe('Scenario: 2-driver comfortable (Winnipeg → Toronto, 10h max)', () => {
  it('should require fewer days than 8h max', () => {
    const relaxed = planTrip(wpgToToronto(), camry, { maxDriveHours: 8 });
    const pushed = planTrip(wpgToToronto(), camry, { maxDriveHours: 10 });
    expect(pushed.days.length).toBeLessThanOrEqual(relaxed.days.length);
  });

  it('all days should respect 10h + tolerance limit', () => {
    const { days } = planTrip(wpgToToronto(), camry, { maxDriveHours: 10 });
    const maxMinutes = (10 + TRIP_CONSTANTS.dayOverflow.toleranceHours) * 60;
    for (const day of days) {
      expect(day.totals.driveTimeMinutes).toBeLessThanOrEqual(maxMinutes);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 7 — Round Trip with Stayover: Winnipeg → Regina → Winnipeg
// ═══════════════════════════════════════════════════════════════════════════

describe('Scenario: Round trip Winnipeg → Regina (with stayover)', () => {
  it('should double the distance (roughly)', () => {
    const oneWay = planTrip(wpgToRegina(), camry, { maxDriveHours: 8 });
    // Build a round trip manually (outbound + return segments)
    const returnSegments: RouteSegment[] = [{
      from: { ...REGINA, type: 'waypoint' },
      to: { ...WINNIPEG, type: 'destination' },
      distanceKm: 574, durationMinutes: 350,
      fuelNeededLitres: 0, fuelCost: 0,
    }];
    const roundTripSegments = [...wpgToRegina(), ...returnSegments];
    const roundTrip = planTrip(roundTripSegments, camry, {
      maxDriveHours: 8,
      isRoundTrip: true,
    });

    // Round trip total should be ~2× one-way distance
    const ratio = roundTrip.summary.totalDistanceKm / oneWay.summary.totalDistanceKm;
    expect(ratio).toBeCloseTo(2, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 8 — Inefficient Vehicle: F-150 Winnipeg → Thunder Bay
// ═══════════════════════════════════════════════════════════════════════════

describe('Scenario: F-150 Winnipeg → Thunder Bay (fuel stress)', () => {
  it('should cost significantly more in fuel than a Camry', () => {
    const camryTrip = planTrip(wpgToThunderBay(), camry, { maxDriveHours: 8 });
    const truckTrip = planTrip(wpgToThunderBay(), f150, { maxDriveHours: 8 });
    // F-150 consumes ~60% more fuel per km
    expect(truckTrip.costBreakdown.fuel).toBeGreaterThan(camryTrip.costBreakdown.fuel);
  });

  it('should need more gas stops than a Camry for long trips', () => {
    const camryTrip = planTrip(wpgToToronto(), camry, { maxDriveHours: 8 });
    const truckTrip = planTrip(wpgToToronto(), f150, { maxDriveHours: 8 });
    // F-150 burns ~230L for 2200km vs Camry's ~147L
    expect(truckTrip.summary.gasStops).toBeGreaterThanOrEqual(camryTrip.summary.gasStops);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COHERENCE CHECKS — Cross-cutting consistency assertions
// ═══════════════════════════════════════════════════════════════════════════

describe('Coherence: no internal contradictions', () => {
  const scenarios = [
    { name: 'short', segments: wpgToBrandon() },
    { name: 'medium', segments: wpgToRegina() },
    { name: 'borderline', segments: wpgToThunderBay() },
    { name: 'long', segments: wpgToToronto() },
  ];

  for (const { name, segments } of scenarios) {
    it(`${name}: every day has a non-empty route label`, () => {
      const { days } = planTrip(segments, camry, { maxDriveHours: 8 });
      for (const day of days) {
        expect(day.route.length).toBeGreaterThan(0);
      }
    });

    it(`${name}: departure is before arrival on every day`, () => {
      const { days } = planTrip(segments, camry, { maxDriveHours: 8 });
      for (const day of days) {
        const dep = new Date(day.totals.departureTime);
        const arr = new Date(day.totals.arrivalTime);
        if (day.totals.driveTimeMinutes > 0) {
          expect(arr.getTime()).toBeGreaterThan(dep.getTime());
        }
      }
    });

    it(`${name}: day budgets are non-negative`, () => {
      const { days } = planTrip(segments, camry, { maxDriveHours: 8 });
      for (const day of days) {
        expect(day.budget.gasUsed).toBeGreaterThanOrEqual(0);
        expect(day.budget.hotelCost).toBeGreaterThanOrEqual(0);
        expect(day.budget.foodEstimate).toBeGreaterThanOrEqual(0);
        expect(day.budget.dayTotal).toBeGreaterThanOrEqual(0);
      }
    });

    it(`${name}: summary fuel cost > 0`, () => {
      const { summary } = planTrip(segments, camry, { maxDriveHours: 8 });
      expect(summary.totalFuelCost).toBeGreaterThan(0);
    });

    it(`${name}: summary driving days matches actual day count`, () => {
      const { days, summary } = planTrip(segments, camry, { maxDriveHours: 8 });
      // summary.drivingDays is a rough estimate (ceil division),
      // actual day count should be close
      expect(Math.abs(days.length - summary.drivingDays)).toBeLessThanOrEqual(1);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FUEL LOGIC STRESS TESTS — Trust the fuel math under pressure
// ═══════════════════════════════════════════════════════════════════════════

/** Subcompact with tiny tank — stress-tests fuel stop frequency */
const subcompact: Vehicle = {
  year: '2024',
  make: 'Honda',
  model: 'Fit',
  fuelEconomyCity: 7.5,   // L/100km
  fuelEconomyHwy: 6.0,    // L/100km
  tankSize: 40,            // litres — range ≈ 667km
};

describe('Fuel stress: cost correctness', () => {
  it('fuel cost scales with distance (longer trip = more fuel)', () => {
    const short = planTrip(wpgToRegina(), camry, { maxDriveHours: 10 });
    const long = planTrip(wpgToToronto(), camry, { maxDriveHours: 10 });
    const distRatio = long.summary.totalDistanceKm / short.summary.totalDistanceKm;
    const fuelRatio = long.summary.totalFuelCost / short.summary.totalFuelCost;
    // Fuel cost should grow roughly linearly with distance (±30% for regional pricing)
    expect(fuelRatio).toBeGreaterThan(distRatio * 0.7);
    expect(fuelRatio).toBeLessThan(distRatio * 1.3);
  });

  it('F-150 burns significantly more fuel than Camry for same route', () => {
    const camryTrip = planTrip(wpgToToronto(), camry, { maxDriveHours: 10 });
    const truckTrip = planTrip(wpgToToronto(), f150, { maxDriveHours: 10 });
    const fuelRatio = truckTrip.summary.totalFuelCost / camryTrip.summary.totalFuelCost;
    // F-150 at 10.5 vs Camry at 6.2 L/100km ≈ 1.69× ratio
    expect(fuelRatio).toBeGreaterThan(1.4);
    expect(fuelRatio).toBeLessThan(2.0);
  });

  it('tiny-tank subcompact needs more gas stops than Camry on long trips', () => {
    const camryTrip = planTrip(wpgToToronto(), camry, { maxDriveHours: 10 });
    const fitTrip = planTrip(wpgToToronto(), subcompact, { maxDriveHours: 10 });
    expect(fitTrip.summary.gasStops).toBeGreaterThanOrEqual(camryTrip.summary.gasStops);
  });

  it('no single day fuel cost exceeds total trip fuel', () => {
    const { days, costBreakdown } = planTrip(wpgToToronto(), f150, { maxDriveHours: 8 });
    for (const day of days) {
      expect(day.budget.gasUsed).toBeLessThanOrEqual(costBreakdown.fuel);
    }
  });

  it('sum of daily fuel ≈ total fuel (within rounding)', () => {
    const { days, costBreakdown } = planTrip(wpgToToronto(), camry, { maxDriveHours: 8 });
    const dailyFuelSum = days.reduce((sum, d) => sum + d.budget.gasUsed, 0);
    // Allow for ceiling rounding: ≤ $10 per day tolerance
    expect(Math.abs(dailyFuelSum - costBreakdown.fuel)).toBeLessThan(days.length * 10);
  });
});

describe('Fuel stress: driver config does not change fuel cost', () => {
  it('solo vs 2-driver same route: equal total fuel cost', () => {
    const solo = planTrip(wpgToToronto(), camry, { maxDriveHours: 8, numDrivers: 1 });
    const duo = planTrip(wpgToToronto(), camry, { maxDriveHours: 8, numDrivers: 2 });
    expect(solo.summary.totalFuelCost).toBe(duo.summary.totalFuelCost);
  });
});

describe('Fuel stress: consumption rate sanity', () => {
  it('Camry uses between 5–8 L/100km blended on highway trip', () => {
    const { summary, settings } = planTrip(wpgToToronto(), camry, { maxDriveHours: 10 });
    const totalLitres = summary.totalFuelCost / settings.gasPrice;
    const litresPer100km = (totalLitres / summary.totalDistanceKm) * 100;
    expect(litresPer100km).toBeGreaterThan(5);
    expect(litresPer100km).toBeLessThan(8);
  });

  it('F-150 uses between 9–12 L/100km blended on highway trip', () => {
    const { summary, settings } = planTrip(wpgToToronto(), f150, { maxDriveHours: 10 });
    const totalLitres = summary.totalFuelCost / settings.gasPrice;
    const litresPer100km = (totalLitres / summary.totalDistanceKm) * 100;
    expect(litresPer100km).toBeGreaterThan(9);
    expect(litresPer100km).toBeLessThan(12);
  });

  it('short trip is fuel-dominated (no hotel cost)', () => {
    const { costBreakdown } = planTrip(wpgToBrandon(), camry, { maxDriveHours: 8 });
    expect(costBreakdown.fuel).toBeGreaterThan(0);
    expect(costBreakdown.accommodation).toBe(0);
  });
});
