import type { TripDay } from '../../types';
import type { FeasibilityStatus, FeasibilityWarning } from './types';
import { formatDuration as formatDurationCanonical } from '../trip-formatters';

export function calculateTotalBudgetUsed(days: TripDay[]): number {
  return days.reduce((sum, d) => sum + d.budget.dayTotal, 0);
}

export function deriveStatus(warnings: FeasibilityWarning[]): FeasibilityStatus {
  if (warnings.some(w => w.severity === 'critical')) return 'over';
  if (warnings.some(w => w.severity === 'warning')) return 'tight';
  return 'on-track';
}

/** Delegates to the canonical formatter in trip-formatters.ts. */
export const formatDuration = formatDurationCanonical;

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
