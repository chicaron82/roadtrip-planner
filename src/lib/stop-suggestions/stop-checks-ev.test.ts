import { describe, it, expect } from 'vitest';
import { checkEVChargeStop, getEnRouteChargeStops } from './stop-checks-ev';
import type { RouteSegment, Location } from '../../types';
import type { StopSuggestionConfig } from '../stop-suggestion-types';
import type { SimState } from './types';
import { TRIP_CONSTANTS } from '../trip-constants';

// --- Mocks ---
export function createMockConfig(overrides: Partial<StopSuggestionConfig> = {}): StopSuggestionConfig {
  return {
    isEV: true,
    tankSizeLitres: 75, // Treated as kWh for EV
    rangeKm: 400,
    fuelEconomyL100km: 20, 
    maxDriveHoursPerDay: 8,
    numDrivers: 1,
    gasPrice: 1.5,
    departureTime: new Date('2026-03-26T08:00:00'),
    ...overrides,
  };
}

export function createMockState(overrides: Partial<SimState> = {}): SimState {
  return {
    currentTime: new Date('2026-03-26T10:00:00'),
    totalDrivingToday: 2,
    lastBreakTime: new Date('2026-03-26T08:00:00'),
    hoursOnRoad: 2,
    currentFuel: 75 * TRIP_CONSTANTS.ev.chargeToLimit, // 80% full (60kWh)
    distanceSinceLastFill: 150,
    hoursSinceLastFill: 2,
    costSinceLastFill: 0,
    currentTzAbbr: 'EDT',
    currentDayNumber: 1,
    comfortRefuelHours: 2.5,
    restBreakInterval: 2,
    ...overrides,
  };
}

export function createMockSegment(overrides: Partial<RouteSegment> = {}): RouteSegment {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: { id: 'orig', type: 'destination' as any, name: 'Origin', lat: 43.6, lng: -79.3 } as Location,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    to: { id: 'dest', type: 'destination' as any, name: 'Destination', lat: 45.4, lng: -75.7 } as Location,
    distanceKm: 200,
    durationMinutes: 120,
    fuelNeededLitres: 0,
    fuelCost: 0,
    ...overrides,
  };
}

// --- Scaffolding ---
describe('EV Routing Stop Checks', () => {
  describe('checkEVChargeStop', () => {
    it('forces a required top-up when battery would run critically low', () => {
      const state = createMockState({ currentFuel: 10, distanceSinceLastFill: 350 }); // low battery
      const segment = createMockSegment({ distanceKm: 150 }); 
      const config = createMockConfig();
      const safeRangeKm = 320; // 80% of 400

      const result = checkEVChargeStop(state, segment, 1, config, safeRangeKm);
      expect(result.suggestion).toBeDefined();
      expect(result.suggestion?.priority).toBe('required');
      expect(result.suggestion?.type).toBe('fuel');
      expect(result.suggestion?.reason).toContain('Critical: charge up');
    });

    it('suggests a comfort refuel when hours threshold is met', () => {
      const state = createMockState({ hoursSinceLastFill: 3, currentFuel: 50 }); 
      const segment = createMockSegment({ distanceKm: 50 });
      const config = createMockConfig();
      const safeRangeKm = 320; 

      const result = checkEVChargeStop(state, segment, 1, config, safeRangeKm);
      expect(result.suggestion).toBeDefined();
      expect(result.suggestion?.priority).not.toBe('required'); // Should be recommended
      expect(result.suggestion?.reason).toContain('good time to stretch');
    });

    it('returns null if arriving at final segment with sufficient charge', () => {
      const state = createMockState({ currentFuel: 30, distanceSinceLastFill: 0, hoursSinceLastFill: 0 }); // Enough to finish safely even in winter
      const segment = createMockSegment({ distanceKm: 50 }); 
      const config = createMockConfig();
      
      const result = checkEVChargeStop(state, segment, 1, config, 320, true);
      expect(result.suggestion).toBeNull();
    });

    it('sets the next tank percentage correctly back up to 80%', () => {
      const state = createMockState({ currentFuel: 5 }); 
      const segment = createMockSegment();
      const config = createMockConfig();

      const origTime = state.currentTime.getTime();
      const result = checkEVChargeStop(state, segment, 1, config, 320);
      
      expect(state.currentFuel).toBe(75 * TRIP_CONSTANTS.ev.chargeToLimit);
      expect(state.distanceSinceLastFill).toBe(0);
      expect(state.hoursSinceLastFill).toBe(0);
      
      // Stop added time (30 or 45 mins)
      expect(result.stopTimeAddedMs).toBeGreaterThan(0);
      expect(state.currentTime.getTime()).toBe(origTime + result.stopTimeAddedMs);
    });
  });

  describe('getEnRouteChargeStops', () => {
    it('generates multiple charge stops on a long segment bridging cities', () => {
      const state = createMockState({ currentFuel: 60 }); 
      const segment = createMockSegment({ distanceKm: 1000, durationMinutes: 600 });
      const config = createMockConfig();
      const safeRangeKm = 320; 

      const result = getEnRouteChargeStops(state, segment, 1, config, safeRangeKm, new Date(), 0);
      
      expect(result.stops.length).toBeGreaterThan(1);
      
      const firstStop = result.stops[0];
      expect(firstStop.type).toBe('fuel');
      expect(firstStop.priority).toBeDefined();
      expect(firstStop.details?.tankPercent).toBeDefined();
    });

    it('snaps charge stops to specified hubs if a resolver is provided', () => {
      const state = createMockState({ currentFuel: 60 }); 
      const segment = createMockSegment({ distanceKm: 500, durationMinutes: 300 });
      const config = createMockConfig();
      const safeRangeKm = 320; 
      
      // Mock resolver that returns "Test Hub" at km 300
      const hubResolver = (km: number) => Math.abs(km - 300) < 10 ? 'Test Hub' : undefined;

      const result = getEnRouteChargeStops(state, segment, 1, config, safeRangeKm, new Date(), 0, hubResolver);
      
      expect(result.stops.length).toBeGreaterThan(0);
      expect(result.stops[0].hubName).toBe('Test Hub');
      expect(result.stops[0].reason).toContain('in Test Hub');
    });

    it('applies combo meal (lunch/dinner) labels around eating windows', () => {
      const state = createMockState(); 
      const segment = createMockSegment({ distanceKm: 500, durationMinutes: 300 });
      const config = createMockConfig();
      
      // Stop is around 3.2 hours in. Start at 9am to land at 12:12pm for lunch.
      const startTime = new Date('2026-03-26T09:00:00');
      
      const result = getEnRouteChargeStops(state, segment, 1, config, 320, startTime, 0);
      
      expect(result.stops.length).toBeGreaterThan(0);
      expect(result.stops[0].details?.comboMeal).toBe(true);
      expect(result.stops[0].duration).toBe(45); // Lunch adds 15m
    });
  });
});
