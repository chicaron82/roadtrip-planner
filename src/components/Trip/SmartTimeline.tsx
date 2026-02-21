/**
 * SmartTimeline — "Your Day at a Glance"
 *
 * Shows a time-first summary of the route: departure → drives → combo stops →
 * arrival. Injected above the existing detailed ItineraryTimeline.
 *
 * Combo stops (fuel + meal merged) show:
 *   ⛽🍔  Fuel + Lunch  ·  1:05 PM – 1:50 PM  ·  45 min  ·  saves 30 min
 *   📍 ~487 km from Winnipeg
 *
 * 💚 My Experience Engine
 */
import { useMemo } from 'react';
import { Clock, Zap, Utensils, Fuel, Coffee, Moon, MapPin, ChevronRight } from 'lucide-react';
import type { TripSummary, TripSettings, Vehicle } from '../../types';
import type { POISuggestion } from '../../types';
import { generateSmartStops, createStopConfig, type SuggestedStop } from '../../lib/stop-suggestions';
import { buildTimedTimeline, formatTime, formatDuration, type TimedEvent } from '../../lib/trip-timeline';
import { applyComboOptimization } from '../../lib/stop-consolidator';

interface SmartTimelineProps {
  summary: TripSummary;
  settings: TripSettings;
  vehicle?: Vehicle;
  poiSuggestions?: POISuggestion[];
  /** The actual accepted/suggested stops from TripContext — use these instead of
   *  regenerating, since stop placement requires per-segment splitting that
   *  SmartTimeline cannot do on its own for single-segment long routes. */
  stopSuggestions?: SuggestedStop[];
}

// ─── Icon helpers ─────────────────────────────────────────────────────────────

const EVENT_ICON: Record<string, React.ReactNode> = {
  departure:  <Zap className="h-3.5 w-3.5" />,
  arrival:    <MapPin className="h-3.5 w-3.5" />,
  fuel:       <Fuel className="h-3.5 w-3.5" />,
  meal:       <Utensils className="h-3.5 w-3.5" />,
  rest:       <Coffee className="h-3.5 w-3.5" />,
  overnight:  <Moon className="h-3.5 w-3.5" />,
  combo:      null, // rendered separately
};

const EVENT_COLOR: Record<string, string> = {
  departure:  '#22C55E',
  arrival:    '#22C55E',
  fuel:       '#F59E0B',
  meal:       '#3B82F6',
  rest:       '#8B5CF6',
  overnight:  '#EC4899',
  combo:      '#F59E0B',
  drive:      'rgba(255,255,255,0.2)',
};

// ─── POI enrichment ───────────────────────────────────────────────────────────

function getNearbyPOINames(
  event: TimedEvent,
  poiSuggestions: POISuggestion[],
): string[] {
  if (!poiSuggestions.length) return [];
  const segIdx = event.stops[0]?.afterSegmentIndex ?? -99;
  return poiSuggestions
    .filter(p =>
      (p.segmentIndex !== undefined && Math.abs((p.segmentIndex ?? 0) - segIdx) <= 2) &&
      (p.category === 'gas' || p.category === 'restaurant' || p.category === 'cafe')
    )
    .slice(0, 4)
    .map(p => p.name);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DriveRow({ event }: { event: TimedEvent }) {
  const km = event.segmentDistanceKm ?? 0;
  const min = event.segmentDurationMinutes ?? 0;
  return (
    <div className="flex items-center gap-2 py-1 pl-[11px]">
      <div className="w-0.5 bg-muted-foreground/20 self-stretch ml-[3px] mr-3 min-h-[20px]" />
      <span className="text-[11px] text-muted-foreground/60 font-mono">
        {formatDuration(min)} · {Math.round(km)} km
      </span>
      <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
    </div>
  );
}

function StopCard({
  event,
  poiSuggestions = [],
}: {
  event: TimedEvent;
  poiSuggestions?: POISuggestion[];
}) {
  const isCombo = event.type === 'combo';
  const isDeparture = event.type === 'departure';
  const isArrival = event.type === 'arrival';
  const color = EVENT_COLOR[event.type] ?? '#fff';
  const nearbyPOIs = isCombo ? getNearbyPOINames(event, poiSuggestions) : [];

  // Departure / arrival — compact
  if (isDeparture || isArrival) {
    return (
      <div className="flex items-center gap-3 py-2">
        <div
          className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0 border-2"
          style={{ borderColor: color, background: `${color}18` }}
        >
          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-foreground">{event.locationHint}</span>
        </div>
        <span
          className="text-xs font-mono font-bold tabular-nums shrink-0"
          style={{ color }}
        >
          {formatTime(event.arrivalTime)}
        </span>
      </div>
    );
  }

  // Combo stop — full card
  if (isCombo) {
    const label = event.comboLabel ?? 'Fuel + Stop';
    const icons = label.includes('Lunch') || label.includes('Dinner') || label.includes('Meal')
      ? ['⛽', '🍽'] : label.includes('Break') ? ['⛽', '☕'] : ['⛽', '🛑'];

    return (
      <div
        className="rounded-xl border p-3 space-y-2"
        style={{
          borderColor: `${color}40`,
          background: `${color}0a`,
        }}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{icons[0]}{icons[1]}</span>
            <div>
              <div className="text-sm font-bold" style={{ color }}>{label}</div>
              <div className="text-[11px] text-muted-foreground font-mono">
                {formatTime(event.arrivalTime)} – {formatTime(event.departureTime)}
                {' · '}
                <span className="font-medium">{formatDuration(event.durationMinutes)}</span>
              </div>
            </div>
          </div>
          {event.timeSavedMinutes !== undefined && event.timeSavedMinutes > 0 && (
            <div
              className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: '#22C55E18', color: '#22C55E', border: '1px solid #22C55E40' }}
            >
              saves {event.timeSavedMinutes} min
            </div>
          )}
        </div>

        {/* Location */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span>{event.locationHint}</span>
        </div>

        {/* Nearby POIs from route API */}
        {nearbyPOIs.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {nearbyPOIs.map(name => (
              <span
                key={name}
                className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground"
              >
                {name}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Regular stop (fuel / meal / rest / overnight)
  const icon = EVENT_ICON[event.type];
  const label = event.type === 'fuel' ? 'Fuel Stop'
    : event.type === 'meal' ? (
        event.stops[0]?.reason?.toLowerCase().includes('lunch') ? 'Lunch' :
        event.stops[0]?.reason?.toLowerCase().includes('dinner') ? 'Dinner' : 'Meal'
      )
    : event.type === 'rest' ? 'Break'
    : event.type === 'overnight' ? 'Overnight'
    : 'Stop';

  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0"
        style={{ background: `${color}18`, color }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold" style={{ color }}>{label}</div>
        <div className="text-[11px] text-muted-foreground">{event.locationHint}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs font-mono" style={{ color }}>{formatTime(event.arrivalTime)}</div>
        <div className="text-[10px] text-muted-foreground">{formatDuration(event.durationMinutes)}</div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SmartTimeline({ summary, settings, vehicle, poiSuggestions = [], stopSuggestions }: SmartTimelineProps) {
  const events = useMemo(() => {
    if (!summary?.segments?.length) return [];

    // Prefer externally-provided stops (the accepted stops from TripContext which
    // have correct afterSegmentIndex for each sub-segment).  Fall back to
    // re-generating only when nothing is passed in (e.g. standalone rendering).
    const allSuggestions: SuggestedStop[] =
      stopSuggestions && stopSuggestions.length > 0
        ? stopSuggestions
        : vehicle
          ? generateSmartStops(summary.segments, createStopConfig(vehicle, settings), summary.days)
          : [];

    const raw = buildTimedTimeline(summary.segments, allSuggestions, settings, vehicle);
    return applyComboOptimization(raw);
  }, [summary, settings, vehicle, stopSuggestions]);

  if (!events.length) return null;

  // Only non-drive events for summary stats
  const stopEvents = events.filter(e => e.type !== 'drive' && e.type !== 'waypoint');
  const comboCount = events.filter(e => e.type === 'combo').length;
  const totalSaved = events.reduce((sum, e) => sum + (e.timeSavedMinutes ?? 0), 0);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.03)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{ borderColor: 'rgba(34,197,94,0.15)' }}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-green-500" />
          <span className="text-sm font-semibold text-foreground">Smart Timeline</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {comboCount > 0 && (
            <span className="text-green-500 font-medium">
              {comboCount} combo stop{comboCount !== 1 ? 's' : ''}
            </span>
          )}
          {totalSaved > 0 && (
            <span
              className="px-2 py-0.5 rounded-full font-bold text-[10px]"
              style={{ background: '#22C55E18', color: '#22C55E', border: '1px solid #22C55E30' }}
            >
              {totalSaved} min saved
            </span>
          )}
        </div>
      </div>

      {/* Event list */}
      <div className="px-4 py-2 space-y-0.5">
        {events.map(event => {
          if (event.type === 'drive') return <DriveRow key={event.id} event={event} />;
          if (event.type === 'waypoint') return null;
          return (
            <StopCard
              key={event.id}
              event={event}
              poiSuggestions={poiSuggestions}
            />
          );
        })}
      </div>

      {/* Footer — total drive summary */}
      {stopEvents.length >= 2 && (() => {
        const dep = stopEvents[0]?.arrivalTime;
        const arr = stopEvents[stopEvents.length - 1]?.arrivalTime;
        const totalMin = arr && dep ? Math.round((arr.getTime() - dep.getTime()) / 60000) : 0;
        return totalMin > 0 ? (
          <div
            className="px-4 py-2 border-t text-[11px] text-muted-foreground flex items-center justify-between"
            style={{ borderColor: 'rgba(34,197,94,0.1)' }}
          >
            <span>Total trip time</span>
            <span className="font-mono font-medium text-foreground">{formatDuration(totalMin)}</span>
          </div>
        ) : null;
      })()}
    </div>
  );
}
