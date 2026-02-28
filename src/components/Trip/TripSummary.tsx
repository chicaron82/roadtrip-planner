import { useState, useMemo } from 'react';
import type { TripSummary, TripSettings } from '../../types';
import { Card, CardContent } from '../UI/Card';
import { formatDistance, formatDuration, formatCurrency } from '../../lib/calculations';
import { Car, Fuel, Users, TrendingDown, TrendingUp, Gauge, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '../UI/Button';
import { TripOverview } from './TripOverview';
import { FeasibilityBanner } from './FeasibilityBanner';
import { BudgetSensitivity } from './BudgetSensitivity';
import { HoursTradeoff } from './HoursTradeoff';
import { analyzeFeasibility } from '../../lib/feasibility';

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

  if (!summary) return null;

  return (
    <div className="animate-in slide-in-from-bottom duration-500 max-h-[85vh] flex flex-col">
      <Card className="bg-white/90 backdrop-blur-md shadow-xl border-white/20 flex-1 overflow-hidden flex flex-col transition-all duration-300">
        <CardContent className="p-4 flex-1 overflow-y-auto flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 sticky top-0 bg-white/90 backdrop-blur-md z-10 -mx-4 px-4 py-2">
            <div className="flex items-center gap-3">
              {tripActive && <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />}
              <span className="font-bold text-lg">{tripActive ? 'Trip Active' : 'Trip Summary'}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onOpenVehicleTab && !tripActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenVehicleTab}
                  className="h-7 text-xs gap-1"
                >
                  <Car className="w-3 h-3" />
                  Edit Vehicle
                </Button>
              )}
              {tripActive && onStop && (
                <Button variant="destructive" size="sm" onClick={onStop}>End Trip</Button>
              )}
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
                title={isMinimized ? "Expand" : "Minimize"}
              >
                {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Stat Tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 border border-blue-100 dark:border-blue-800">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Car className="w-3.5 h-3.5 text-blue-600" />
                <div className="text-[9px] uppercase tracking-wider text-blue-600 font-semibold">Distance</div>
              </div>
              <div className="text-base font-bold text-blue-700 dark:text-blue-400">
                {formatDistance(summary.totalDistanceKm, settings.units)}
                {settings.isRoundTrip && <span className="text-xs ml-1 font-normal opacity-70">(x2)</span>}
              </div>
              {summary.gasStops > 0 && (
                <div className="text-[9px] text-blue-500/70 mt-0.5 flex items-center gap-1">
                  <Gauge className="w-2.5 h-2.5" />
                  {summary.gasStops} fill-up{summary.gasStops !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 border border-amber-100 dark:border-amber-800">
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="text-[9px] uppercase tracking-wider text-amber-600 font-semibold">⏱ Drive Time</div>
              </div>
              <div className="text-base font-bold text-amber-700 dark:text-amber-400">
                {formatDuration(summary.totalDurationMinutes)}
              </div>
              <div className="text-[9px] text-amber-500/70 mt-0.5">excl. stops</div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 border border-green-100 dark:border-green-800">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Fuel className="w-3.5 h-3.5 text-green-600" />
                <div className="text-[9px] uppercase tracking-wider text-green-600 font-semibold">Fuel Cost</div>
              </div>
              <div className="text-base font-bold text-green-700 dark:text-green-400">
                {formatCurrency(summary.totalFuelCost, settings.currency)}
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2 border border-purple-100 dark:border-purple-800">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Users className="w-3.5 h-3.5 text-purple-600" />
                <div className="text-[9px] uppercase tracking-wider text-purple-600 font-semibold">Per Person</div>
              </div>
              <div className="text-base font-bold text-purple-700 dark:text-purple-400">
                {formatCurrency(summary.costPerPerson, settings.currency)}
              </div>
            </div>
          </div>

          {/* Budget status row */}
          {summary.budgetStatus && summary.budgetRemaining !== undefined && settings.budget.total > 0 && (
            <div className={`mt-3 rounded-xl px-3 py-2 flex items-center justify-between text-sm border ${
              summary.budgetStatus === 'over'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800'
                : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800'
            }`}>
              <div className={`flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wider ${
                summary.budgetStatus === 'over' ? 'text-red-600' : 'text-emerald-600'
              }`}>
                {summary.budgetStatus === 'over'
                  ? <TrendingUp className="w-3.5 h-3.5" />
                  : <TrendingDown className="w-3.5 h-3.5" />
                }
                {summary.budgetStatus === 'over' ? 'Over budget' : 'Under budget'}
              </div>
              <div className={`font-bold ${summary.budgetStatus === 'over' ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
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
        </CardContent>
      </Card>
    </div>
  );
}
