import type { DriverRotationResult } from './driver-rotation';
import type { TimedEvent } from './trip-timeline-types';
import { formatCurrencySimple as formatCurrency, formatDistance as formatDistanceFull } from './calculations';
import { formatTimeInZone } from './trip-timezone';

// ── Formatting helpers ───────────────────────────────────────────────────────

export const formatDistance = (km: number, units: 'metric' | 'imperial') =>
  formatDistanceFull(km, units, 0);

export function formatTimeFromISO(iso: string, tz?: string): string {
  const ms = new Date(iso).getTime();
  const rounded = new Date(Math.round(ms / (15 * 60 * 1000)) * (15 * 60 * 1000));
  if (tz) return formatTimeInZone(rounded, tz);
  return rounded.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s?am/, ' AM').replace(/\s?pm/, ' PM');
}

export function getDriverForSegment(
  segIndex: number,
  driverRotation: DriverRotationResult | null,
): number | undefined {
  if (!driverRotation) return undefined;
  return driverRotation.assignments.find(assignment => assignment.segmentIndex === segIndex)?.driver;
}

// ── Event type helpers ───────────────────────────────────────────────────────

export function getEventEmoji(type: TimedEvent['type']): string {
  switch (type) {
    case 'departure':   return '🚗';
    case 'arrival':     return '🏁';
    case 'fuel':        return '⛽';
    case 'meal':        return '🍽️';
    case 'rest':        return '☕';
    case 'overnight':   return '🏨';
    case 'destination': return '⏱️';
    case 'combo':       return '⛽🍽️';
    case 'drive':       return '→';
    default:            return '📍';
  }
}

export function getEventLabel(event: TimedEvent): string {
  switch (event.type) {
    case 'departure': return 'Depart';
    case 'arrival':   return 'Arrive';
    case 'fuel': {
      const stop = event.stops[0];
      const fillType = stop?.details?.fillType;
      const cost = stop?.details?.fuelCost;
      const costStr = cost != null ? ` · ~$${cost.toFixed(0)}` : '';
      const comboMealType = stop?.details?.comboMealType;
      if (comboMealType) {
        const mealLabel = comboMealType === 'dinner' ? 'Dinner' : 'Lunch';
        return `Fuel + ${mealLabel}${costStr}`;
      }
      return fillType === 'topup' ? `Top-Up${costStr}` : `Full Fill${costStr}`;
    }
    case 'meal': {
      const hour = event.arrivalTime.getHours();
      return hour < 10 || (hour === 10 && event.arrivalTime.getMinutes() < 30)
        ? 'Breakfast'
        : hour >= 17 ? 'Dinner' : 'Lunch';
    }
    case 'rest':        return 'Break';
    case 'overnight':   return 'Overnight';
    case 'destination': return `Time at ${event.locationHint}`;
    case 'combo':       return event.comboLabel ?? 'Fuel + Stop';
    case 'drive':       return 'Drive';
    default:            return 'Stop';
  }
}

export function getActivityEmoji(category: string): string {
  const map: Record<string, string> = {
    photo: '📸', meal: '🍽️', attraction: '🏛️', museum: '🖼️',
    shopping: '🛍️', nature: '🌲', rest: '☕', fuel: '⛽', other: '📌',
  };
  return map[category] || '📌';
}

export function getWeatherEmoji(
  weather: { temperatureMax: number; precipitationProb: number; weatherCode: number },
): string {
  if (weather.temperatureMax > 25) return '☀️';
  if (weather.precipitationProb > 40) return '🌧️';
  if (weather.weatherCode > 3) return '☁️';
  return '🌤️';
}

export { formatCurrency };