import { Car, Fuel, Calendar } from 'lucide-react';
import type { TripHeaderSummaryData } from '../../../lib/trip-summary-slices';

interface TripHeaderSummaryProps {
  summary: TripHeaderSummaryData;
  drivingDays: number;
  freeDays: number;
}

export function TripHeaderSummary({ summary, drivingDays, freeDays }: TripHeaderSummaryProps) {
  const totalKm = summary.totalDistanceKm;
  const totalFuel = summary.totalFuelCost;
  const totalDays = drivingDays + freeDays;

  return (
    <div className="rounded-xl border border-border bg-muted/20 shadow-sm overflow-hidden">
      {/* MEE brand accent — orange gradient top border */}
      <div className="h-0.5 bg-gradient-to-r from-orange-600 via-orange-400 to-orange-500" />
      <div className="flex flex-wrap items-stretch p-4 gap-0 divide-x divide-border">

        {/* DISTANCE */}
        <div className="flex-1 min-w-[110px] flex flex-col gap-1 pr-4">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Distance</span>
          <div className="flex items-baseline gap-1.5">
            <Car className="h-3.5 w-3.5 text-blue-400 self-center flex-shrink-0" />
            <span className="text-2xl font-bold text-foreground leading-none tabular-nums">
              {Math.round(totalKm).toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">km</span>
          </div>
        </div>

        {/* FUEL EST. */}
        <div className="flex-1 min-w-[110px] flex flex-col gap-1 px-4">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Fuel Est.</span>
          <div className="flex items-baseline gap-1.5">
            <Fuel className="h-3.5 w-3.5 text-orange-400 self-center flex-shrink-0" />
            <span className="text-2xl font-bold text-foreground leading-none tabular-nums">
              ${totalFuel.toFixed(0)}
            </span>
          </div>
        </div>

        {/* TRIP LENGTH */}
        <div className="flex-1 min-w-[110px] flex flex-col gap-1 pl-4">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Trip Length</span>
          <div className="flex items-baseline gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-purple-400 self-center flex-shrink-0" />
            <span className="text-2xl font-bold text-foreground leading-none tabular-nums">
              {totalDays}
            </span>
            <span className="text-xs text-muted-foreground">day{totalDays !== 1 ? 's' : ''}</span>
          </div>
          {freeDays > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {drivingDays} driving · {freeDays} free
            </span>
          )}
        </div>

      </div>
    </div>
  );
}
