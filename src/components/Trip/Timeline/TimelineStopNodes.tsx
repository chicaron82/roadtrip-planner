import type React from 'react';
import { Clock, Fuel, Trophy, Edit3 } from 'lucide-react';
import type { RouteSegment, StopType, Activity } from '../../../types';
import type { SuggestedStop } from '../../../lib/stop-suggestions';
import { formatTime as formatTimeWithTz, STOP_LABELS } from '../../../lib/calculations';
import { formatTimeInZone } from '../../../lib/trip-timezone';
import { StopDurationPicker } from '../Itinerary/StopDurationPicker';
import { ActivityBadge } from '../Itinerary/ActivityEditor';
import { getWeatherEmoji } from '../../../lib/weather-ui-utils';
import { SourceTierChip } from '../../UI/SourceTierChip';
import { SOURCE_TIER_LABELS } from '../../../lib/mee-tokens';

interface GasStopNodeProps {
  arrivalTime: Date;
  timezone?: string;
  cost?: number;
  litres?: number;
  priority?: 'critical' | 'recommended' | 'optional';
}

interface SuggestedStopNodeProps {
  arrivalTime: Date;
  timezone?: string;
  stop: SuggestedStop;
}

interface WaypointNodeProps {
  segment: RouteSegment;
  arrivalTime: Date;
  index: number;
  isDestination: boolean;
  onUpdateStopType?: (segmentIndex: number, newStopType: StopType) => void;
  onEditActivity?: (segmentIndex: number, activity?: Activity, locationName?: string) => void;
  activity?: Activity;
  assignedDriver?: number;
  driverName?: string;
}

const formatTime = (date: Date, ianaTimezone?: string) => formatTimeInZone(date, ianaTimezone);

const FUEL_PRIORITY_STYLES = {
  critical: {
    ring: 'ring-red-300',
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconBg: 'bg-red-100',
    iconText: 'text-red-600',
    titleText: 'text-red-800',
    bodyText: 'text-red-600',
    costText: 'text-red-700',
    footerText: 'text-red-700/70',
    footerBorder: 'border-red-100/50',
    badge: '🚨 Critical',
    description: 'Tank critically low — refuel immediately',
  },
  recommended: {
    ring: 'ring-orange-200',
    bg: 'bg-orange-50',
    border: 'border-orange-100',
    iconBg: 'bg-orange-100',
    iconText: 'text-orange-600',
    titleText: 'text-orange-800',
    bodyText: 'text-orange-600',
    costText: 'text-orange-700',
    footerText: 'text-orange-700/70',
    footerBorder: 'border-orange-100/50',
    badge: '⛽ Recommended',
    description: 'Tracked fuel is low (<15%)',
  },
  optional: {
    ring: 'ring-green-200',
    bg: 'bg-green-50',
    border: 'border-green-100',
    iconBg: 'bg-green-100',
    iconText: 'text-green-600',
    titleText: 'text-green-800',
    bodyText: 'text-green-600',
    costText: 'text-green-700',
    footerText: 'text-green-700/70',
    footerBorder: 'border-green-100/50',
    badge: '⚡ Top-Off',
    description: 'Optional top-off before next stretch',
  },
};

export function GasStopNode({ arrivalTime, timezone, cost, litres, priority = 'recommended' }: GasStopNodeProps) {
  const styles = FUEL_PRIORITY_STYLES[priority];

  return (
    <div className="flex gap-4 mb-8 relative animate-in fade-in slide-in-from-left-4 duration-500">
      <div className="relative">
        <div className={`w-10 h-10 rounded-full ${styles.iconBg} ${styles.iconText} flex items-center justify-center border-2 border-white ring-2 ${styles.ring} shadow-sm z-10 bg-white`}>
          <Fuel className="h-5 w-5" />
        </div>
      </div>
      <div className="pt-0 flex-1">
        <div className={`${styles.bg} border ${styles.border} rounded-xl p-3 shadow-sm`}>
          <div className="flex justify-between items-start">
            <div>
              <div className={`font-bold ${styles.titleText} text-sm flex items-center gap-2`}>
                {styles.badge}
                <SourceTierChip tier="inferred" label={SOURCE_TIER_LABELS.engineEstimated} />
              </div>
              <div className={`text-xs ${styles.bodyText} mt-0.5`}>{styles.description}</div>
            </div>
            <div className="text-right">
              <div className={`font-bold ${styles.costText}`}>${cost?.toFixed(2)}</div>
              <div className={`text-xs ${styles.bodyText}`}>~{litres?.toFixed(0)}L</div>
            </div>
          </div>
          <div className={`mt-2 text-xs flex items-center gap-2 ${styles.footerText} border-t ${styles.footerBorder} pt-2`}>
            <Clock className="h-3 w-3" /> +15 min stop • {formatTime(arrivalTime, timezone)}
          </div>
        </div>
      </div>
    </div>
  );
}

const STOP_TYPE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  fuel: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
  rest: { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' },
  meal: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
  overnight: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200' },
};

const STOP_TYPE_CARD: Record<string, { bg: string; border: string; text: string; footer: string }> = {
  fuel: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', footer: 'text-orange-700/70 border-orange-100/50' },
  rest: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', footer: 'text-amber-700/70 border-amber-100/50' },
  meal: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', footer: 'text-green-700/70 border-green-100/50' },
  overnight: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800', footer: 'text-indigo-700/70 border-indigo-100/50' },
};

const STOP_TYPE_LABELS: Record<string, string> = {
  fuel: 'Fuel Stop', rest: 'Rest Break', meal: 'Meal Stop', overnight: 'Overnight Stay',
};

const STOP_TYPE_ICONS: Record<string, React.ReactNode> = {
  fuel: <Fuel className="h-5 w-5" />,
  rest: <>☕</>,
  meal: <>🍽️</>,
  overnight: <>🏨</>,
};

export function SuggestedStopNode({ arrivalTime, timezone, stop }: SuggestedStopNodeProps) {
  const iconStyle = STOP_TYPE_STYLES[stop.type] || STOP_TYPE_STYLES.rest;
  const cardStyle = STOP_TYPE_CARD[stop.type] || STOP_TYPE_CARD.rest;

  return (
    <div className="flex gap-4 mb-8 relative animate-in fade-in slide-in-from-left-4 duration-500">
      <div className="relative">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 shadow-sm z-10 bg-white ${iconStyle.bg} ${iconStyle.text} ${iconStyle.border}`}>
          {STOP_TYPE_ICONS[stop.type] || STOP_TYPE_ICONS.rest}
        </div>
      </div>
      <div className="pt-0 flex-1">
        <div className={`rounded-xl p-3 shadow-sm border ${cardStyle.bg} ${cardStyle.border}`}>
          <div className="flex justify-between items-start">
            <div>
              <div className={`font-bold text-sm flex items-center gap-2 ${cardStyle.text}`}>
                {STOP_TYPE_LABELS[stop.type] || 'Suggested Stop'}
                <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded font-bold">ADDED</span>
                <SourceTierChip tier="inferred" label={SOURCE_TIER_LABELS.engineEstimated} />
              </div>
              <div className={`text-xs mt-0.5 ${iconStyle.text}`}>{stop.reason}</div>
            </div>
            {stop.details.fuelCost && (
              <div className="text-right">
                <div className="font-bold text-orange-700">${stop.details.fuelCost.toFixed(2)}</div>
                <div className="text-xs text-orange-600">~{stop.details.fuelNeeded?.toFixed(0)}L</div>
              </div>
            )}
          </div>
          <div className={`mt-2 text-xs flex items-center gap-2 border-t pt-2 ${cardStyle.footer}`}>
            <Clock className="h-3 w-3" /> +{stop.duration} min • {formatTime(arrivalTime, timezone)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function WaypointNode({
  segment,
  arrivalTime,
  index,
  isDestination,
  onUpdateStopType,
  onEditActivity,
  activity,
  assignedDriver,
  driverName,
}: WaypointNodeProps) {
  return (
    <div className="flex gap-4 mb-8 group">
      <div className="relative">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 shadow-sm z-10 bg-white transition-colors duration-300 ${
          isDestination
            ? 'bg-yellow-100 text-yellow-600 border-yellow-200'
            : 'bg-white text-muted-foreground border-slate-200 group-hover:border-blue-400 group-hover:text-blue-500'
        }`}>
          {isDestination ? <Trophy className="h-5 w-5" /> : <span className="font-mono text-xs font-bold">{index + 1}</span>}
        </div>
      </div>

      <div className="flex-1 pt-1">
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 pl-1">
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-100">
            <span>🚗</span>
            <span>{segment.distanceKm.toFixed(0)} km</span>
          </div>
          <span className="text-slate-300">•</span>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{Math.floor(segment.durationMinutes / 60)}h {Math.round(segment.durationMinutes % 60)}m</span>
          </div>
          <span className="text-slate-300">•</span>
          <div className="text-green-600 font-medium">
            ${segment.fuelCost.toFixed(2)} fuel
          </div>
          {assignedDriver && (
            <>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-1 text-indigo-600 font-medium">
                <span>🚗</span> {driverName ?? `Driver ${assignedDriver}`}
              </div>
            </>
          )}
        </div>

        <div className={`rounded-xl border p-4 shadow-sm transition-all duration-300 ${
          isDestination ? 'bg-yellow-50/50 border-yellow-200' : 'bg-card hover:bg-slate-50 hover:border-blue-200'
        }`}>
          <div className="flex justify-between items-start mb-1">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isDestination ? 'Destination' : 'Waypoint'}
                </span>
                {segment.stopType && segment.stopType !== 'drive' && (
                  <SourceTierChip tier="declared" />
                )}
              </div>
              <div className="font-bold text-lg leading-tight">{segment.to.name}</div>

              {segment.stopType && segment.stopType !== 'drive' && onUpdateStopType ? (
                <div className="mt-2">
                  <StopDurationPicker
                    value={segment.stopType}
                    onChange={(newType) => onUpdateStopType(index, newType)}
                    compact={true}
                  />
                </div>
              ) : segment.stopType && segment.stopType !== 'drive' && segment.stopDuration ? (
                <div className="mt-2 inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs border border-blue-100 font-medium">
                  <Clock className="h-3 w-3" />
                  {STOP_LABELS[segment.stopType]} • {segment.stopDuration} min
                </div>
              ) : null}

              {activity ? (
                <div className="mt-2">
                  <ActivityBadge
                    activity={activity}
                    onClick={() => onEditActivity?.(index, activity, segment.to.name)}
                  />
                </div>
              ) : onEditActivity && (
                <button
                  type="button"
                  onClick={() => onEditActivity(index, undefined, segment.to.name)}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                >
                  <Edit3 className="h-3 w-3" />
                  Add Activity
                </button>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm font-mono font-bold bg-muted/80 px-2 py-1 rounded text-foreground">
                {segment.arrivalTime ? formatTimeWithTz(segment.arrivalTime, segment.weather?.timezoneAbbr) : formatTime(arrivalTime)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {segment.weather && (
              <div className="flex items-center gap-1.5 bg-sky-50 text-sky-700 px-2 py-1 rounded-md text-xs border border-sky-100 font-medium">
                <span className="text-base">
                  {getWeatherEmoji(
                    segment.weather.weatherCode,
                    segment.weather.temperatureMax,
                    segment.weather.precipitationProb,
                  )}
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
}