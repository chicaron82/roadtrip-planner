/**
 * stop-checks-ev.ts — EV charging stop logic for the route simulation.
 *
 * Contains: checkEVChargeStop, getEnRouteChargeStops
 */

import type { RouteSegment } from '../../types';
import type { SuggestedStop, StopSuggestionConfig } from '../stop-suggestion-types';
import type { SimState } from './types';
import { TRIP_CONSTANTS } from '../trip-constants';
import { getEVWinterMultiplier } from '../unit-conversions';

const EV_CONSTANTS = TRIP_CONSTANTS.ev;

/**
 * Calculates energy consumed for the segment.
 * If rangeKm is available, it uses the percentage of the range consumed and multiplies by battery capacity.
 * Otherwise falls back to Le/100km math.
 */
function getEnergyNeeded(segment: RouteSegment, config: StopSuggestionConfig): number {
  if (segment.fuelNeededLitres) return segment.fuelNeededLitres;
  
  const winterMultiplier = getEVWinterMultiplier(segment.from.lat, config.departureTime);
  
  if (config.rangeKm) {
    const effectiveRange = config.rangeKm * winterMultiplier;
    return (segment.distanceKm / effectiveRange) * config.tankSizeLitres;
  }
  
  const baseLitres = (segment.distanceKm / 100) * config.fuelEconomyL100km * 8.9;
  return baseLitres / winterMultiplier;
}

export function checkEVChargeStop(
  state: SimState,
  segment: RouteSegment,
  index: number,
  config: StopSuggestionConfig,
  safeRangeKm: number,
  isFinalSegment = false,
  hubName?: string,
): { suggestion: SuggestedStop | null; stopTimeAddedMs: number } {
  const energyNeeded = getEnergyNeeded(segment, config);
  const batteryCapacity = config.tankSizeLitres;

  const wouldRunCriticallyLow = (state.currentFuel - energyNeeded) < (batteryCapacity * EV_CONSTANTS.chargeLevels.critical);
  const exceededSafeRange = state.distanceSinceLastFill >= safeRangeKm;
  const comfortRefuelDue = state.hoursSinceLastFill >= state.comfortRefuelHours && index > 0;
  const tankLow = state.currentFuel <= (batteryCapacity * EV_CONSTANTS.chargeLevels.low) && index > 0;

  if (isFinalSegment && !wouldRunCriticallyLow) {
    return { suggestion: null, stopTimeAddedMs: 0 };
  }

  // Considered "full" at 80% for EV planning purposes
  if (state.currentFuel >= batteryCapacity * EV_CONSTANTS.chargeLevels.full) {
    return { suggestion: null, stopTimeAddedMs: 0 };
  }

  if (!exceededSafeRange && !wouldRunCriticallyLow && !comfortRefuelDue && !tankLow) {
    return { suggestion: null, stopTimeAddedMs: 0 };
  }

  // EV charges to 80% limit by default (unless arriving at destination, handled elsewhere)
  const targetChargeKwh = batteryCapacity * EV_CONSTANTS.chargeToLimit;
  const refillAmountKwh = Math.max(0, targetChargeKwh - state.currentFuel);
  const refillCost = state.costSinceLastFill; // Already calculated correctly in budget segment processor
  const tankPercent = Math.round((state.currentFuel / batteryCapacity) * 100);
  
  // Replace locationPrefix and reasons with EV copy
  const locationPrefix = hubName ? `Charge up in ${hubName}. ` : '';

  let reason = '';
  if (wouldRunCriticallyLow) {
    reason = `${locationPrefix}Battery at ${tankPercent}%. ~$${refillCost.toFixed(2)} to charge (est. kWh). Critical: charge up before continuing to ${segment.to.name}.`;
  } else if (tankLow && !exceededSafeRange && !comfortRefuelDue) {
    reason = `${locationPrefix}Battery is at ${tankPercent}% — getting low. ~$${refillCost.toFixed(2)} to plug in now before options get sparse.`;
  } else if (comfortRefuelDue && !exceededSafeRange) {
    reason = `${locationPrefix}${state.hoursSinceLastFill.toFixed(1)} hours since last plug-in — good time to stretch. Battery at ${tankPercent}%. ~$${refillCost.toFixed(2)} to charge.`;
  } else {
    reason = `${locationPrefix}Battery at ${tankPercent}%. ~$${refillCost.toFixed(2)} to charge. You've driven ${state.distanceSinceLastFill.toFixed(0)} km since your last charge.`;
  }

  let sparseWarning: string | undefined;
  if (segment.distanceKm > 150) {
    const hoursForSegment = segment.durationMinutes / 60;
    sparseWarning = `⚠️ Heads up: Limited Supercharger coverage for next ${segment.distanceKm.toFixed(0)} km (${hoursForSegment.toFixed(1)} hours). Charge fully and take a break before continuing.`;
  }

  // Refill sets tank to target limit
  state.currentFuel = targetChargeKwh;
  state.distanceSinceLastFill = 0;
  state.hoursSinceLastFill = 0;
  state.costSinceLastFill = 0;

  const hour = state.currentTime.getHours();
  const isLunchWindow = hour >= 11 && hour < 13;
  const isDinnerWindow = hour >= 17 && hour < 19;
  const comboMeal = isLunchWindow || isDinnerWindow;
  
  // EV stops are 30 mins base, 45 if grabbing a meal
  const stopDuration = comboMeal ? 45 : 30;

  if (comboMeal) {
    const mealLabel = isLunchWindow ? 'lunch' : 'dinner';
    reason += ` Great time to grab ${mealLabel} while charging.`;
  }

  const stopTimeAddedMs = stopDuration * 60 * 1000;
  state.currentTime = new Date(state.currentTime.getTime() + stopTimeAddedMs);

  return {
    suggestion: {
      id: `charge-${index}`,
      type: 'fuel', // Keep logic compatible with existing engine types
      reason,
      afterSegmentIndex: index - 1,
      estimatedTime: new Date(state.currentTime.getTime() - stopTimeAddedMs),
      duration: stopDuration,
      priority: wouldRunCriticallyLow ? 'required' : 'recommended',
      details: {
        fuelNeeded: refillAmountKwh,
        fuelCost: refillCost,
        fillType: (wouldRunCriticallyLow || exceededSafeRange) ? 'full' : 'topup',
        comboMeal,
        comboMealType: comboMeal ? (isLunchWindow ? 'lunch' : 'dinner') : undefined,
        tankPercent,
      },
      hubName,
      warning: sparseWarning,
      dayNumber: state.currentDayNumber,
      accepted: true,
    },
    stopTimeAddedMs,
  };
}

export function getEnRouteChargeStops(
  state: SimState,
  segment: RouteSegment,
  index: number,
  config: StopSuggestionConfig,
  safeRangeKm: number,
  segmentStartTime: Date,
  distanceAlreadyDriven = 0,
  hubResolver?: (kmIntoSegment: number) => string | undefined,
  comfortIntervalHours?: number,
  positionResolver?: (kmIntoSegment: number) => { lat: number; lng: number } | undefined,
  segmentStartKm = 0,
): { stops: SuggestedStop[]; lastFillKm: number } {
  const stops: SuggestedStop[] = [];
  let lastFillKm = 0;
  let costSinceLastFillInSegment = state.costSinceLastFill;
  let lastStopKmInSegment = 0;

  let loopFuelLevel = Math.max(0,
    state.currentFuel - (distanceAlreadyDriven / segment.distanceKm) * getEnergyNeeded(segment, config)
  );

  const HUB_SNAP_WINDOW_KM = 140;
  const HUB_SNAP_STEP_KM = 20;

  const avgSpeedKmH = segment.distanceKm / (segment.durationMinutes / 60);
  let distanceSinceLastFillKm = distanceAlreadyDriven;
  let stopIndex = 1;
  const batteryCapacity = config.tankSizeLitres;

  while (true) {
    const kmUntilSafetyStop = Math.max(0, safeRangeKm - distanceSinceLastFillKm);
    const kmUntilComfortStop = comfortIntervalHours !== undefined
      ? Math.max(0, comfortIntervalHours * avgSpeedKmH - distanceSinceLastFillKm)
      : kmUntilSafetyStop;

    const isComfortStop = comfortIntervalHours !== undefined && kmUntilComfortStop <= kmUntilSafetyStop;
    const nextStopOffsetKm = Math.min(kmUntilComfortStop, kmUntilSafetyStop);
    if (!Number.isFinite(nextStopOffsetKm) || nextStopOffsetKm <= 0) break;

    const candidateKm = lastStopKmInSegment + nextStopOffsetKm;
    if (candidateKm >= segment.distanceKm) break;

    let snappedKm = candidateKm;
    let stopHubName: string | undefined;

    if (hubResolver) {
      stopHubName = hubResolver(candidateKm);
      if (!stopHubName) {
        for (let lookback = HUB_SNAP_STEP_KM; lookback <= HUB_SNAP_WINDOW_KM; lookback += HUB_SNAP_STEP_KM) {
          const backwardKm = candidateKm - lookback;
          if (backwardKm <= lastStopKmInSegment) break;
          const hub = hubResolver(backwardKm);
          if (hub) {
            snappedKm = backwardKm;
            stopHubName = hub;
            break;
          }
        }
      }
      if (!stopHubName) {
        for (let lookahead = HUB_SNAP_STEP_KM; lookahead <= 40; lookahead += HUB_SNAP_STEP_KM) {
          const forwardKm = candidateKm + lookahead;
          if (forwardKm >= segment.distanceKm) break;
          const hub = hubResolver(forwardKm);
          if (hub) {
            snappedKm = forwardKm;
            stopHubName = hub;
            break;
          }
        }
      }
    }

    if (snappedKm <= lastStopKmInSegment) {
      snappedKm = candidateKm;
    }

    const minutesMark = (snappedKm / segment.distanceKm) * segment.durationMinutes;
    const stopTime = new Date(segmentStartTime.getTime() + minutesMark * 60 * 1000);
    const hour = stopTime.getHours();
    const isLunchWindow = hour >= 11 && hour < 13;
    const isDinnerWindow = hour >= 17 && hour < 19;
    const comboMeal = isLunchWindow || isDinnerWindow;
    const stopDuration = comboMeal ? 45 : 30;

    const locationDesc = stopHubName
      ? `in ${stopHubName}`
      : `around km ${Math.round(snappedKm)} (~${(minutesMark / 60).toFixed(1)}h in)`;
    const mealNote = comboMeal
      ? (isLunchWindow ? ' Great time to grab lunch while charging.' : ' Good time to grab dinner too.')
      : '';

    let reason: string;
    if (isComfortStop) {
      reason = `${(segment.durationMinutes / 60).toFixed(1)}h drive — good time to plug in and stretch ${locationDesc}.${mealNote}`;
    } else {
      reason = `En-route charge needed ${locationDesc}. Your battery cannot cover the full distance without stopping.${mealNote}`;
    }

    const kmFromLastFill = snappedKm - lastStopKmInSegment;
    const fuelCostForStop = costSinceLastFillInSegment
      + (kmFromLastFill / segment.distanceKm) * (segment.fuelCost ?? 0);

    const fuelUsedToStop = (kmFromLastFill / segment.distanceKm) * getEnergyNeeded(segment, config);
    loopFuelLevel = Math.max(0, loopFuelLevel - fuelUsedToStop);
    const enRouteTankPercent = Math.round((loopFuelLevel / batteryCapacity) * 100);

    const stopPosition = positionResolver?.(snappedKm);
    stops.push({
      id: `charge-enroute-${index}-${stopIndex}`,
      type: 'fuel',
      reason,
      afterSegmentIndex: index - 1 + stopIndex * 0.01,
      estimatedTime: stopTime,
      duration: stopDuration,
      priority: isComfortStop ? 'recommended' : 'required',
      details: {
        fuelNeeded: (batteryCapacity * EV_CONSTANTS.chargeToLimit) - loopFuelLevel,
        fuelCost: fuelCostForStop,
        fillType: isComfortStop ? 'topup' : 'full',
        comboMeal,
        comboMealType: comboMeal ? (isLunchWindow ? 'lunch' : 'dinner') : undefined,
        tankPercent: enRouteTankPercent,
      },
      hubName: stopHubName,
      dayNumber: state.currentDayNumber,
      accepted: true,
      ...(stopPosition && { lat: stopPosition.lat, lng: stopPosition.lng }),
      distanceFromStart: segmentStartKm + snappedKm,
    });

    lastFillKm = snappedKm;
    lastStopKmInSegment = snappedKm;
    distanceSinceLastFillKm = 0;
    loopFuelLevel = batteryCapacity * EV_CONSTANTS.chargeToLimit; // 80% charge
    costSinceLastFillInSegment = 0;
    stopIndex++;
  }

  return { stops, lastFillKm };
}
