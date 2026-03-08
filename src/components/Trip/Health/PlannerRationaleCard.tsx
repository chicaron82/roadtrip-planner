import type { TripSettings, TripSummary } from '../../../types';
import type { FeasibilityResult } from '../../../lib/feasibility';
import { buildPlannerRationale } from '../../../lib/planner-rationale';

interface PlannerRationaleCardProps {
  summary: TripSummary;
  settings: TripSettings;
  feasibility: FeasibilityResult | null;
}

export function PlannerRationaleCard({ summary, settings, feasibility }: PlannerRationaleCardProps) {
  const items = buildPlannerRationale(summary, settings, feasibility).slice(0, 4);
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Planner Read
      </div>
      <div className="mt-3 space-y-2.5">
        {items.map(item => (
          <div key={item.label} className="grid grid-cols-[88px_1fr] gap-3 text-sm leading-relaxed">
            <div className="font-medium text-foreground/70">{item.label}</div>
            <div className="text-muted-foreground">{item.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}