import { Trophy, Clock, MapPin, Fuel } from 'lucide-react';
import type { TripSummary, TripSettings } from '../../types';

interface ItineraryTimelineProps {
  summary: TripSummary;
  settings: TripSettings;
}

const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

export function ItineraryTimeline({ summary, settings }: ItineraryTimelineProps) {
  const startTime = new Date(`${settings.departureDate}T${settings.departureTime}`);
  
  // Advanced Simulation Logic for "Smart Itinerary"
  interface SimulationItem {
      type: 'gas' | 'stop';
      arrivalTime: Date;
      cost?: number;
      litres?: number;
      segment?: any;
      index?: number;
  }
  
  const simulationItems: SimulationItem[] = [];
  let currentTime = new Date(startTime);
  
  const VIRTUAL_TANK_CAPACITY = 55; 
  let currentFuel = VIRTUAL_TANK_CAPACITY;

  for (let i = 0; i < summary.segments.length; i++) {
      const segment = summary.segments[i];
      const fuelNeeded = segment.fuelNeededLitres;
      
      if (currentFuel - fuelNeeded < (VIRTUAL_TANK_CAPACITY * 0.15)) {
           // Insert Gas Stop
           const refillAmount = VIRTUAL_TANK_CAPACITY - currentFuel;
           const refillCost = refillAmount * settings.gasPrice;
           const stopDurationMinutes = 15;
           
           const stopTime = new Date(currentTime);
           currentTime = new Date(currentTime.getTime() + (stopDurationMinutes * 60 * 1000));
           currentFuel = VIRTUAL_TANK_CAPACITY; // Refilled
           
           simulationItems.push({
               type: 'gas',
               arrivalTime: stopTime,
               cost: refillCost,
               litres: refillAmount
           });
      }
      
      // Drive the segment
      const durationMs = (segment.durationMinutes || 0) * 60 * 1000;
      currentTime = new Date(currentTime.getTime() + durationMs);
      currentFuel -= fuelNeeded;
      
      // Arrive at Waypoint
      simulationItems.push({
          type: 'stop',
          segment: segment,
          arrivalTime: new Date(currentTime),
          index: i
      });
  }

  return (
    <div className="space-y-0 pt-2 relative pb-12">
       {/* Timeline Line (Background) */}
       <div className="absolute left-[19px] top-4 bottom-0 w-0.5 bg-border -z-10"></div>

      {/* Start Node */}
      <div className="flex gap-4 mb-8">
          <div className="relative">
             <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center border-2 border-green-200 shadow-sm z-10">
                <MapPin className="h-5 w-5" />
             </div>
          </div>
          <div className="pt-1">
              <div className="text-xs font-bold text-green-600 uppercase tracking-wider mb-0.5">Start</div>
              <div className="font-bold text-xl">{summary.segments[0]?.from.name || "Origin"}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                  <Clock className="h-3 w-3" /> {formatDate(startTime)} • {formatTime(startTime)}
                  {settings.useArrivalTime && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">CALCULATED</span>}
              </div>
          </div>
      </div>

      {/* Simulation Items */}
      {simulationItems.map((item, idx) => {
          if (item.type === 'gas') {
              return (
                  <div key={`gas-${idx}`} className="flex gap-4 mb-8 relative animate-in fade-in slide-in-from-left-4 duration-500">
                      <div className="relative">
                         <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center border-2 border-white ring-2 ring-orange-200 shadow-sm z-10 bg-white">
                            <Fuel className="h-5 w-5" />
                         </div>
                      </div>
                      <div className="pt-0 flex-1">
                          <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 shadow-sm">
                              <div className="flex justify-between items-start">
                                  <div>
                                      <div className="font-bold text-orange-800 text-sm">Recommended Gas Stop</div>
                                      <div className="text-xs text-orange-600 mt-0.5">Tracked fuel is low (&lt;15%).</div>
                                  </div>
                                  <div className="text-right">
                                      <div className="font-bold text-orange-700">${item.cost?.toFixed(2)}</div>
                                      <div className="text-xs text-orange-600">~{item.litres?.toFixed(0)}L</div>
                                  </div>
                              </div>
                              <div className="mt-2 text-xs flex items-center gap-2 text-orange-700/70 border-t border-orange-100/50 pt-2">
                                  <Clock className="h-3 w-3" /> +15 min stop calculated
                              </div>
                          </div>
                      </div>
                  </div>
              );
          }
          
          const { segment, arrivalTime, index } = item;
          const isDest = index === summary.segments.length - 1;
          
          return (
             <div key={`stop-${index}`} className="flex gap-4 mb-8 group">
                  <div className="relative">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 shadow-sm z-10 bg-white transition-colors duration-300 ${
                         isDest 
                         ? 'bg-yellow-100 text-yellow-600 border-yellow-200' 
                         : 'bg-white text-muted-foreground border-slate-200 group-hover:border-blue-400 group-hover:text-blue-500'
                     }`}>
                        {isDest ? <Trophy className="h-5 w-5" /> : <span className="font-mono text-xs font-bold">{typeof index === 'number' ? index + 1 : ''}</span>}
                     </div>
                  </div>
                  
                  <div className="flex-1 pt-1">
                      {/* Drive Segment Info (Above the Stop) */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 pl-1">
                           <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                               <span>🚗</span>
                               <span>{segment?.distanceKm.toFixed(0)} km</span>
                           </div>
                           <span className="text-slate-300">•</span>
                           <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" /> 
                                <span>{Math.floor((segment?.durationMinutes || 0)/60)}h {(segment?.durationMinutes || 0)%60}m</span>
                           </div>
                           <span className="text-slate-300">•</span>
                           <div className="text-green-600 font-medium">
                               ${segment?.fuelCost.toFixed(2)} fuel
                           </div>
                      </div>

                      {/* The Stop Card */}
                      <div className={`rounded-xl border p-4 shadow-sm transition-all duration-300 ${isDest ? 'bg-yellow-50/50 border-yellow-200' : 'bg-card hover:bg-slate-50 hover:border-blue-200'}`}>
                          <div className="flex justify-between items-start mb-1">
                                <div>
                                    <div className="text-xs font-bold uppercase tracking-wider mb-0.5 text-muted-foreground">
                                        {isDest ? 'Destinaton' : 'Waypoint'}
                                    </div>
                                    <div className="font-bold text-lg leading-tight">{segment?.to.name}</div>
                                </div>
                                <div className="text-sm font-mono font-bold bg-muted/80 px-2 py-1 rounded text-foreground">
                                    {formatTime(arrivalTime)}
                                </div>
                          </div>
                          
                          {/* Weather & Metadata */}
                          <div className="flex flex-wrap items-center gap-2 mt-3">
                                {segment?.weather && (
                                    <div className="flex items-center gap-1.5 bg-sky-50 text-sky-700 px-2 py-1 rounded-md text-xs border border-sky-100 font-medium">
                                        <span className="text-base">
                                            {segment.weather.weatherCode !== undefined ? (
                                                segment.weather.temperatureMax > 25 ? '☀️' : 
                                                (segment.weather.precipitationProb > 40 ? '🌧️' : 
                                                (segment.weather.weatherCode > 3 ? '☁️' : '🌤️'))
                                            ) : '🌡️'}
                                        </span>
                                        <span>{segment.weather.temperatureMax}°C</span>
                                        <span className="text-sky-400 pl-1 border-l border-sky-200">
                                            {segment.weather.precipitationProb}% rain
                                        </span>
                                    </div>
                                )}
                          </div>
                      </div>
                  </div>
             </div>
          );
      })}
    </div>
  );
}
