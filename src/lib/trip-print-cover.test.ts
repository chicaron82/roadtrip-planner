/**
 * trip-print-cover.test.ts
 *
 * Tests the date range logic in the brand tagline ("Your MEE time — March 15, 2026").
 * Three cases: single day (no range), same-month range, cross-month range.
 */

import { describe, it, expect } from 'vitest';
import type { TripDay, TripSettings } from '../types';
import type { PrintCoverSummary } from './trip-summary-slices';
import type { FeasibilityResult } from './feasibility/types';
import { buildCoverPageHTML } from './trip-print-cover';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeDay(date: string, dateFormatted: string): TripDay {
  return {
    dayNumber: 1,
    date,
    dateFormatted,
    route: 'A → B',
    segments: [],
    segmentIndices: [],
    timezoneChanges: [],
    budget: { gasUsed: 0, hotelCost: 0, foodEstimate: 0, miscCost: 0, dayTotal: 0, bankRemaining: 0 },
    totals: { distanceKm: 0, driveTimeMinutes: 0, stopTimeMinutes: 0, departureTime: '', arrivalTime: '' },
  } as TripDay;
}

function makeSummary(days: TripDay[]): PrintCoverSummary {
  return {
    days,
    totalDistanceKm: 398,
    totalDurationMinutes: 256,
    costBreakdown: { fuel: 45, accommodation: 0, meals: 135, misc: 0, total: 180, perPerson: 45 },
  };
}

function makeSettings(): TripSettings {
  return {
    units: 'metric',
    currency: 'CAD',
    maxDriveHours: 10,
    numTravelers: 4,
    numDrivers: 1,
    budgetMode: 'plan-to-budget',
    budget: {
      mode: 'plan-to-budget', allocation: 'flexible', profile: 'balanced',
      weights: { gas: 25, hotel: 35, food: 30, misc: 10 },
      gas: 0, hotel: 0, food: 0, misc: 0, total: 0,
    },
    departureDate: '2026-03-15',
    departureTime: '09:00',
    returnDate: '',
    arrivalDate: '',
    arrivalTime: '',
    isRoundTrip: true,
    avoidTolls: false,
    avoidBorders: false,
    scenicMode: false,
  } as TripSettings;
}

function makeFeasibility(): FeasibilityResult {
  return {
    status: 'on-track',
    warnings: [],
    summary: {
      totalBudgetUsed: 180, totalBudgetAvailable: 0, budgetUtilization: 0,
      longestDriveDay: 256, maxDriveLimit: 600, perPersonCost: 45, totalDays: 1,
    },
  };
}

function buildHTML(days: TripDay[]): string {
  return buildCoverPageHTML(
    'Test Trip',
    makeSummary(days),
    makeSettings(),
    makeFeasibility(),
    null,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildCoverPageHTML — brand tagline date range', () => {
  it('single day: shows "Month DD, YYYY" with no en-dash', () => {
    const html = buildHTML([makeDay('2026-03-15', 'Sun, Mar 15')]);
    expect(html).toContain('March 15, 2026');
    expect(html).not.toMatch(/March 15[–-]15/);
  });

  it('same-month range: shows "Month DD–DD, YYYY"', () => {
    const html = buildHTML([
      makeDay('2026-03-15', 'Sun, Mar 15'),
      makeDay('2026-03-20', 'Fri, Mar 20'),
    ]);
    expect(html).toContain('March 15–20, 2026');
  });

  it('cross-month range: shows "Month DD – Month DD, YYYY"', () => {
    const html = buildHTML([
      makeDay('2026-03-28', 'Sat, Mar 28'),
      makeDay('2026-04-02', 'Thu, Apr 2'),
    ]);
    expect(html).toContain('March 28 – April 2, 2026');
  });

  it('no days: tagline shows no date', () => {
    const html = buildHTML([]);
    expect(html).toContain('Your MEE time</div>');
    expect(html).not.toMatch(/Your MEE time — /);
  });
});
