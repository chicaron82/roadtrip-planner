/**
 * stop-checks.ts — Barrel re-export for stop check modules.
 *
 * Logic split into focused files:
 *   stop-checks-overnight.ts  handleDayBoundaryReset, checkArrivalWindow,
 *                             checkOvernightStop, driveSegment, applyTimezoneShift
 *   stop-checks-fuel.ts       checkFuelStop, getEnRouteFuelStops
 *   stop-checks-rest.ts       checkRestBreak, checkMealStop
 */

export { handleDayBoundaryReset, checkArrivalWindow, checkOvernightStop, driveSegment, applyTimezoneShift } from './stop-checks-overnight';
export { checkFuelStop, getEnRouteFuelStops } from './stop-checks-fuel';
export { checkRestBreak, checkMealStop } from './stop-checks-rest';
