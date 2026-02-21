/**
 * Shared conversion constants used across the Experience Engine.
 * Single source of truth — no more magic numbers scattered in 5+ files.
 */

/** Litres per US gallon */
export const LITRES_PER_GALLON = 3.78541;

/** Kilometres to miles conversion factor */
export const KM_TO_MILES = 0.621371;

/** MPG ↔ L/100km conversion factor: L/100km = 235.215 / mpg */
export const MPG_TO_L100KM_FACTOR = 235.215;

/** Highway driving weight for blended fuel economy (80% highway, 20% city) */
export const HIGHWAY_FUEL_WEIGHT = 0.8;

/** City driving weight for blended fuel economy */
export const CITY_FUEL_WEIGHT = 0.2;

/** Fraction of tank considered usable before triggering a fuel stop */
export const USABLE_TANK_FRACTION = 0.75;
