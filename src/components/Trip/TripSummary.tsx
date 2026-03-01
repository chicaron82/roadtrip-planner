import { useState, useMemo, useEffect, useRef } from 'react';
import type { TripSummary, TripSettings } from '../../types';
import { formatDistance, formatDuration, formatCurrency } from '../../lib/calculations';
import { Car, Fuel, Users, TrendingDown, TrendingUp, Gauge, ChevronUp, ChevronDown } from 'lucide-react';
import { TripOverview } from './TripOverview';
import { FeasibilityBanner } from './FeasibilityBanner';
import { BudgetSensitivity } from './BudgetSensitivity';
import { HoursTradeoff } from './HoursTradeoff';
import { analyzeFeasibility } from '../../lib/feasibility';

// ─── Count-up hook: eases a number from 0 → target over ~700 ms ────────────────
function useCountUp(target: number, duration = 700): number {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);
  return val;
}

interface TripSummaryProps {
  summary: TripSummary | null;
  settings: TripSettings;
  onStop?: () => void;
  tripActive: boolean;
  onOpenVehicleTab?: () => void;
}

export function TripSummaryCard({ summary, settings, onStop, tripActive, onOpenVehicleTab }: TripSummaryProps) {
  const [isMinimized, setIsMinimized] = useState(true);

  const feasibility = useMemo(
    () => summary ? analyzeFeasibility(summary, settings) : null,
    [summary, settings],
  );

  // Animated stat values — count up from 0 on first render
  const animDistKm      = useCountUp(summary?.totalDistanceKm     ?? 0);
  const animDurationMin = useCountUp(summary?.totalDurationMinutes ?? 0);
  const animFuelCost    = useCountUp(summary?.totalFuelCost        ?? 0);
  const animPerPerson   = useCountUp(summary?.costPerPerson        ?? 0);

  if (!summary) return null;

  const cardBg  = 'rgba(13,13,16,0.93)';
  const borderC = 'rgba(245,240,232,0.09)';

  return (
    <div className="animate-in slide-in-from-bottom duration-500 max-h-[85vh] flex flex-col">
      <div
        className="rounded-[20px] shadow-2xl flex-1 overflow-hidden flex flex-col transition-all duration-300"
        style={{ background: cardBg, border: `1px solid ${borderC}`, backdropFilter: 'blur(24px)' }}
      >
        <div className="p-4 flex-1 overflow-y-auto flex flex-col">
          {/* Header */}
          <div
            className="flex items-center justify-between mb-4 sticky top-0 z-10 -mx-4 px-4 py-2 rounded-t-[20px]"
            style={{ background: cardBg, borderBottom: `1px solid ${borderC}` }}
          >
            <div className="flex items-center gap-3">
              {tripActive && <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />}
              <span className="font-bold text-base" style={{ color: 'rgba(245,240,232,0.88)', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.01em' }}>
                {tripActive ? 'Trip Active' : 'Trip Summary'}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onOpenVehicleTab && !tripActive && (
                <button
                  onClick={onOpenVehicleTab}
                  className="h-7 px-2.5 rounded-full text-[11px] font-medium flex items-center gap-1 transition-all"
                  style={{ background: 'rgba(245,240,232,0.07)', border: '1px solid rgba(245,240,232,0.12)', color: 'rgba(245,240,232,0.55)' }}
                >
                  <Car className="w-3 h-3" />
                  Edit Vehicle
                </button>
              )}
              {tripActive && onStop && (
                <button
                  onClick={onStop}
                  className="h-7 px-2.5 rounded-full text-[11px] font-medium transition-all"
                  style={{ background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                >
                  End Trip
                </button>
              )}
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="h-7 w-7 flex items-center justify-center rounded-full transition-all"
                style={{ color: 'rgba(245,240,232,0.35)' }}
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Stat Tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded-lg p-2 border" style={{ background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.22)' }}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Car className="w-3.5 h-3.5 text-blue-400" />
                <div className="text-[9px] uppercase tracking-wider text-blue-400 font-semibold">Distance</div>
              </div>
              <div className="text-base font-bold text-blue-300">
                {formatDistance(animDistKm, settings.units)}
                {settings.isRoundTrip && <span className="text-xs ml-1 font-normal opacity-70">(x2)</span>}
              </div>
              {summary.gasStops > 0 && (
                <div className="text-[9px] mt-0.5 flex items-center gap-1" style={{ color: 'rgba(147,197,253,0.55)' }}>
                  <Gauge className="w-2.5 h-2.5" />
                  {summary.gasStops} fill-up{summary.gasStops !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            <div className="rounded-lg p-2 border" style={{ background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.22)' }}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="text-[9px] uppercase tracking-wider text-amber-400 font-semibold">⏱ Drive Time</div>
              </div>
              <div className="text-base font-bold text-amber-300">
                {formatDuration(Math.round(animDurationMin))}
              </div>
              <div className="text-[9px] mt-0.5" style={{ color: 'rgba(252,211,77,0.45)' }}>excl. stops</div>
            </div>

            <div className="rounded-lg p-2 border" style={{ background: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.22)' }}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Fuel className="w-3.5 h-3.5 text-green-400" />
                <div className="text-[9px] uppercase tracking-wider text-green-400 font-semibold">Fuel Cost</div>
              </div>
              <div className="text-base font-bold text-green-300">
                {formatCurrency(animFuelCost, settings.currency)}
              </div>
            </div>

            <div className="rounded-lg p-2 border" style={{ background: 'rgba(168,85,247,0.1)', borderColor: 'rgba(168,85,247,0.22)' }}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Users className="w-3.5 h-3.5 text-purple-400" />
                <div className="text-[9px] uppercase tracking-wider text-purple-400 font-semibold">Per Person</div>
              </div>
              <div className="text-base font-bold text-purple-300">
                {formatCurrency(animPerPerson, settings.currency)}
              </div>
            </div>
          </div>

          {/* Budget status row */}
          {summary.budgetStatus && summary.budgetRemaining !== undefined && settings.budget.total > 0 && (
            <div
              className="mt-3 rounded-xl px-3 py-2 flex items-center justify-between text-sm border"
              style={summary.budgetStatus === 'over'
                ? { background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.25)' }
                : { background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.25)' }
              }
            >
              <div className={`flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wider ${
                summary.budgetStatus === 'over' ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {summary.budgetStatus === 'over'
                  ? <TrendingUp className="w-3.5 h-3.5" />
                  : <TrendingDown className="w-3.5 h-3.5" />
                }
                {summary.budgetStatus === 'over' ? 'Over budget' : 'Under budget'}
              </div>
              <div className={`font-bold ${
                summary.budgetStatus === 'over' ? 'text-red-300' : 'text-emerald-300'
              }`}>
                {formatCurrency(Math.abs(summary.budgetRemaining), settings.currency)}
              </div>
            </div>
          )}

          {!isMinimized && (
            <div className="mt-4 animate-in fade-in duration-300">
              {/* Trip Overview - Difficulty & Confidence */}
              <TripOverview summary={summary} settings={settings} />

              {/* What-If Budget Scenarios */}
              {summary.costBreakdown && (
                <BudgetSensitivity summary={summary} settings={settings} className="mt-3" />
              )}

              {/* Hours Tradeoff — drive days vs free days for multi-driver round trips */}
              {settings.isRoundTrip && settings.numDrivers >= 2 && summary.days && (
                <HoursTradeoff summary={summary} settings={settings} className="mt-3" />
              )}

              {/* Feasibility Health Check */}
              {feasibility && (
                <FeasibilityBanner result={feasibility} numTravelers={settings.numTravelers} className="mt-3" defaultCollapsed />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
