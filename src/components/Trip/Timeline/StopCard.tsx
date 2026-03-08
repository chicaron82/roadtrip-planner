/**
 * StopCard — individual timeline node for SmartTimeline.
 *
 * Renders departure, arrival, combo (fuel+meal), and regular stops
 * (fuel, meal, rest, overnight, destination).
 *
 * Purely presentational — no callbacks or local state.
 */
import { Zap, Fuel, Utensils, Coffee, Moon, MapPin, Timer } from 'lucide-react';
import type { POISuggestion } from '../../../types';
import { formatTime, formatDuration, type TimedEvent } from '../../../lib/trip-timeline';

// ─── Icon / colour maps ────────────────────────────────────────────────────────

const EVENT_ICON: Record<string, React.ReactNode> = {
  departure:   <Zap className="h-3.5 w-3.5" />,
  arrival:     <MapPin className="h-3.5 w-3.5" />,
  fuel:        <Fuel className="h-3.5 w-3.5" />,
  meal:        <Utensils className="h-3.5 w-3.5" />,
  rest:        <Coffee className="h-3.5 w-3.5" />,
  overnight:   <Moon className="h-3.5 w-3.5" />,
  destination: <Timer className="h-3.5 w-3.5" />,
  combo:       null, // rendered separately
};

const EVENT_COLOR: Record<string, string> = {
  departure:   '#22C55E',
  arrival:     '#22C55E',
  fuel:        '#F59E0B',
  meal:        '#3B82F6',
  rest:        '#8B5CF6',
  overnight:   '#EC4899',
  destination: '#06B6D4', // teal — distinct from all other stop types
  combo:       '#F59E0B',
  drive:       'rgba(255,255,255,0.2)',
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

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * A single stop node on the timeline.
 *
 * Layout goal (matching reference trip plans):
 *   [node]  STOP LABEL — Location
 *           Arrive 9:30 AM  ·  15 min  ·  Depart 9:45 AM
 */
export function StopCard({
  event,
  poiSuggestions = [],
  isResolvingTowns = false,
}: {
  event: TimedEvent;
  poiSuggestions?: POISuggestion[];
  isResolvingTowns?: boolean;
}) {
  const isCombo = event.type === 'combo';
  const isDeparture = event.type === 'departure';
  const isArrival = event.type === 'arrival';
  const color = EVENT_COLOR[event.type] ?? '#fff';
  const nearbyPOIs = isCombo ? getNearbyPOINames(event, poiSuggestions) : [];

  const hintClass = isResolvingTowns ? 'transition-opacity animate-pulse opacity-60' : 'transition-opacity opacity-100';

  const ambientContext = isDeparture ? 'day' : (event.type === 'overnight' ? 'night' : undefined);

  // ── Departure ──────────────────────────────────────────────────────────
  if (isDeparture) {
    return (
      <div className="flex items-center gap-3 py-2" data-ambient={ambientContext}>
        <div
          className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0 border-2"
          style={{ borderColor: color, background: `${color}18` }}
        >
          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color }}>Depart</div>
          <div className={`text-sm font-semibold text-foreground leading-tight ${hintClass}`}>{event.locationHint}</div>
        </div>
        <span className="text-sm font-mono font-bold tabular-nums shrink-0" style={{ color }}>
          {formatTime(event.arrivalTime, event.timezone)}
        </span>
      </div>
    );
  }

  // ── Arrival ────────────────────────────────────────────────────────────
  if (isArrival) {
    return (
      <div className="flex items-center gap-3 py-2" data-ambient={ambientContext}>
        <div
          className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0 border-2"
          style={{ borderColor: color, background: `${color}18` }}
        >
          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color }}>Arrive</div>
          <div className={`text-sm font-semibold text-foreground leading-tight ${hintClass}`}>{event.locationHint}</div>
        </div>
        <span className="text-sm font-mono font-bold tabular-nums shrink-0" style={{ color }}>
          {formatTime(event.arrivalTime, event.timezone)}
        </span>
      </div>
    );
  }

  // ── Combo stop (fuel + meal / fuel + break) ────────────────────────────
  if (isCombo) {
    const label = event.comboLabel ?? 'Fuel + Stop';
    const icons = label.includes('Lunch') || label.includes('Dinner') || label.includes('Meal')
      ? '⛽🍽' : label.includes('Break') ? '⛽☕' : '⛽🛑';

    // Detect meal-absorbs-fuel consolidation: the consolidator silently pulls a
    // downstream fuel stop into this meal stop (within a 5-hour window). Surface
    // this so users aren't surprised when a fuel stop disappears from the itinerary.
    const hasMealAbsorbedFuel = event.stops.some(s => s.type === 'fuel')
      && event.stops.some(s => s.type === 'meal' || s.type === 'rest');

    return (
      <div className="flex items-start gap-3 py-1.5" data-ambient={ambientContext}>
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
                <span className={hintClass}>{event.locationHint}</span>
              </div>
              {hasMealAbsorbedFuel && (
                <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
                  ⛽ filling up while we eat
                </div>
              )}
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
            <span className="font-semibold" style={{ color }}>{formatTime(event.arrivalTime, event.timezone)}</span>
            <span className="text-muted-foreground/40 mx-0.5">·</span>
            <span className="text-muted-foreground">{formatDuration(event.durationMinutes)}</span>
            <span className="text-muted-foreground/40 mx-0.5">·</span>
            <span className="text-muted-foreground/60">Depart</span>
            <span className="font-semibold text-foreground/70">{formatTime(event.departureTime, event.timezone)}</span>
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
        const comboMealType = stop?.details?.comboMealType;
        if (comboMealType) {
          const mealLabel = comboMealType === 'dinner' ? 'Dinner' : 'Lunch';
          return `Fuel + ${mealLabel}${costStr}`;
        }
        return fillType === 'topup' ? `Top-Up${costStr}` : `Full Fill${costStr}`;
      })()
    : event.type === 'meal' ? (() => {
        const h = event.arrivalTime.getHours();
        return h < 10 || (h === 10 && event.arrivalTime.getMinutes() < 30) ? 'Breakfast'
          : h >= 17 ? 'Dinner' : 'Lunch';
      })()
    : event.type === 'rest' ? 'Break'
    : event.type === 'overnight' ? 'Overnight Stop'
    : event.type === 'destination' ? `Time at ${event.locationHint}`
    : 'Stop';

  return (
    <div className="flex items-start gap-3 py-1.5" data-ambient={ambientContext}>
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
        {/* Location hint — hidden for 'destination' since the name is already in the label */}
        {event.type !== 'destination' && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            <span className={hintClass}>{event.locationHint}</span>
          </div>
        )}
        {/* Arrive · duration · Depart row */}
        <div className="flex items-center gap-1 mt-1 text-[11px] font-mono tabular-nums">
          <span className="text-muted-foreground/60">Arrive</span>
          <span className="font-semibold" style={{ color }}>{formatTime(event.arrivalTime, event.timezone)}</span>
          <span className="text-muted-foreground/40 mx-0.5">·</span>
          <span className="text-muted-foreground">{formatDuration(event.durationMinutes)}</span>
          {event.type !== 'overnight' && (
            <>
              <span className="text-muted-foreground/40 mx-0.5">·</span>
              <span className="text-muted-foreground/60">Depart</span>
              <span className="font-semibold text-foreground/70">{formatTime(event.departureTime, event.timezone)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
