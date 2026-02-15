import type { RouteSegment, TripSettings } from '../../types';
import { formatDistance, formatDuration } from '../../lib/calculations';
import { getWeatherEmoji, getWeatherLabel } from '../../lib/weather';
import { MapPin, ArrowRight, AlertTriangle, Coffee, Droplets, Thermometer } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SegmentCardProps {
  segment: RouteSegment;
  settings: TripSettings;
  segmentIndex: number;
  arrivalTime?: string;
}

export function SegmentCard({ segment, settings, segmentIndex, arrivalTime }: SegmentCardProps) {
  const durationHours = segment.durationMinutes / 60;
  const hasWarnings = segment.warnings && segment.warnings.length > 0;

  // Determine card style based on warnings
  const severityColor = segment.warnings?.some(w => w.severity === 'critical')
    ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10'
    : segment.warnings?.some(w => w.severity === 'warning')
    ? 'border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-900/10'
    : 'border-border bg-background';

  return (
    <div className={cn("rounded-lg border p-4 space-y-3 transition-all hover:shadow-md", severityColor)}>
      {/* Header: From → To */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="font-medium truncate">{segment.from.name}</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="font-medium truncate">{segment.to.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
            Leg {segmentIndex + 1}
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-muted-foreground">Distance</div>
          <div className="font-semibold">{formatDistance(segment.distanceKm, settings.units)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Duration</div>
          <div className="font-semibold">{formatDuration(segment.durationMinutes)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Arrival</div>
          <div className="font-semibold">{arrivalTime || 'TBD'}</div>
        </div>
      </div>

      {/* Weather */}
      {segment.weather && (
        <div className="flex items-center gap-2 p-2 rounded bg-muted/50 text-xs">
          <span className="text-lg">{getWeatherEmoji(segment.weather.weatherCode)}</span>
          <div className="flex-1">
            <div className="font-medium">{getWeatherLabel(segment.weather.weatherCode)}</div>
            <div className="text-muted-foreground flex items-center gap-2">
              <span className="flex items-center gap-1">
                <Thermometer className="h-3 w-3" />
                {Math.round(segment.weather.temperatureMax)}°C
              </span>
              {segment.weather.precipitationProb > 30 && (
                <span className="flex items-center gap-1">
                  <Droplets className="h-3 w-3" />
                  {segment.weather.precipitationProb}%
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {hasWarnings && (
        <div className="space-y-1.5">
          {segment.warnings?.map((warning, idx) => (
            <div
              key={idx}
              className={cn(
                "flex items-start gap-2 p-2 rounded text-xs",
                warning.severity === 'critical' && "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
                warning.severity === 'warning' && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
                warning.severity === 'info' && "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
              )}
            >
              <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
              <span className="flex-1">{warning.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Suggested Break */}
      {segment.suggestedBreak && !hasWarnings && (
        <div className="flex items-center gap-2 p-2 rounded bg-blue-50 text-blue-700 text-xs dark:bg-blue-900/20 dark:text-blue-400">
          <Coffee className="h-3 w-3" />
          <span>Suggested break after {Math.floor(durationHours * 0.67)}h — stretch & refuel</span>
        </div>
      )}

      {/* Timezone Crossing */}
      {segment.timezoneCrossing && (
        <div className="flex items-center gap-2 p-2 rounded bg-purple-50 text-purple-700 text-xs dark:bg-purple-900/20 dark:text-purple-400">
          🕐 <span>{segment.warnings?.find(w => w.type === 'timezone')?.message || 'Timezone change'}</span>
        </div>
      )}
    </div>
  );
}
