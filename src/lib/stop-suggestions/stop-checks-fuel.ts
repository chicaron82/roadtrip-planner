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
 * @param comfortIntervalHours - Driver's preferred stop interval in hours (from
 *   stopFrequency setting). When provided, this becomes the primary stop trigger
 *   and the route-math safety range becomes a fallback only. This lets the stop
 *   land at a real highway town (Brandon, Virden, Fargo) instead of at the exact
 *   fuel-exhaustion km mark.
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
  comfortIntervalHours?: number,
): { stops: SuggestedStop[]; lastFillKm: number } {
  const stops: SuggestedStop[] = [];
  let lastFillKm = 0;

  // Hub snap: scan backward (and slightly forward) from the trigger km mark to
  // find the nearest real city. 140km window catches towns like Brandon (~200km
  // on a 574km leg when the trigger fires at ~341km).
  const HUB_SNAP_WINDOW_KM = 140;
  const HUB_SNAP_STEP_KM = 20;

  const avgSpeedKmH = segment.distanceKm / (segment.durationMinutes / 60);

  // Safety trigger: how many more km until the tank hits the critical floor.
  const kmUntilSafetyStop = Math.max(0, safeRangeKm - distanceAlreadyDriven);

  // Comfort trigger: the driver's natural stopping rhythm based on time driven.
  // e.g. balanced = 3.5h → at 97 km/h that's ~342km. This is where a real person
  // would pull off regardless of how much fuel is left.
  const kmUntilComfortStop = comfortIntervalHours !== undefined
    ? Math.max(0, comfortIntervalHours * avgSpeedKmH - distanceAlreadyDriven)
    : kmUntilSafetyStop;

  // First stop fires at whichever trigger comes first.
  // Comfort-driven (< safety): "recommended" stop at a highway town.
  // Safety-driven (≤ comfort): "required" stop to prevent running dry.
  const firstStopKm = Math.min(kmUntilComfortStop, kmUntilSafetyStop);
  const isComfortFirst = kmUntilComfortStop <= kmUntilSafetyStop;

  // Nothing to do if even the earliest trigger falls beyond the segment.
  if (firstStopKm >= segment.distanceKm) return { stops, lastFillKm };

  let kmMark = firstStopKm;
  let stopIndex = 1;

  while (kmMark < segment.distanceKm) {
    // Determine whether this specific stop is comfort- or safety-driven.
    // First stop uses the pre-computed flag; subsequent stops are always safety.
    const isComfortStop = stopIndex === 1 && isComfortFirst;

    // Hub resolution: check the exact trigger point first, then scan backward
    // in 20km steps up to 140km. This snaps the stop to the nearest real town
    // (e.g. Brandon, MB at km~200 when trigger fires at km~341 for Wpg→Regina).
    // Also scan slightly forward (up to 40km) so we don't miss a town just past
    // the trigger (e.g. Virden at km~270 when trigger fires at km~261).
    let snappedKm = kmMark;
    let stopHubName: string | undefined;

    if (hubResolver) {
      // Check exact point first
      stopHubName = hubResolver(kmMark);

      if (!stopHubName) {
        // Scan backward up to HUB_SNAP_WINDOW_KM (preferred — don't overshoot)
        for (let lookback = HUB_SNAP_STEP_KM; lookback <= HUB_SNAP_WINDOW_KM; lookback += HUB_SNAP_STEP_KM) {
          const candidateKm = kmMark - lookback;
          if (candidateKm <= 0) break;
          const hub = hubResolver(candidateKm);
          if (hub) {
            snappedKm = candidateKm;
            stopHubName = hub;
            break;
          }
        }
      }

      if (!stopHubName) {
        // Scan slightly forward (up to 40km) as a second chance
        for (let lookahead = HUB_SNAP_STEP_KM; lookahead <= 40; lookahead += HUB_SNAP_STEP_KM) {
          const candidateKm = kmMark + lookahead;
          if (candidateKm >= segment.distanceKm) break;
          const hub = hubResolver(candidateKm);
          if (hub) {
            snappedKm = candidateKm;
            stopHubName = hub;
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

    const locationDesc = stopHubName
      ? `in ${stopHubName}`
      : `around km ${Math.round(snappedKm)} (~${(minutesMark / 60).toFixed(1)}h in)`;
    const mealNote = comboMeal
      ? (isLunchWindow ? ' Great time to grab lunch while you\'re stopped.' : ' Good time to grab dinner too.')
      : '';

    let reason: string;
    if (isComfortStop) {
      reason = `${(segment.durationMinutes / 60).toFixed(1)}h drive — good time to top up and stretch ${locationDesc}.${mealNote}`;
    } else {
      reason = `En-route refuel needed ${locationDesc}. Your tank cannot cover the full distance without stopping.${mealNote}`;
    }

    stops.push({
      id: `fuel-enroute-${index}-${stopIndex}`,
      type: 'fuel',
      reason,
      afterSegmentIndex: index - 1 + stopIndex * 0.01,
      estimatedTime: stopTime,
      duration: stopDuration,
      priority: isComfortStop ? 'recommended' : 'required',
      details: {
        fuelNeeded: isComfortStop ? config.tankSizeLitres * 0.5 : config.tankSizeLitres * 0.9,
        fuelCost: (isComfortStop ? config.tankSizeLitres * 0.5 : config.tankSizeLitres * 0.9) * config.gasPrice,
        fillType: isComfortStop ? 'topup' : 'full',
        comboMeal,
      },
      hubName: stopHubName,
      dayNumber: state.currentDayNumber,
      accepted: true,
    });

    lastFillKm = snappedKm;
    // All subsequent stops use the safety range interval
    kmMark = snappedKm + safeRangeKm;
    stopIndex++;
  }

  return { stops, lastFillKm };
}
