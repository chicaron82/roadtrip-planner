/**
 * TemplateRecommendations — Tips from the original template author.
 *
 * Shown in Step 1 after a template is imported. Collapsible card listing
 * per-stop author notes, ratings, and highlights.
 *
 * 💚 My Experience Engine
 */

import { useState } from 'react';
import type { SharedTemplate } from '../../../lib/url';

interface TemplateRecommendationsProps {
  recommendations: NonNullable<SharedTemplate['recommendations']>;
}

const RATING_STARS = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

export function TemplateRecommendations({ recommendations }: TemplateRecommendationsProps) {
  const [open, setOpen] = useState(true);

  const filtered = recommendations.filter(r => r.notes || r.isHighlight || (r.rating && r.rating >= 3));
  if (filtered.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
          ✍️ Tips from the original author
        </span>
        <span className="text-amber-400/60 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2.5">
          {filtered.map((rec, i) => (
            <div key={i} className="rounded-md bg-black/20 px-3 py-2 space-y-0.5">
              {rec.location && (
                <p className="text-xs font-semibold text-zinc-200">
                  📍 {rec.location}
                  {rec.isHighlight && <span className="ml-1.5 text-amber-400">★ Highlight</span>}
                </p>
              )}
              {rec.rating && rec.rating > 0 && (
                <p className="text-amber-400 text-xs">{RATING_STARS(rec.rating)}</p>
              )}
              {(rec.notes || rec.tips) && (
                <p className="text-xs text-zinc-400 leading-relaxed">
                  &ldquo;{rec.notes || rec.tips}&rdquo;
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
