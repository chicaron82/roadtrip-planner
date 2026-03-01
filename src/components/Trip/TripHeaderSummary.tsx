import { Car, Fuel, Calendar } from 'lucide-react';
import type { TripSummary } from '../../types';

interface TripHeaderSummaryProps {
  summary: TripSummary;
  drivingDays: number;
  freeDays: number;
}

export function TripHeaderSummary({ summary, drivingDays, freeDays }: TripHeaderSummaryProps) {
  const totalKm = summary.totalDistanceKm;
  const totalFuel = summary.totalFuelCost;
  const totalDays = drivingDays + freeDays;

  return (
    <div className="rounded-xl border bg-gradient-to-r from-slate-50 to-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Car className="h-4 w-4 text-blue-500" />
          <span className="font-semibold">{Math.round(totalKm).toLocaleString()} km</span>
        </div>
        <div className="h-4 w-px bg-slate-200" />
        <div className="flex items-center gap-2">
          <Fuel className="h-4 w-4 text-orange-500" />
          <span className="font-semibold">${totalFuel.toFixed(0)} fuel</span>
        </div>
        <div className="h-4 w-px bg-slate-200" />
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-purple-500" />
          <span className="font-semibold">
            {totalDays} day{totalDays !== 1 ? 's' : ''}
            {freeDays > 0 && (
              <span className="text-muted-foreground font-normal ml-1">
                ({drivingDays} driving, {freeDays} free)
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
