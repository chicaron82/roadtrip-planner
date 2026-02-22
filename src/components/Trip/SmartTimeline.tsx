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
import { useMemo, useState, useEffect } from 'react';
import { Clock, Zap, Utensils, Fuel, Coffee, Moon, MapPin, ChevronRight } from 'lucide-react';
import type { TripSummary, TripSettings, Vehicle } from '../../types';
import type { POISuggestion } from '../../types';
import { generateSmartStops, createStopConfig } from '../../lib/stop-suggestions';
import { buildTimedTimeline, formatTime, formatDuration, type TimedEvent } from '../../lib/trip-timeline';
import { applyComboOptimization } from '../../lib/stop-consolidator';
import { resolveStopTowns } from '../../lib/route-geocoder';

interface SmartTimelineProps {
  summary: TripSummary;
  settings: TripSettings;
  vehicle?: Vehicle;
  poiSuggestions?: POISuggestion[];
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

// ─── Async town enrichment (via route-geocoder.ts) ────────────────────────────

/**
 * Apply resolved town names to timeline events.
 * Replaces "~250 km from Winnipeg" → "near Dryden".
 */
function applyTownHints(
  events: TimedEvent[],
  townMap: Map<string, string>,
): TimedEvent[] {
  if (townMap.size === 0) return events;
  return events.map(event => {
    const town = townMap.get(event.id);
    if (!town) return event;
    return { ...event, locationHint: `near ${town}` };
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Vertical connector between stops — shows drive duration + distance.
 * The left gutter line visually links the stop nodes above and below.
 */
function DriveRow({ event }: { event: TimedEvent }) {
  const km = event.segmentDistanceKm ?? 0;
  const min = event.segmentDurationMinutes ?? 0;
  return (
    <div className="flex items-stretch gap-0 py-0">
      {/* Gutter: continuous vertical line */}
      <div className="flex flex-col items-center" style={{ width: 26, flexShrink: 0 }}>
        <div className="w-px bg-muted-foreground/20 flex-1" style={{ minHeight: 28 }} />
      </div>
      {/* Drive info */}
      <div className="flex items-center gap-1.5 pl-3 py-1">
        <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
        <span className="text-[11px] text-muted-foreground/50 font-mono tabular-nums">
          {formatDuration(min)} &middot; {Math.round(km)} km
        </span>
      </div>
    </div>
  );
}

/**
 * A single stop node on the timeline.
 *
 * Layout goal (matching reference trip plans):
 *   [node]  STOP LABEL — Location
 *           Arrive 9:30 AM  ·  15 min  ·  Depart 9:45 AM
 */
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

  // ── Departure ──────────────────────────────────────────────────────────
  if (isDeparture) {
    return (
      <div className="flex items-center gap-3 py-2">
        <div
          className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0 border-2"
          style={{ borderColor: color, background: `${color}18` }}
        >
          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color }}>Depart</div>
          <div className="text-sm font-semibold text-foreground leading-tight">{event.locationHint}</div>
        </div>
        <span className="text-sm font-mono font-bold tabular-nums shrink-0" style={{ color }}>
          {formatTime(event.arrivalTime)}
        </span>
      </div>
    );
  }

  // ── Arrival ────────────────────────────────────────────────────────────
  if (isArrival) {
    return (
      <div className="flex items-center gap-3 py-2">
        <div
          className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0 border-2"
          style={{ borderColor: color, background: `${color}18` }}
        >
          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color }}>Arrive</div>
          <div className="text-sm font-semibold text-foreground leading-tight">{event.locationHint}</div>
        </div>
        <span className="text-sm font-mono font-bold tabular-nums shrink-0" style={{ color }}>
          {formatTime(event.arrivalTime)}
        </span>
      </div>
    );
  }

  // ── Combo stop (fuel + meal / fuel + break) ────────────────────────────
  if (isCombo) {
    const label = event.comboLabel ?? 'Fuel + Stop';
    const icons = label.includes('Lunch') || label.includes('Dinner') || label.includes('Meal')
      ? '⛽🍽' : label.includes('Break') ? '⛽☕' : '⛽🛑';

    return (
      <div className="flex items-start gap-3 py-1.5">
        {/* Node */}
        <div
          className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0 text-sm mt-0.5"
          style={{ background: `${color}20`, border: `1.5px solid ${color}50` }}
        >
          <span style={{ fontSize: 11 }}>{icons}</span>
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-bold leading-tight" style={{ color }}>{label}</div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                <span>{event.locationHint}</span>
              </div>
            </div>
            {event.timeSavedMinutes !== undefined && event.timeSavedMinutes > 0 && (
              <span
                className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-0.5"
                style={{ background: '#22C55E18', color: '#22C55E', border: '1px solid #22C55E40' }}
              >
                saves {event.timeSavedMinutes} min
              </span>
            )}
          </div>
          {/* Arrive · duration · Depart row */}
          <div className="flex items-center gap-1 mt-1 text-[11px] font-mono tabular-nums">
            <span className="text-muted-foreground/60">Arrive</span>
            <span className="font-semibold" style={{ color }}>{formatTime(event.arrivalTime)}</span>
            <span className="text-muted-foreground/40 mx-0.5">·</span>
            <span className="text-muted-foreground">{formatDuration(event.durationMinutes)}</span>
            <span className="text-muted-foreground/40 mx-0.5">·</span>
            <span className="text-muted-foreground/60">Depart</span>
            <span className="font-semibold text-foreground/70">{formatTime(event.departureTime)}</span>
          </div>
          {/* Nearby POIs */}
          {nearbyPOIs.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
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
      </div>
    );
  }

  // ── Regular stop (fuel / meal / rest / overnight) ───────────────────────
  const icon = EVENT_ICON[event.type];
  const label =
    event.type === 'fuel' ? (() => {
        const stop = event.stops[0];
        const fillType = stop?.details?.fillType;
        const cost = stop?.details?.fuelCost;
        const costStr = cost != null ? ` · ~$${cost.toFixed(0)}` : '';
        return fillType === 'topup' ? `Top-Up${costStr}` : `Full Fill${costStr}`;
      })()
    : event.type === 'meal' ? (() => {
        const h = event.arrivalTime.getHours();
        return h < 10 || (h === 10 && event.arrivalTime.getMinutes() < 30) ? 'Breakfast'
          : h >= 17 ? 'Dinner' : 'Lunch';
      })()
    : event.type === 'rest' ? 'Break'
    : event.type === 'overnight' ? 'Overnight Stop'
    : 'Stop';

  return (
    <div className="flex items-start gap-3 py-1.5">
      {/* Node */}
      <div
        className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: `${color}18`, color }}
      >
        {icon}
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold leading-tight" style={{ color }}>{label}</div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
          <MapPin className="h-2.5 w-2.5 shrink-0" />
          <span>{event.locationHint}</span>
        </div>
        {/* Arrive · duration · Depart row */}
        <div className="flex items-center gap-1 mt-1 text-[11px] font-mono tabular-nums">
          <span className="text-muted-foreground/60">Arrive</span>
          <span className="font-semibold" style={{ color }}>{formatTime(event.arrivalTime)}</span>
          <span className="text-muted-foreground/40 mx-0.5">·</span>
          <span className="text-muted-foreground">{formatDuration(event.durationMinutes)}</span>
          {event.type !== 'overnight' && (
            <>
              <span className="text-muted-foreground/40 mx-0.5">·</span>
              <span className="text-muted-foreground/60">Depart</span>
              <span className="font-semibold text-foreground/70">{formatTime(event.departureTime)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SmartTimeline({ summary, settings, vehicle, poiSuggestions = [] }: SmartTimelineProps) {
  // ── Step 1: Build raw timeline (synchronous — renders immediately) ────────
  const rawEvents = useMemo(() => {
    if (!summary?.segments?.length) return [];

    const allSuggestions = vehicle
      ? generateSmartStops(summary.segments, createStopConfig(vehicle, settings), summary.days)
      : [];

    const raw = buildTimedTimeline(summary.segments, allSuggestions, settings, vehicle);
    return applyComboOptimization(raw);
  }, [summary, settings, vehicle]);

  // ── Step 2: Async town resolution (updates labels after geocoding) ───────
  const [townMap, setTownMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!rawEvents.length || !summary?.fullGeometry?.length) return;

    const controller = new AbortController();

    resolveStopTowns(rawEvents, summary.fullGeometry, controller.signal)
      .then(resolved => {
        if (!controller.signal.aborted && resolved.size > 0) {
          setTownMap(resolved);
        }
      })
      .catch(() => { /* network error — keep generic hints */ });

    return () => controller.abort();
  }, [rawEvents, summary?.fullGeometry]);

  // ── Step 3: Merge town names into events ─────────────────────────────────
  const events = useMemo(
    () => applyTownHints(rawEvents, townMap),
    [rawEvents, townMap],
  );

  if (!events.length) return null;

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

      {/* Footer — active trip time (driving + stops, excludes overnight sleep) */}
      {(() => {
        // Sum drive durations + non-overnight stop durations.
        // Wall-clock diff is misleading for round trips: it includes overnight
        // sleep (8h) making "8h + 8h drive" show as ~34h instead of ~16h.
        const activeMin = events.reduce((sum, e) => {
          if (e.type === 'overnight') return sum; // skip sleep time
          return sum + e.durationMinutes;
        }, 0);
        return activeMin > 0 ? (
          <div
            className="px-4 py-2 border-t text-[11px] text-muted-foreground flex items-center justify-between"
            style={{ borderColor: 'rgba(34,197,94,0.1)' }}
          >
            <span>Total trip time</span>
            <span className="font-mono font-medium text-foreground">{formatDuration(activeMin)}</span>
          </div>
        ) : null;
      })()}
    </div>
  );
}
