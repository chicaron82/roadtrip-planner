import type { TripSummary, TripSettings } from '../../types';
import { Card, CardContent } from '../UI/Card';
import { formatDistance, formatDuration, formatCurrency } from '../../lib/calculations';
import { Button } from '../UI/Button';
import { Car, Clock, Fuel, Users } from 'lucide-react';

interface TripSummaryProps {
  summary: TripSummary | null;
  settings: TripSettings;
  onStop?: () => void;
  tripActive: boolean;
}

export function TripSummaryCard({ summary, settings, onStop, tripActive }: TripSummaryProps) {
  if (!summary) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 z-[1000] animate-in slide-in-from-bottom duration-500">
      <Card className="bg-white/90 backdrop-blur-md shadow-xl border-white/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-3">
                {tripActive && <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />}
                <span className="font-bold text-lg">{tripActive ? "Trip Active" : "Trip Summary"}</span>
             </div>
             {tripActive && onStop && (
                 <Button variant="destructive" size="sm" onClick={onStop}>End Trip</Button>
             )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-1">
                    <Car className="w-4 h-4 text-blue-600" />
                    <div className="text-[10px] uppercase tracking-wider text-blue-600 font-semibold">Distance</div>
                </div>
                <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
                    {formatDistance(summary.totalDistanceKm, settings.units)}
                </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-100 dark:border-amber-800">
                <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <div className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold">Time</div>
                </div>
                <div className="text-lg font-bold text-amber-700 dark:text-amber-400">
                    {formatDuration(summary.totalDurationMinutes)}
                </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border border-green-100 dark:border-green-800">
                <div className="flex items-center gap-2 mb-1">
                    <Fuel className="w-4 h-4 text-green-600" />
                    <div className="text-[10px] uppercase tracking-wider text-green-600 font-semibold">Fuel Cost</div>
                </div>
                <div className="text-lg font-bold text-green-700 dark:text-green-400">
                    {formatCurrency(summary.totalFuelCost, settings.currency)}
                </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 border border-purple-100 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-purple-600" />
                    <div className="text-[10px] uppercase tracking-wider text-purple-600 font-semibold">Per Person</div>
                </div>
                <div className="text-lg font-bold text-purple-700 dark:text-purple-400">
                    {formatCurrency(summary.costPerPerson, settings.currency)}
                </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
