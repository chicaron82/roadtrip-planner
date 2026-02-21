/**
 * Shared unit conversion utilities.
 * Consolidates formulas that were copy-pasted across 5+ files.
 */

import {
  LITRES_PER_GALLON,
  MPG_TO_L100KM_FACTOR,
  HIGHWAY_FUEL_WEIGHT,
  CITY_FUEL_WEIGHT,
  USABLE_TANK_FRACTION,
} from './constants';
import type { Vehicle, UnitSystem } from '../types';

/** Convert vehicle tank size to litres regardless of unit system. */
export function getTankSizeLitres(vehicle: Vehicle, units: UnitSystem): number {
  return units === 'metric' ? vehicle.tankSize : vehicle.tankSize * LITRES_PER_GALLON;
}

/**
 * Blended fuel economy in L/100km (80% highway, 20% city).
 * Handles both metric (L/100km input) and imperial (MPG input) vehicles.
 */
export function getWeightedFuelEconomyL100km(vehicle: Vehicle, units: UnitSystem): number {
  if (units === 'metric') {
    return vehicle.fuelEconomyHwy * HIGHWAY_FUEL_WEIGHT + vehicle.fuelEconomyCity * CITY_FUEL_WEIGHT;
  }
  return convertMpgToL100km(vehicle.fuelEconomyHwy) * HIGHWAY_FUEL_WEIGHT +
         convertMpgToL100km(vehicle.fuelEconomyCity) * CITY_FUEL_WEIGHT;
}

/**
 * Estimate number of gas stops needed for a trip.
 * Assumes starting with a full tank and refuelling at USABLE_TANK_FRACTION capacity.
 */
export function estimateGasStops(totalFuelLitres: number, tankSizeLitres: number): number {
  return Math.max(0, Math.ceil(totalFuelLitres / (tankSizeLitres * USABLE_TANK_FRACTION)) - 1);
}

export function convertMpgToL100km(mpg: number): number {
  if (mpg === 0) return 0;
  return MPG_TO_L100KM_FACTOR / mpg;
}

export function convertL100kmToMpg(l100km: number): number {
  if (l100km === 0) return 0;
  return MPG_TO_L100KM_FACTOR / l100km;
}

export function convertLitresToGallons(litres: number): number {
  return litres / LITRES_PER_GALLON;
}

export function convertGallonsToLitres(gallons: number): number {
  return gallons * LITRES_PER_GALLON;
}
