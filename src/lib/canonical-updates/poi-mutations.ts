/**
 * poi-mutations.ts — Canonical POI add/dismiss helpers.
 *
 * addPoiToTimeline: Transitions a POI suggestion to 'added' state.
 * The canonical timeline re-sync is handled upstream by the controller
 * calling rebuildCanonicalWithExternals with the newly added suggestions.
 *
 * dismissPoi: Transitions a POI suggestion to 'dismissed' state.
 *
 * Both are pure — they take the current suggestions array and return a
 * new one. No async, no side effects.
 */

import type { POISuggestion } from '../../types';

/**
 * Returns a new suggestions array with the target POI's actionState set
 * to 'added'. If the POI is already added, returns the same array reference
 * (no-op — safe to call redundantly).
 */
export function addPoiToTimeline(
  suggestions: POISuggestion[],
  poiId: string,
): POISuggestion[] {
  const target = suggestions.find(p => p.id === poiId);
  if (!target || target.actionState === 'added') return suggestions;
  return suggestions.map(p => p.id === poiId ? { ...p, actionState: 'added' } : p);
}

/**
 * Returns a new suggestions array with the target POI's actionState set
 * to 'dismissed'. If the POI is already dismissed, returns the same array
 * reference (no-op).
 */
export function dismissPoi(
  suggestions: POISuggestion[],
  poiId: string,
): POISuggestion[] {
  const target = suggestions.find(p => p.id === poiId);
  if (!target || target.actionState === 'dismissed') return suggestions;
  return suggestions.map(p => p.id === poiId ? { ...p, actionState: 'dismissed' } : p);
}
