/**
 * ═══════════════════════════════════════════════════════════
 * THE EXPERIENCE ENGINE — ESTIMATE SERVICE
 * "You know where you're going. Let's find out what it costs."
 *
 * Pure cost estimation logic — no DOM, no React.
 * Takes route distance, vehicle, party size → cost breakdown.
 * ═══════════════════════════════════════════════════════════
 */
import type { Vehicle, TripSettings, TripSummary, UnitSystem } from '../types';

/** Regional cost averages (CAD-centric, convertible) */
const ESTIMATES = {
  /** Hotel per night (per room) */
  hotel: { low: 90, mid: 140, high: 220 },
  /** Food per person per day */
  food: { low: 30, mid: 50, high: 80 },
  /** Misc per person per day (activities, parking, tips) */
  misc: { low: 10, mid: 25, high: 50 },
  /** Average gas price CAD/L fallback */
  gasPricePerLitre: 1.55,
  /** Average gas price USD/gal fallback */
  gasPricePerGallon: 3.50,
  /** Rooms needed per N travelers */
  travelersPerRoom: 2,
};

export interface EstimateBreakdownItem {
  category: string;
  emoji: string;
  low: number;
  mid: number;
  high: number;
  perPerson?: { low: number; mid: number; high: number };
  note?: string;
}

export interface TripEstimate {
  totalLow: number;
  totalMid: number;
  totalHigh: number;
  perPersonLow: number;
  perPersonMid: number;
  perPersonHigh: number;
  breakdown: EstimateBreakdownItem[];
  days: number;
  nights: number;
  distanceKm: number;
  numTravelers: number;
  currency: string;
}

/**
 * Calculate fuel cost for a trip based on vehicle and distance.
 */
function estimateFuelCost(
  distanceKm: number,
  vehicle: Vehicle,
  units: UnitSystem,
  gasPrice?: number
): { low: number; mid: number; high: number } {
  // Use highway economy (most of a road trip is highway)
  const fuelEconomy = vehicle.fuelEconomyHwy || vehicle.fuelEconomyCity || 10;

  if (units === 'metric') {
    // L/100km
    const litres = (distanceKm * fuelEconomy) / 100;
    const price = gasPrice || ESTIMATES.gasPricePerLitre;
    const mid = litres * price;
    return { low: mid * 0.85, mid, high: mid * 1.20 };
  } else {
    // MPG
    const distanceMiles = distanceKm * 0.621371;
    const gallons = distanceMiles / fuelEconomy;
    const price = gasPrice || ESTIMATES.gasPricePerGallon;
    const mid = gallons * price;
    return { low: mid * 0.85, mid, high: mid * 1.20 };
  }
}

/**
 * Generate a full trip cost estimate.
 *
 * @param summary  — Calculated route summary (for distance/days)
 * @param vehicle  — User's vehicle (for fuel calc)
 * @param settings — Trip settings (travelers, units, etc.)
 */
export function generateEstimate(
  summary: TripSummary,
  vehicle: Vehicle,
  settings: TripSettings,
): TripEstimate {
  const distanceKm = settings.isRoundTrip
    ? summary.totalDistanceKm * 2
    : summary.totalDistanceKm;

  const days = summary.days?.length || Math.max(1, Math.ceil(summary.totalDurationMinutes / (settings.maxDriveHours * 60)));
  const nights = Math.max(0, days - 1);
  const numTravelers = settings.numTravelers || 1;
  const roomsNeeded = Math.ceil(numTravelers / ESTIMATES.travelersPerRoom);

  const currencySymbol = settings.currency === 'USD' ? '$' : 'C$';

  // ── Fuel ──
  const fuel = estimateFuelCost(distanceKm, vehicle, settings.units, settings.gasPrice || undefined);

  // ── Hotels ──
  const hotel = {
    low: nights * roomsNeeded * ESTIMATES.hotel.low,
    mid: nights * roomsNeeded * ESTIMATES.hotel.mid,
    high: nights * roomsNeeded * ESTIMATES.hotel.high,
  };

  // ── Food ──
  const food = {
    low: days * numTravelers * ESTIMATES.food.low,
    mid: days * numTravelers * ESTIMATES.food.mid,
    high: days * numTravelers * ESTIMATES.food.high,
  };

  // ── Misc ──
  const misc = {
    low: days * numTravelers * ESTIMATES.misc.low,
    mid: days * numTravelers * ESTIMATES.misc.mid,
    high: days * numTravelers * ESTIMATES.misc.high,
  };

  // ── Totals ──
  const totalLow = fuel.low + hotel.low + food.low + misc.low;
  const totalMid = fuel.mid + hotel.mid + food.mid + misc.mid;
  const totalHigh = fuel.high + hotel.high + food.high + misc.high;

  const breakdown: EstimateBreakdownItem[] = [
    {
      category: 'Fuel',
      emoji: '⛽',
      ...fuel,
      note: `${distanceKm.toFixed(0)} km ${settings.isRoundTrip ? '(round trip)' : '(one way)'}`,
    },
    {
      category: 'Hotels',
      emoji: '🏨',
      ...hotel,
      note: `${nights} night${nights !== 1 ? 's' : ''} × ${roomsNeeded} room${roomsNeeded !== 1 ? 's' : ''}`,
    },
    {
      category: 'Food',
      emoji: '🍽️',
      ...food,
      perPerson: {
        low: days * ESTIMATES.food.low,
        mid: days * ESTIMATES.food.mid,
        high: days * ESTIMATES.food.high,
      },
      note: `${days} day${days !== 1 ? 's' : ''} × ${numTravelers} traveler${numTravelers !== 1 ? 's' : ''}`,
    },
    {
      category: 'Activities & Misc',
      emoji: '🎯',
      ...misc,
      perPerson: {
        low: days * ESTIMATES.misc.low,
        mid: days * ESTIMATES.misc.mid,
        high: days * ESTIMATES.misc.high,
      },
      note: 'Parking, tips, attractions',
    },
  ];

  return {
    totalLow: Math.round(totalLow),
    totalMid: Math.round(totalMid),
    totalHigh: Math.round(totalHigh),
    perPersonLow: Math.round(totalLow / numTravelers),
    perPersonMid: Math.round(totalMid / numTravelers),
    perPersonHigh: Math.round(totalHigh / numTravelers),
    breakdown,
    days,
    nights,
    distanceKm: Math.round(distanceKm),
    numTravelers,
    currency: currencySymbol,
  };
}
