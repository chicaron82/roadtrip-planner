/**
 * ═══════════════════════════════════════════════════════════
 * MY EXPERIENCE ENGINE — ESTIMATE SERVICE
 * "You know where you're going. Let's find out what it costs."
 *
 * Pure cost estimation logic — no DOM, no React.
 * Takes route distance, vehicle, party size → cost breakdown.
 * ═══════════════════════════════════════════════════════════
 */
import type { Vehicle, TripSettings, TripSummary, UnitSystem } from '../types';
import { KM_TO_MILES } from './constants';

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
 * Round a cost estimate UP to the next "budget-friendly" milestone.
 * Applied to mid and high outputs only — low stays precise (it's the honest floor).
 * Better to have money left over than come up short on the road.
 *
 * Examples: $23→$30 · $42→$60 · $68→$100 · $110→$150 · $340→$350
 */
function roundToBudget(amount: number): number {
  if (amount < 25) return 30;
  if (amount < 50) return 60;   // not 50 — 50 exact gives zero buffer
  if (amount < 75) return 100;
  if (amount < 125) return 150;
  return Math.ceil(amount / 50) * 50;
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
    const distanceMiles = distanceKm * KM_TO_MILES;
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
  // totalDistanceKm is already the full round-trip total after buildRoundTripSegments
  // mutates it — do NOT double it again here.
  const distanceKm = summary.totalDistanceKm;

  // Use returnDate if set (user-defined trip length), otherwise derive from route.
  // Append T00:00:00 to avoid UTC-midnight timezone shift on date-only strings.
  // Use Math.round() + 1 to match splitTripByDays's totalTripDays formula
  // (departure day + intermediate days + return day = calendar days, not just nights).
  const daysFromDates = settings.returnDate && settings.departureDate
    ? Math.max(1, Math.round((new Date(settings.returnDate + 'T00:00:00').getTime() - new Date(settings.departureDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : 0;
  const days = daysFromDates || summary.days?.length || Math.max(1, Math.ceil(summary.totalDurationMinutes / (settings.maxDriveHours * 60)));
  const nights = Math.max(0, days - 1);
  const numTravelers = settings.numTravelers || 1;
  // Use explicit numRooms when provided (user-controlled stepper).
  // Default: 1 room for ≤4 travelers, +1 room per additional 4 people.
  const roomsNeeded = settings.numRooms ?? Math.max(1, Math.ceil(numTravelers / 4));

  const currencySymbol = settings.currency === 'USD' ? '$' : 'C$';

  // ── Fuel ──
  const fuelPrecise = estimateFuelCost(distanceKm, vehicle, settings.units, settings.gasPrice || undefined);
  const fuel = {
    low: Math.round(fuelPrecise.low),
    mid: roundToBudget(fuelPrecise.mid),
    high: roundToBudget(fuelPrecise.high),
  };

  // ── Hotels ──
  // Use the user's selected hotel price (set by tier in WorkshopPanel / Settings).
  // Fall back to ESTIMATES mid-tier only when hotelPricePerNight is not set.
  const hotelMidRate = settings.hotelPricePerNight || ESTIMATES.hotel.mid;
  const hotel = {
    low: Math.round(nights * roomsNeeded * hotelMidRate * 0.85),
    mid: roundToBudget(nights * roomsNeeded * hotelMidRate),
    high: roundToBudget(nights * roomsNeeded * hotelMidRate * 1.25),
  };

  // ── Food ──
  const food = {
    low: Math.round(days * numTravelers * ESTIMATES.food.low),
    mid: roundToBudget(days * numTravelers * ESTIMATES.food.mid),
    high: roundToBudget(days * numTravelers * ESTIMATES.food.high),
  };

  // ── Misc ──
  const misc = {
    low: Math.round(days * numTravelers * ESTIMATES.misc.low),
    mid: roundToBudget(days * numTravelers * ESTIMATES.misc.mid),
    high: roundToBudget(days * numTravelers * ESTIMATES.misc.high),
  };

  // ── Totals — sum already-rounded line items (no double-rounding) ──
  const totalLow = fuel.low + hotel.low + food.low + misc.low;
  const totalMid = fuel.mid + hotel.mid + food.mid + misc.mid;
  const totalHigh = fuel.high + hotel.high + food.high + misc.high;

  const breakdown: EstimateBreakdownItem[] = [
    {
      category: 'Fuel',
      emoji: '⛽',
      ...fuel,
      note: `${distanceKm.toFixed(0)} km ${settings.isRoundTrip ? '(round trip total)' : '(one way)'}`,
    },
    {
      category: 'Hotels',
      emoji: '🏨',
      ...hotel,
      note: `${nights} night${nights !== 1 ? 's' : ''} × ${roomsNeeded} room${roomsNeeded !== 1 ? 's' : ''} @ $${hotelMidRate}/night`,
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
    totalLow,
    totalMid,
    totalHigh,
    perPersonLow: Math.round(totalLow / numTravelers),
    perPersonMid: Math.ceil(totalMid / numTravelers),
    perPersonHigh: Math.ceil(totalHigh / numTravelers),
    breakdown,
    days,
    nights,
    distanceKm: Math.round(distanceKm),
    numTravelers,
    currency: currencySymbol,
  };
}
