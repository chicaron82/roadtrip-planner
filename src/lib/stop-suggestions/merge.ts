import type { SuggestedStop } from '../stop-suggestion-types';
import { consolidateStops } from './consolidate';

function compareSuggestedStops(left: SuggestedStop, right: SuggestedStop): number {
  const segmentDelta = left.afterSegmentIndex - right.afterSegmentIndex;
  if (segmentDelta !== 0) return segmentDelta;

  const timeDelta = (left.estimatedTime?.getTime() ?? 0) - (right.estimatedTime?.getTime() ?? 0);
  if (timeDelta !== 0) return timeDelta;

  return left.id.localeCompare(right.id);
}

export function mergeSuggestedStops(stops: SuggestedStop[]): SuggestedStop[] {
  if (stops.length <= 1) return stops;
  return consolidateStops([...stops].sort(compareSuggestedStops));
}