import type { TripSummary, TripSettings } from '../../types';
import { Card, CardContent } from '../UI/Card';
import { formatDistance, formatDuration, formatCurrency } from '../../lib/calculations';
import { getWeatherEmoji } from '../../lib/weather';
import { Button } from '../UI/Button';
import { Car, Clock, Fuel, Users, MapPin } from 'lucide-react';
import { TripOverview } from './TripOverview';

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

          {/* Trip Overview - Difficulty & Confidence */}
          <TripOverview summary={summary} settings={settings} />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-1">
                    <Car className="w-4 h-4 text-blue-600" />
                    <div className="text-[10px] uppercase tracking-wider text-blue-600 font-semibold">Distance</div>
                </div>
                <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
                    {formatDistance(summary.totalDistanceKm, settings.units)}
                    {settings.isRoundTrip && <span className="text-xs ml-1 font-normal opacity-70">(x2)</span>}
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
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 max-h-68 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
               <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Itinerary</h3>
               <Button 
                 variant="outline" 
                 size="sm" 
                 className="h-6 text-xs gap-1"
                 onClick={() => {
                   const origin = summary.segments[0].from;
                   const dest = summary.segments[summary.segments.length - 1].to;
                   const waypoints = summary.segments.slice(0, -1).map(s => s.to).map(l => `${l.lat},${l.lng}`).join('|');
                   window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}&waypoints=${waypoints}&travelmode=driving`, '_blank');
                 }}
               >
                 <MapPin className="w-3 h-3" /> Check Traffic
               </Button>
            </div>
            <div className="space-y-3">
              {summary.segments.map((seg, i) => {
                 const prevTz = i > 0 ? summary.segments[i-1].weather?.timezone : null;
                 const currTz = seg.weather?.timezone;
                 const tzChanged = prevTz && currTz && prevTz !== currTz;

                 return (
                  <div key={i}>
                    {tzChanged && (
                       <div className="mb-2 mx-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded p-1.5 text-xs text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          <span>Time Zone Change: {summary.segments[i-1].weather?.timezoneAbbr} ➝ {seg.weather?.timezoneAbbr}</span>
                       </div>
                    )}
                    <div className="flex items-start gap-3 text-sm">
                      <div className="flex flex-col items-center mt-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        {i < summary.segments.length - 1 && <div className="w-0.5 h-full bg-gray-200 dark:bg-gray-700 my-1 min-h-[40px]" />}
                      </div>
                      <div className="flex-1 pb-2">
                        <div className="font-medium">{seg.to.name || seg.to.address?.split(',')[0]}</div>
                        <div className="text-xs text-muted-foreground flex gap-3 mt-1">
                          <span>{formatDistance(seg.distanceKm, settings.units)}</span>
                          <span>{formatDuration(seg.durationMinutes)}</span>
                        </div>
                        {seg.weather && (
                          <div className="mt-1.5 flex items-center gap-2 bg-blue-50/50 dark:bg-blue-900/10 rounded-md p-1.5 text-xs text-blue-700 dark:text-blue-300 w-fit">
                              <span>{getWeatherEmoji(seg.weather.weatherCode)}</span>
                              <span className="font-medium">{Math.round(seg.weather.temperatureMax)}° / {Math.round(seg.weather.temperatureMin)}°</span>
                              <span className="opacity-70 mx-1">|</span>
                              <span>{seg.weather.timezoneAbbr || seg.weather.timezone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
