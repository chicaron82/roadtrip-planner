import { describe, expect, it } from 'vitest';
import { buildAcceptedItineraryProjection } from './accepted-itinerary-projection';
import { makeDay, makeSettings, makeSummary } from '../test/fixtures';
import type { SuggestedStop } from './stop-suggestion-types';

describe('buildAcceptedItineraryProjection', () => {
  it('builds a shared accepted-itinerary projection for downstream consumers', () => {
    const day = makeDay({
      totals: {
        distanceKm: 400,
        driveTimeMinutes: 240,
        stopTimeMinutes: 0,
        departureTime: '2025-08-16T09:00:00',
        arrivalTime: '2025-08-16T13:00:00',
      },
    });
    const summary = makeSummary([day]);
    const acceptedFuel: SuggestedStop = {
      id: 'fuel-accepted-1',
      type: 'fuel',
      reason: 'Fuel stop',
      afterSegmentIndex: 0,
      estimatedTime: new Date('2025-08-16T11:00:00Z'),
      duration: 15,
      priority: 'recommended',
      details: { fuelCost: 40, fuelNeeded: 30, fillType: 'full' },
      accepted: true,
      dayNumber: 1,
    };

    const projection = buildAcceptedItineraryProjection({
      summary,
      settings: makeSettings(),
      days: [day],
      startTime: new Date('2025-08-16T09:00:00Z'),
      activeSuggestions: [acceptedFuel],
    });

    expect(projection.acceptedItinerary.summary).toBe(summary);
    expect(projection.acceptedItinerary.days).toHaveLength(1);
    expect(Array.isArray(projection.simulationItems)).toBe(true);
    expect(projection.dayStartMap.size).toBeGreaterThan(0);
  });
});