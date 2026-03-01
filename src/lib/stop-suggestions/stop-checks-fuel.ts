/**
 * stop-checks-fuel.ts — Fuel stop logic for the route simulation.
 *
 * Contains: checkFuelStop, getEnRouteFuelStops
 */

import type { RouteSegment } from '../../types';
import type { SuggestedStop, StopSuggestionConfig } from '../stop-suggestion-types';
import type { SimState } from './types';

/**
 * Check if a fuel stop is needed before this segment.
 * Returns the suggestion and how much time was added to the sim clock.
 *
 * @param isFinalSegment — If true, applies "Destination Grace Period": only trigger
 *   on critically low fuel (≤15% tank), suppressing comfort/range-based refuels.
 * @param hubName — If provided, use this city name in the reason string.
 */
export function checkFuelStop(
  state: SimState,
  segment: RouteSegment,
  index: number,
  config: StopSuggestionConfig,
  safeRangeKm: number,
  isFinalSegment = false,
  hubName?: string,
): { suggestion: SuggestedStop | null; stopTimeAddedMs: number } {
  const fuelNeeded = segment.fuelNeededLitres ?? (segment.distanceKm / 100) * config.fuelEconomyL100km;

  const wouldRunCriticallyLow = (state.currentFuel - fuelNeeded) < (config.tankSizeLitres * 0.15);
  const exceededSafeRange = state.distanceSinceLastFill >= safeRangeKm;
  const comfortRefuelDue = state.hoursSinceLastFill >= state.comfortRefuelHours && index > 0;
  const tankLow = state.currentFuel <= (config.tankSizeLitres * 0.35) && index > 0;

  if (isFinalSegment && !wouldRunCriticallyLow) {
    return { suggestion: null, stopTimeAddedMs: 0 };
  }

  if (state.currentFuel >= config.tankSizeLitres * 0.98) {
    return { suggestion: null, stopTimeAddedMs: 0 };
  }

  if (!exceededSafeRange && !wouldRunCriticallyLow && !comfortRefuelDue && !tankLow) {
    return { suggestion: null, stopTimeAddedMs: 0 };
  }

  const refillAmount = config.tankSizeLitres - state.currentFuel;
  const refillCost = refillAmount * config.gasPrice;
  const tankPercent = Math.round((state.currentFuel / config.tankSizeLitres) * 100);
  const litresRemaining = state.currentFuel.toFixed(1);
  const locationPrefix = hubName ? `Fuel up in ${hubName}. ` : '';

  let reason = '';
  if (wouldRunCriticallyLow) {
    reason = `${locationPrefix}Tank at ${tankPercent}% (${litresRemaining}L remaining). ~$${refillCost.toFixed(2)} to refill. Critical: refuel before continuing to ${segment.to.name}.`;
  } else if (tankLow && !exceededSafeRange && !comfortRefuelDue) {
    reason = `${locationPrefix}Tank is at ${tankPercent}% (${litresRemaining}L remaining) — getting low. ~$${refillCost.toFixed(2)} to top up now before options get sparse.`;
  } else if (comfortRefuelDue && !exceededSafeRange) {
    reason = `${locationPrefix}${state.hoursSinceLastFill.toFixed(1)} hours since last fill — good time to top up. Tank at ${tankPercent}% (${litresRemaining}L). ~$${refillCost.toFixed(2)} to refill.`;
  } else {
    reason = `${locationPrefix}Tank at ${tankPercent}% (${litresRemaining}L remaining). ~$${refillCost.toFixed(2)} to refill. You've driven ${state.distanceSinceLastFill.toFixed(0)} km since last fill.`;
  }

  let sparseWarning: string | undefined;
  if (segment.distanceKm > 150) {
    const hoursForSegment = segment.durationMinutes / 60;
    sparseWarning = `⚠️ Heads up: Limited services for next ${segment.distanceKm.toFixed(0)} km (${hoursForSegment.toFixed(1)} hours). Fuel up and take a break before continuing.`;
  }

  state.currentFuel = config.tankSizeLitres;
  state.distanceSinceLastFill = 0;
  state.hoursSinceLastFill = 0;

  const hour = state.currentTime.getHours();
  const isLunchWindow = hour >= 11 && hour < 13;
  const isDinnerWindow = hour >= 17 && hour < 19;
  const comboMeal = isLunchWindow || isDinnerWindow;
  const stopDuration = comboMeal ? 45 : 15;

  if (comboMeal) {
    const mealLabel = isLunchWindow ? 'lunch' : 'dinner';
    reason += ` Good time to grab ${mealLabel} too — you're already stopped.`;
  }

  const stopTimeAddedMs = stopDuration * 60 * 1000;
  state.currentTime = new Date(state.currentTime.getTime() + stopTimeAddedMs);

  return {
    suggestion: {
      id: `fuel-${index}`,
      type: 'fuel',
      reason,
      afterSegmentIndex: index - 1,
      estimatedTime: new Date(state.currentTime.getTime() - stopTimeAddedMs),
      duration: stopDuration,
      priority: wouldRunCriticallyLow ? 'required' : 'recommended',
      details: {
        fuelNeeded: refillAmount,
        fuelCost: refillCost,
        fillType: (wouldRunCriticallyLow || exceededSafeRange) ? 'full' : 'topup',
        comboMeal,
      },
      hubName,
      warning: sparseWarning,
      dayNumber: state.currentDayNumber,
      accepted: true,
    },
    stopTimeAddedMs,
  };
}

/**
 * Generate en-route fuel stops for segments longer than the safe range.
 *
 * Hub-snap: before placing a stop at the exact safe-range km mark, scan
 * backward (up to HUB_SNAP_WINDOW_KM) for a known city hub.
 *
 * @param distanceAlreadyDriven - km driven since last fill before this segment.
 */
export function getEnRouteFuelStops(
  state: SimState,
  segment: RouteSegment,
  index: number,
  config: StopSuggestionConfig,
  safeRangeKm: number,
  segmentStartTime: Date,
  distanceAlreadyDriven = 0,
  hubResolver?: (kmIntoSegment: number) => string | undefined,
): { stops: SuggestedStop[]; lastFillKm: number } {
  const stops: SuggestedStop[] = [];
  let lastFillKm = 0;

  const HUB_SNAP_WINDOW_KM = 80;
  const HUB_SNAP_STEP_KM = 20;

  const COMFORT_DRIVING_HOURS = 4;
  const avgSpeedKmH = segment.distanceKm / (segment.durationMinutes / 60);
  const comfortKm = COMFORT_DRIVING_HOURS * avgSpeedKmH;

  const kmUntilFirstStop = Math.max(0, safeRangeKm - distanceAlreadyDriven);
  // Comfort stop is warranted when the segment takes > 4h of driving, regardless of fuel range.
  const comfortStopWarranted = segment.durationMinutes > COMFORT_DRIVING_HOURS * 60 && comfortKm < segment.distanceKm;

  // If the tank covers the full segment AND the drive is short enough, no stops needed.
  if (kmUntilFirstStop >= segment.distanceKm && !comfortStopWarranted) {
    return { stops, lastFillKm };
  }

  // When the tank covers the distance but the leg is too long for comfort (> 4h),
  // suggest a single mid-leg top-up + stretch stop. No fuel urgency — just good practice.
  if (kmUntilFirstStop >= segment.distanceKm) {
    let snappedKm = comfortKm;
    let stopHubName: string | undefined;

    if (hubResolver) {
      stopHubName = hubResolver(comfortKm);
      if (!stopHubName) {
        for (let lookback = HUB_SNAP_STEP_KM; lookback <= HUB_SNAP_WINDOW_KM; lookback += HUB_SNAP_STEP_KM) {
          const candidateKm = comfortKm - lookback;
          if (candidateKm <= 0) break;
          const candidateHub = hubResolver(candidateKm);
          if (candidateHub) {
            snappedKm = candidateKm;
            stopHubName = candidateHub;
            break;
          }
        }
      }
    }

    const minutesMark = (snappedKm / segment.distanceKm) * segment.durationMinutes;
    const stopTime = new Date(segmentStartTime.getTime() + minutesMark * 60 * 1000);
    const hour = stopTime.getHours();
    const isLunchWindow = hour >= 11 && hour < 13;
    const isDinnerWindow = hour >= 17 && hour < 19;
    const comboMeal = isLunchWindow || isDinnerWindow;
    const stopDuration = comboMeal ? 45 : 15;

    const locationDesc = stopHubName ? `in ${stopHubName}` : `around km ${Math.round(snappedKm)}`;
    const mealNote = comboMeal
      ? (isLunchWindow ? ' Great time to grab lunch too.' : ' Good time to grab dinner too.')
      : '';

    stops.push({
      id: `fuel-comfort-${index}`,
      type: 'fuel',
      reason: `Long drive (${(segment.durationMinutes / 60).toFixed(1)}h) — good time to top up and stretch ${locationDesc}.${mealNote}`,
      afterSegmentIndex: index - 1 + 0.01,
      estimatedTime: stopTime,
      duration: stopDuration,
      priority: 'recommended',
      details: {
        fuelNeeded: config.tankSizeLitres * 0.5,
        fuelCost: config.tankSizeLitres * 0.5 * config.gasPrice,
        fillType: 'topup',
        comboMeal,
      },
      hubName: stopHubName,
      dayNumber: state.currentDayNumber,
      accepted: true,
    });

    return { stops, lastFillKm };
  }

  const COMFORT_HUB_SCAN_WINDOW_KM = 50;

  let proactiveHubKm: number | undefined;
  let proactiveHubName: string | undefined;

  if (hubResolver && comfortKm > 50 && comfortKm < kmUntilFirstStop - 80) {
    for (let offset = 0; offset <= COMFORT_HUB_SCAN_WINDOW_KM; offset += 20) {
      for (const delta of [0, -offset, offset]) {
        const candidateKm = comfortKm + delta;
        if (candidateKm <= 0 || candidateKm >= segment.distanceKm) continue;
        const hub = hubResolver(candidateKm);
        if (hub) {
          proactiveHubKm = candidateKm;
          proactiveHubName = hub;
          break;
        }
      }
      if (proactiveHubName) break;
    }
  }

  let kmMark = proactiveHubKm ?? kmUntilFirstStop;
  let stopIndex = 1;

  while (kmMark < segment.distanceKm) {
    let snappedKm = kmMark;
    let stopHubName: string | undefined = (kmMark === proactiveHubKm) ? proactiveHubName : undefined;

    if (hubResolver && !stopHubName) {
      stopHubName = hubResolver(kmMark);

      if (!stopHubName) {
        for (let lookback = HUB_SNAP_STEP_KM; lookback <= HUB_SNAP_WINDOW_KM; lookback += HUB_SNAP_STEP_KM) {
          const candidateKm = kmMark - lookback;
          if (candidateKm <= 0) break;
          const candidateHub = hubResolver(candidateKm);
          if (candidateHub) {
            snappedKm = candidateKm;
            stopHubName = candidateHub;
            break;
          }
        }
      }
    }

    const minutesMark = (snappedKm / segment.distanceKm) * segment.durationMinutes;

    const locationDesc = stopHubName
      ? `near ${stopHubName}`
      : `around km ${Math.round(snappedKm)} into this ${segment.distanceKm.toFixed(0)} km leg (~${(minutesMark / 60).toFixed(1)}h after departing)`;

    stops.push({
      id: `fuel-enroute-${index}-${stopIndex}`,
      type: 'fuel',
      reason: `En-route refuel needed ${locationDesc}. Your tank cannot cover the full distance without stopping.`,
      afterSegmentIndex: index - 1 + stopIndex * 0.01,
      estimatedTime: new Date(segmentStartTime.getTime() + minutesMark * 60 * 1000),
      duration: 15,
      priority: 'required',
      details: {
        fuelNeeded: config.tankSizeLitres * 0.9,
        fuelCost: config.tankSizeLitres * 0.9 * config.gasPrice,
        fillType: 'full',
      },
      hubName: stopHubName,
      dayNumber: state.currentDayNumber,
    });

    lastFillKm = snappedKm;
    kmMark = snappedKm + safeRangeKm;
    stopIndex++;
  }

  return { stops, lastFillKm };
}
