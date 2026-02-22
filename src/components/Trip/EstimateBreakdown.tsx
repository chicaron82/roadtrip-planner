/**
 * EstimateBreakdown — Cost estimate card shown in estimate mode.
 *
 * Extracted from Step3Content to keep that file under control.
 * Pure display: takes a TripEstimate, renders header total + per-category rows.
 */

import type { TripEstimate } from '../../lib/estimate-service';

interface EstimateBreakdownProps {
  estimate: TripEstimate;
}

export function EstimateBreakdown({ estimate }: EstimateBreakdownProps) {
  return (
    <div
      className="rounded-xl border border-blue-500/30 p-5 space-y-4"
      style={{ background: 'linear-gradient(135deg, hsla(220, 60%, 20%, 0.5), hsla(240, 40%, 15%, 0.5))' }}
    >
      {/* Hero total */}
      <div className="text-center">
        <p className="text-xs font-mono tracking-widest text-blue-400 uppercase mb-1">Estimated Trip Cost</p>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-sm text-muted-foreground">{estimate.currency}</span>
          <span className="text-4xl font-extrabold text-blue-300">{estimate.totalMid.toLocaleString()}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Range: {estimate.currency}{estimate.totalLow.toLocaleString()} – {estimate.currency}{estimate.totalHigh.toLocaleString()}
        </p>
        {estimate.numTravelers > 1 && (
          <p className="text-xs text-blue-400 font-medium mt-1">
            ~{estimate.currency}{estimate.perPersonMid.toLocaleString()} per person
          </p>
        )}
      </div>

      {/* Category rows */}
      <div className="space-y-2">
        {estimate.breakdown.map((item) => (
          <div
            key={item.category}
            className="flex items-center justify-between p-2.5 rounded-lg border border-blue-500/20"
            style={{ background: 'hsla(225, 22%, 15%, 0.7)' }}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-lg">{item.emoji}</span>
              <div>
                <div className="text-sm font-medium">{item.category}</div>
                {item.note && <div className="text-[10px] text-muted-foreground">{item.note}</div>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold">
                {estimate.currency}{item.mid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {estimate.currency}{item.low.toLocaleString(undefined, { maximumFractionDigits: 0 })} – {estimate.currency}{item.high.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-center text-muted-foreground/60 leading-relaxed">
        Estimates based on regional averages. Actual costs depend on season, location, and personal spending habits.
      </p>
    </div>
  );
}
