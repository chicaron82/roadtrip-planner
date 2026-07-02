/**
 * stop-display-helpers.ts — unit tests
 *
 * Pure presentation helpers extracted from the stop-suggestions engine. No mocks.
 * Covers the stop-type → colour mapping and the settings → StopSuggestionConfig
 * wiring (asserted against the same unit helpers it delegates to, so the test
 * locks the wiring without hard-coding derived magic numbers).
 */

import { describe, it, expect } from 'vitest';
import type { Vehicle, TripSettings } from '../types';
import { getStopColors, createStopConfig } from './stop-display-helpers';
import { getTankSizeLitres, getWeightedFuelEconomyL100km } from './unit-conversions';
import { getTripStartTime } from './trip-timezone';
import type { SuggestionStopType } from './stop-suggestion-types';

// createStopConfig only reads these six fields; cast a minimal fixture.
const VEHICLE = {
  id: 'v1',
  name: 'Test Van',
  tankSize: 60,        // litres (metric)
  fuelEconomyHwy: 8.0, // L/100km (metric)
  fuelEconomyCity: 12.0,
  type: 'car',
} as Vehicle;

const SETTINGS = {
  units: 'metric',
  maxDriveHours: 9,
  numDrivers: 2,
  departureDate: '2026-07-01',
  departureTime: '08:00',
  gasPrice: 1.65,
} as TripSettings;

describe('getStopColors', () => {
  it('maps each known stop type to its own scheme', () => {
    expect(getStopColors('fuel')).toEqual({ bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' });
    expect(getStopColors('rest')).toEqual({ bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' });
    expect(getStopColors('meal')).toEqual({ bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' });
    expect(getStopColors('overnight')).toEqual({ bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' });
  });

  it('falls back to slate for an unknown type', () => {
    expect(getStopColors('mystery' as SuggestionStopType)).toEqual({
      bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700',
    });
  });
});

describe('createStopConfig', () => {
  it('derives tank size and fuel economy via the unit helpers', () => {
    const config = createStopConfig(VEHICLE, SETTINGS);
    expect(config.tankSizeLitres).toBe(getTankSizeLitres(VEHICLE, SETTINGS.units));
    expect(config.fuelEconomyL100km).toBe(getWeightedFuelEconomyL100km(VEHICLE, SETTINGS.units));
  });

  it('passes settings through to the config unchanged', () => {
    const config = createStopConfig(VEHICLE, SETTINGS);
    expect(config.maxDriveHoursPerDay).toBe(SETTINGS.maxDriveHours);
    expect(config.numDrivers).toBe(SETTINGS.numDrivers);
    expect(config.gasPrice).toBe(SETTINGS.gasPrice);
  });

  it('carries the optional geometry through, and computes departure from settings', () => {
    const geometry = [[-97.1, 49.9], [-98.0, 50.1]];
    const config = createStopConfig(VEHICLE, SETTINGS, geometry);
    expect(config.fullGeometry).toBe(geometry);
    expect(config.departureTime).toEqual(getTripStartTime(SETTINGS.departureDate, SETTINGS.departureTime));
  });

  it('resolves departure in the origin timezone when a longitude is given', () => {
    const originLng = -99.95; // Manitoba
    const config = createStopConfig(VEHICLE, SETTINGS, undefined, originLng);
    expect(config.departureTime).toEqual(
      getTripStartTime(SETTINGS.departureDate, SETTINGS.departureTime, originLng),
    );
  });
});
