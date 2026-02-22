import type { TripDay } from '../../types';
import type { FeasibilityStatus, FeasibilityWarning } from './types';

export function calculateTotalBudgetUsed(days: TripDay[]): number {
  return days.reduce((sum, d) => sum + d.budget.dayTotal, 0);
}

export function deriveStatus(warnings: FeasibilityWarning[]): FeasibilityStatus {
  if (warnings.some(w => w.severity === 'critical')) return 'over';
  if (warnings.some(w => w.severity === 'warning')) return 'tight';
  return 'on-track';
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
