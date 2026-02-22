// Re-export types so existing consumers importing from 'stop-suggestions' continue to work
export type {
  SuggestionStopType,
  SuggestedStop,
  StopFrequency,
  StopSuggestionConfig,
} from '../stop-suggestion-types';

export { generateSmartStops } from './generate';
export { consolidateStops } from './consolidate';

// Display helpers and config factory
// Re-exported for backwards compatibility with existing consumers
export { createStopConfig, getStopIcon, getStopColors } from '../stop-display-helpers';
