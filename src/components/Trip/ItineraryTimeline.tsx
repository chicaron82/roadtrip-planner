import { useState, useMemo } from 'react';
import { Trophy, Clock, MapPin, Fuel, Sparkles } from 'lucide-react';
import type { TripSummary, TripSettings, RouteSegment, Vehicle } from '../../types';
import { SmartSuggestions } from './SmartSuggestions';
import { SuggestedStopCard } from './SuggestedStopCard';
import { generatePacingSuggestions } from '../../lib/segment-analyzer';
import { generateSmartStops, createStopConfig, type SuggestedStop } from '../../lib/stop-suggestions';
import { Button } from '../UI/Button';
import { formatTime as formatTimeWithTz, STOP_LABELS } from '../../lib/calculations';

interface ItineraryTimelineProps {
  summary: TripSummary;
  settings: TripSettings;
  vehicle?: Vehicle;
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (date: Date) => {
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

export function ItineraryTimeline({ summary, settings, vehicle }: ItineraryTimelineProps) {
  const startTime = useMemo(
    () => new Date(`${settings.departureDate}T${settings.departureTime}`),
    [settings.departureDate, settings.departureTime]
  );

  // Generate smart suggestions
  const pacingSuggestions = generatePacingSuggestions(
    summary.totalDurationMinutes,
    settings
  );

  // Generate smart stop suggestions
  const [stopSuggestions, setStopSuggestions] = useState<SuggestedStop[]>(() => {
    if (!vehicle) return [];
    const config = createStopConfig(vehicle, settings);
    return generateSmartStops(summary.segments, config);
  });

  // Show/hide suggestions panel
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Handle accept/dismiss
  const handleAccept = (stopId: string) => {
    setStopSuggestions(prev =>
      prev.map(s => s.id === stopId ? { ...s, accepted: true } : s)
    );
  };

  const handleDismiss = (stopId: string) => {
    setStopSuggestions(prev =>
      prev.map(s => s.id === stopId ? { ...s, dismissed: true } : s)
    );
  };

  // Filter active suggestions (not dismissed)
  const activeSuggestions = useMemo(() =>
    stopSuggestions.filter(s => !s.dismissed),
    [stopSuggestions]
  );

  // Build simulation items including accepted stops
  const simulationItems = useMemo(() => {
    interface SimulationItem {
      type: 'gas' | 'stop' | 'suggested';
      arrivalTime: Date;
      cost?: number;
      litres?: number;
      segment?: RouteSegment;
      index?: number;
      suggestedStop?: SuggestedStop;
    }

    const items: SimulationItem[] = [];
    let currentTime = new Date(startTime);

    const VIRTUAL_TANK_CAPACITY = vehicle?.tankSize || 55;
    let currentFuel = VIRTUAL_TANK_CAPACITY;

    // Get accepted stops grouped by segment index
    const acceptedBySegment = new Map<number, SuggestedStop[]>();
    activeSuggestions.filter(s => s.accepted).forEach(stop => {
      const existing = acceptedBySegment.get(stop.afterSegmentIndex) || [];
      acceptedBySegment.set(stop.afterSegmentIndex, [...existing, stop]);
    });

    for (let i = 0; i < summary.segments.length; i++) {
      const segment = summary.segments[i];
      const fuelNeeded = segment.fuelNeededLitres;

      // Check for fuel stop (legacy inline calculation for non-accepted suggestions)
      if (currentFuel - fuelNeeded < (VIRTUAL_TANK_CAPACITY * 0.15)) {
        // Only show if not already accepted
        const hasAcceptedFuelStop = acceptedBySegment.get(i - 1)?.some(s => s.type === 'fuel');
        if (!hasAcceptedFuelStop) {
          const refillAmount = VIRTUAL_TANK_CAPACITY - currentFuel;
          const refillCost = refillAmount * settings.gasPrice;
          const stopDurationMinutes = 15;

          const stopTime = new Date(currentTime);
          currentTime = new Date(currentTime.getTime() + (stopDurationMinutes * 60 * 1000));
          currentFuel = VIRTUAL_TANK_CAPACITY;

          items.push({
            type: 'gas',
            arrivalTime: stopTime,
            cost: refillCost,
            litres: refillAmount
          });
        }
      }

      // Insert accepted suggested stops before this segment
      const stopsBeforeSegment = acceptedBySegment.get(i - 1) || [];
      stopsBeforeSegment.forEach(stop => {
        items.push({
          type: 'suggested',
          arrivalTime: new Date(currentTime),
          suggestedStop: stop
        });
        currentTime = new Date(currentTime.getTime() + (stop.duration * 60 * 1000));

        // Handle fuel refill for accepted fuel stops
        if (stop.type === 'fuel') {
          currentFuel = VIRTUAL_TANK_CAPACITY;
        }
      });

      // Drive the segment
      const durationMs = (segment.durationMinutes || 0) * 60 * 1000;
      currentTime = new Date(currentTime.getTime() + durationMs);
      currentFuel -= fuelNeeded;

      // Arrive at waypoint
      items.push({
        type: 'stop',
        segment: segment,
        arrivalTime: new Date(currentTime),
        index: i
      });

      // Insert accepted stops after this segment
      const stopsAfterSegment = acceptedBySegment.get(i) || [];
      stopsAfterSegment.forEach(stop => {
        items.push({
          type: 'suggested',
          arrivalTime: new Date(currentTime),
          suggestedStop: stop
        });
        currentTime = new Date(currentTime.getTime() + (stop.duration * 60 * 1000));

        if (stop.type === 'fuel') {
          currentFuel = VIRTUAL_TANK_CAPACITY;
        }
      });
    }

    return items;
  }, [summary.segments, startTime, settings.gasPrice, activeSuggestions, vehicle?.tankSize]);

  // Pending suggestions (not yet accepted or dismissed)
  const pendingSuggestions = activeSuggestions.filter(s => !s.accepted);

  return (
    <div className="space-y-6">
      {/* Smart Suggestions */}
      <SmartSuggestions suggestions={pacingSuggestions} />

      {/* Smart Stop Suggestions Panel */}
      {pendingSuggestions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <h3 className="text-sm font-semibold">Smart Stop Suggestions</h3>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                {pendingSuggestions.length} suggestion{pendingSuggestions.length !== 1 ? 's' : ''}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="text-xs"
            >
              {showSuggestions ? 'Hide' : 'Show'}
            </Button>
          </div>

          {showSuggestions && (
            <div className="space-y-3">
              {pendingSuggestions.map(stop => (
                <SuggestedStopCard
                  key={stop.id}
                  stop={stop}
                  onAccept={handleAccept}
                  onDismiss={handleDismiss}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
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

          if (item.type === 'suggested' && item.suggestedStop) {
            const stop = item.suggestedStop;
            return (
              <div key={`suggested-${idx}`} className="flex gap-4 mb-8 relative animate-in fade-in slide-in-from-left-4 duration-500">
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 shadow-sm z-10 bg-white ${
                    stop.type === 'fuel' ? 'bg-orange-100 text-orange-600 border-orange-200' :
                    stop.type === 'rest' ? 'bg-amber-100 text-amber-600 border-amber-200' :
                    stop.type === 'meal' ? 'bg-green-100 text-green-600 border-green-200' :
                    'bg-indigo-100 text-indigo-600 border-indigo-200'
                  }`}>
                    {stop.type === 'fuel' ? <Fuel className="h-5 w-5" /> :
                     stop.type === 'rest' ? '☕' :
                     stop.type === 'meal' ? '🍽️' : '🏨'}
                  </div>
                </div>
                <div className="pt-0 flex-1">
                  <div className={`rounded-xl p-3 shadow-sm border ${
                    stop.type === 'fuel' ? 'bg-orange-50 border-orange-200' :
                    stop.type === 'rest' ? 'bg-amber-50 border-amber-200' :
                    stop.type === 'meal' ? 'bg-green-50 border-green-200' :
                    'bg-indigo-50 border-indigo-200'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className={`font-bold text-sm flex items-center gap-2 ${
                          stop.type === 'fuel' ? 'text-orange-800' :
                          stop.type === 'rest' ? 'text-amber-800' :
                          stop.type === 'meal' ? 'text-green-800' :
                          'text-indigo-800'
                        }`}>
                          {stop.type === 'fuel' ? 'Fuel Stop' :
                           stop.type === 'rest' ? 'Rest Break' :
                           stop.type === 'meal' ? 'Meal Stop' : 'Overnight Stay'}
                          <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded font-bold">ADDED</span>
                        </div>
                        <div className={`text-xs mt-0.5 ${
                          stop.type === 'fuel' ? 'text-orange-600' :
                          stop.type === 'rest' ? 'text-amber-600' :
                          stop.type === 'meal' ? 'text-green-600' :
                          'text-indigo-600'
                        }`}>{stop.reason}</div>
                      </div>
                      {stop.details.fuelCost && (
                        <div className="text-right">
                          <div className="font-bold text-orange-700">${stop.details.fuelCost.toFixed(2)}</div>
                          <div className="text-xs text-orange-600">~{stop.details.fuelNeeded?.toFixed(0)}L</div>
                        </div>
                      )}
                    </div>
                    <div className={`mt-2 text-xs flex items-center gap-2 border-t pt-2 ${
                      stop.type === 'fuel' ? 'text-orange-700/70 border-orange-100/50' :
                      stop.type === 'rest' ? 'text-amber-700/70 border-amber-100/50' :
                      stop.type === 'meal' ? 'text-green-700/70 border-green-100/50' :
                      'text-indigo-700/70 border-indigo-100/50'
                    }`}>
                      <Clock className="h-3 w-3" /> +{stop.duration} min • {formatTime(item.arrivalTime)}
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
                {/* Drive Segment Info */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 pl-1">
                  <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                    <span>🚗</span>
                    <span>{segment?.distanceKm.toFixed(0)} km</span>
                  </div>
                  <span className="text-slate-300">•</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{Math.floor((segment?.durationMinutes || 0) / 60)}h {(segment?.durationMinutes || 0) % 60}m</span>
                  </div>
                  <span className="text-slate-300">•</span>
                  <div className="text-green-600 font-medium">
                    ${segment?.fuelCost.toFixed(2)} fuel
                  </div>
                </div>

                {/* The Stop Card */}
                <div className={`rounded-xl border p-4 shadow-sm transition-all duration-300 ${isDest ? 'bg-yellow-50/50 border-yellow-200' : 'bg-card hover:bg-slate-50 hover:border-blue-200'}`}>
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex-1">
                      <div className="text-xs font-bold uppercase tracking-wider mb-0.5 text-muted-foreground">
                        {isDest ? 'Destination' : 'Waypoint'}
                      </div>
                      <div className="font-bold text-lg leading-tight">{segment?.to.name}</div>
                      {segment?.stopType && segment.stopType !== 'drive' && segment.stopDuration && (
                        <div className="mt-2 inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs border border-blue-100 font-medium">
                          <Clock className="h-3 w-3" />
                          {STOP_LABELS[segment.stopType]} • {segment.stopDuration} min
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono font-bold bg-muted/80 px-2 py-1 rounded text-foreground">
                        {segment?.arrivalTime ? formatTimeWithTz(segment.arrivalTime, segment.weather?.timezoneAbbr) :
                         arrivalTime ? formatTime(arrivalTime) : ''}
                      </div>
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
    </div>
  );
}
