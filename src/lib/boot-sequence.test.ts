/**
 * boot-sequence.ts — unit tests
 *
 * The three things that shape a trip before the user touches anything: a shared URL, the last
 * origin they used, and adaptive cost defaults. Pure functions over setters — no mocks beyond vi.fn.
 *
 * ⭐ The load-bearing rule is `hasCalculableRoute`: a shared link only jumps straight to Step 3 when
 * BOTH ends are real coordinates. A (0,0) placeholder at either end must leave the wizard at Step 1,
 * or the user lands on a Calculate button for a route that cannot be routed.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  bootTripInputsFromURLState, applyLastOriginToTripInputs, applyAdaptiveCostDefaults,
} from './boot-sequence';
import type { Location, TripSettings, Vehicle } from '../types';

const loc = (id: string, lat: number, lng: number, type: Location['type'] = 'waypoint') =>
  ({ id, name: id, lat, lng, type }) as Location;

const WPG = loc('wpg', 49.9, -97.1, 'origin');
const GIMLI = loc('gimli', 50.6, -96.99, 'destination');
const BLANK = loc('blank', 0, 0, 'destination');

function setters() {
  return {
    setLocations: vi.fn(),
    setVehicle: vi.fn(),
    setSettings: vi.fn(),
    markStepComplete: vi.fn(),
    forceStep: vi.fn(),
  };
}

describe('bootTripInputsFromURLState', () => {
  it('does nothing and reports false when there is no URL state', () => {
    const s = setters();
    expect(bootTripInputsFromURLState({ parsedState: null, ...s })).toBe(false);
    for (const fn of Object.values(s)) expect(fn).not.toHaveBeenCalled();
  });

  it('a calculable shared route completes steps 1–3 and lands on Step 3', () => {
    const s = setters();
    const ok = bootTripInputsFromURLState({ parsedState: { locations: [WPG, GIMLI] }, ...s });
    expect(ok).toBe(true);
    expect(s.setLocations).toHaveBeenCalledWith([WPG, GIMLI]);
    expect(s.markStepComplete.mock.calls.map(c => c[0])).toEqual([1, 2, 3]);
    expect(s.forceStep).toHaveBeenCalledWith(3);
  });

  it('a placeholder destination at (0,0) loads the stops but does NOT skip ahead', () => {
    const s = setters();
    expect(bootTripInputsFromURLState({ parsedState: { locations: [WPG, BLANK] }, ...s })).toBe(true);
    expect(s.setLocations).toHaveBeenCalledWith([WPG, BLANK]);
    expect(s.markStepComplete).not.toHaveBeenCalled();
    expect(s.forceStep).not.toHaveBeenCalled();
  });

  it('a placeholder ORIGIN blocks the skip too — both ends must be real', () => {
    const s = setters();
    bootTripInputsFromURLState({ parsedState: { locations: [loc('o', 0, 0, 'origin'), GIMLI] }, ...s });
    expect(s.forceStep).not.toHaveBeenCalled();
  });

  it('a single location is not a route', () => {
    const s = setters();
    bootTripInputsFromURLState({ parsedState: { locations: [WPG] }, ...s });
    expect(s.forceStep).not.toHaveBeenCalled();
  });

  it('only the parts present in the URL are applied', () => {
    const s = setters();
    const vehicle = { name: 'RAV4' } as unknown as Vehicle;
    bootTripInputsFromURLState({ parsedState: { vehicle }, ...s });
    expect(s.setVehicle).toHaveBeenCalledWith(vehicle);
    expect(s.setLocations).not.toHaveBeenCalled();
    expect(s.setSettings).not.toHaveBeenCalled();
    expect(s.forceStep).not.toHaveBeenCalled();   // no locations → nothing to calculate
  });

  it('settings from the URL are applied as given', () => {
    const s = setters();
    const settings = { numTravelers: 3 } as unknown as TripSettings;
    bootTripInputsFromURLState({ parsedState: { settings }, ...s });
    expect(s.setSettings).toHaveBeenCalledWith(settings);
  });
});

/** Run a setState-style updater the way React would, against a given previous value. */
function runUpdater<T>(setter: ReturnType<typeof vi.fn>, prev: T): T {
  const arg = setter.mock.calls[0][0];
  return typeof arg === 'function' ? (arg as (p: T) => T)(prev) : arg;
}

describe('applyLastOriginToTripInputs', () => {
  it('does nothing when there is no remembered origin', () => {
    const setLocations = vi.fn();
    applyLastOriginToTripInputs(setLocations, null);
    expect(setLocations).not.toHaveBeenCalled();
  });

  it('replaces only the first stop, keeping its slot id and origin type', () => {
    const setLocations = vi.fn();
    const remembered = loc('remembered-id', 49.9, -97.1, 'destination');
    applyLastOriginToTripInputs(setLocations, remembered);

    const prev = [loc('slot-0', 0, 0, 'origin'), GIMLI];
    const next = runUpdater(setLocations, prev);
    expect(next[0]).toMatchObject({ lat: 49.9, lng: -97.1, id: 'slot-0', type: 'origin' });
    expect(next[1]).toBe(GIMLI);                  // the rest of the trip is untouched
  });
});

describe('applyAdaptiveCostDefaults', () => {
  it('does nothing without learned defaults', () => {
    const setSettings = vi.fn();
    applyAdaptiveCostDefaults(setSettings, null);
    expect(setSettings).not.toHaveBeenCalled();
  });

  it('overrides only hotel and meal prices, leaving every other setting alone', () => {
    const setSettings = vi.fn();
    applyAdaptiveCostDefaults(setSettings, { hotelPricePerNight: 140, mealPricePerDay: 55 });
    const prev = { hotelPricePerNight: 100, mealPricePerDay: 40, numTravelers: 2 } as unknown as TripSettings;
    const next = runUpdater(setSettings, prev);
    expect(next).toEqual({ hotelPricePerNight: 140, mealPricePerDay: 55, numTravelers: 2 });
  });
});
