/**
 * TunePanel — Post-reveal one-tap adjustments for icebreaker users.
 *
 * Shows contextual tune option pairs in Step 3 after the Four-Beat Arc completes.
 * Each pair offers two opposing adjustments (e.g. "More relaxed" / "Push harder").
 * Tapping an option applies its settings patch and triggers recalculation.
 *
 * Only renders when icebreakerOrigin is true (user came through the icebreaker).
 */

import { useMemo } from 'react';
import type { TripSettings, TripSummary } from '../../types';
import { buildTuneOptions } from '../../lib/tune-options';

interface TunePanelProps {
  settings: TripSettings;
  summary: TripSummary;
  onTune: (patch: Partial<TripSettings>) => void;
}

export function TunePanel({ settings, summary, onTune }: TunePanelProps) {
  const pairs = useMemo(() => buildTuneOptions(settings, summary), [settings, summary]);

  if (pairs.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
      <p className="text-[11px] uppercase tracking-wider text-white/40 mb-3">
        Quick adjustments
      </p>
      <div className="space-y-2">
        {pairs.map(pair => (
          <div key={pair.axis} className="flex gap-2">
            {pair.options.map(opt => (
              <button
                key={opt.id}
                onClick={() => onTune(opt.patch)}
                className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.04] text-white/60 text-xs font-medium hover:bg-white/[0.08] hover:text-white/80 transition-colors"
              >
                {opt.emoji} {opt.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
