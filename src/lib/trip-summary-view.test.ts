import { describe, expect, it } from 'vitest';
import { getExportBudgetBreakdown, getPrimaryDestination, getTripDayCounts } from './trip-summary-view';
import { makeDay, makeLocation, makeSegment, makeSummary } from '../test/fixtures';

describe('trip-summary-view helpers', () => {
  it('uses the round-trip midpoint destination as the primary destination', () => {
    const origin = { ...makeLocation('Winnipeg, MB', 49.89, -97.13), type: 'origin' as const };
    const regina = makeLocation('Regina, SK', 50.45, -104.61);
    const summary = makeSummary({
      segments: [
        makeSegment({ from: origin, to: regina, _originalIndex: 0 }),
        makeSegment({ from: regina, to: origin, _originalIndex: 1 }),
      ],
      roundTripMidpoint: 1,
    });

    expect(getPrimaryDestination(summary)?.name).toBe('Regina, SK');
  });

  it('prefers planner-known cost breakdown values for export', () => {
    const summary = makeSummary({
      totalFuelCost: 120,
      costBreakdown: {
        fuel: 120,
        accommodation: 300,
        meals: 180,
        misc: 25,
        total: 625,
        perPerson: 312.5,
      },
    });

    expect(getExportBudgetBreakdown(summary)).toEqual({
      fuel: 120,
      accommodation: 300,
      meals: 180,
      misc: 25,
    });
  });

  it('counts driving and free days separately', () => {
    const summary = makeSummary([
      makeDay({ dayNumber: 1 }),
      makeDay({ dayNumber: 2, date: '2025-08-17', route: 'Free Day', segmentIndices: [], segments: [] }),
    ]);

    expect(getTripDayCounts(summary)).toEqual({
      drivingDays: 1,
      freeDays: 1,
      totalDays: 2,
    });
  });
});