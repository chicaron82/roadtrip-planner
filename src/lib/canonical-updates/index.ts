/**
 * canonical-updates — Pure functions for mutating canonical trip state.
 *
 * Law: All viewer-facing interactions that affect itinerary truth route
 * through here. No UI surface or controller holds its own mutation rules.
 *
 * Each helper is a pure function: takes the current state slice(s), returns
 * the next state slice(s). No side effects, no context access.
 *
 * 💚 My Experience Engine
 */

export { addPoiToTimeline, dismissPoi } from './poi-mutations';
export { updateDayMetadata, updateDayTitle, updateDayNotes, updateDayType } from './day-metadata';
export { addDayActivity, updateDayActivity, removeDayActivity } from './day-activities';
export { updateOvernight } from './overnight';

// End of canonical mutation helpers
