import { describe, expect, it } from 'vitest';
import { buildPlannerRationale } from './planner-rationale';
import { makeDay, makeSettings, makeSummary } from '../test/fixtures';

describe('buildPlannerRationale', () => {
  it('explains multi-day splits from existing planner signals', () => {
    const summary = makeSummary([
      makeDay({ dayNumber: 1, totals: { distanceKm: 500, driveTimeMinutes: 600, stopTimeMinutes: 20, departureTime: '2025-08-16T09:00:00', arrivalTime: '2025-08-16T19:20:00' } }),
      makeDay({ dayNumber: 2, date: '2025-08-17', totals: { distanceKm: 450, driveTimeMinutes: 540, stopTimeMinutes: 30, departureTime: '2025-08-17T09:00:00', arrivalTime: '2025-08-17T18:30:00' } }),
    ], { totalDurationMinutes: 1140, gasStops: 3 });

    const items = buildPlannerRationale(
      summary,
      makeSettings({ maxDriveHours: 8, stopFrequency: 'balanced' }),
      null,
    );

    expect(items[0]?.label).toBe('Day split');
    expect(items[0]?.message).toContain('Split into 2 driving days');
    expect(items.some(item => item.label === 'Fuel rhythm')).toBe(true);
  });

  it('points to the main over-budget category when budget pressure exists', () => {
    const summary = makeSummary({
      costBreakdown: {
        fuel: 550,
        accommodation: 1100,
        meals: 250,
        misc: 20,
        total: 1920,
        perPerson: 480,
      },
    });

    const items = buildPlannerRationale(summary, makeSettings(), null);
    const budget = items.find(item => item.label === 'Budget');

    expect(budget?.message).toContain('hotels');
  });
});