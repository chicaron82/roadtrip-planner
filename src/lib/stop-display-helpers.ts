/**
 * stop-display-helpers.ts — UI utilities for stop display
 *
 * Extracted from stop-suggestions.ts. These are pure presentation
 * concerns and should not live in the simulation engine.
 *
 * 💚 My Experience Engine
 */

import type { Vehicle, TripSettings } from '../types';
import { getTankSizeLitres, getWeightedFuelEconomyL100km } from './unit-conversions';
import type { SuggestionStopType, StopSuggestionConfig } from './stop-suggestion-types';

/**
 * Get stop icon emoji
 */
export function getStopIcon(type: SuggestionStopType): string {
  switch (type) {
    case 'fuel': return '⛽';
    case 'rest': return '☕';
    case 'meal': return '🍽️';
    case 'overnight': return '🏨';
    default: return '📍';
  }
}

/**
 * Get stop color scheme
 */
export function getStopColors(type: SuggestionStopType): { bg: string; border: string; text: string } {
  switch (type) {
    case 'fuel':
      return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' };
    case 'rest':
      return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' };
    case 'meal':
      return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' };
    case 'overnight':
      return { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' };
    default:
      return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700' };
  }
}

/**
 * Convert settings to stop simulation config
 */
export function createStopConfig(
  vehicle: Vehicle,
  settings: TripSettings,
  fullGeometry?: number[][],
): StopSuggestionConfig {
  const tankSizeLitres = getTankSizeLitres(vehicle, settings.units);
  const fuelEconomyL100km = getWeightedFuelEconomyL100km(vehicle, settings.units);

  return {
    tankSizeLitres,
    fuelEconomyL100km,
    maxDriveHoursPerDay: settings.maxDriveHours,
    numDrivers: settings.numDrivers,
    departureTime: new Date(`${settings.departureDate}T${settings.departureTime}`),
    gasPrice: settings.gasPrice,
    fullGeometry,
  };
}
