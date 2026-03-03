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
import { useMemo, useState, useEffect, useRef } from 'react';
import { Clock, ChevronRight } from 'lucide-react';
import type { TripSummary, TripSettings, Vehicle } from '../../types';
import type { POISuggestion } from '../../types';
import { generateSmartStops, createStopConfig } from '../../lib/stop-suggestions';
import { buildTimedTimeline, formatDuration, type TimedEvent } from '../../lib/trip-timeline';
import { applyComboOptimization } from '../../lib/stop-consolidator';
import { resolveStopTowns } from '../../lib/route-geocoder';
import { getWeatherGradientClass } from '../../lib/weather-ui-utils';
import { StopCard } from './StopCard';

interface SmartTimelineProps {
  summary: TripSummary;
  settings: TripSettings;
  vehicle?: Vehicle;
  poiSuggestions?: POISuggestion[];
  /** Unranked gas/hotel/restaurant corridor POIs for Tier-2 hub detection */
  poiInference?: POISuggestion[];
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
  const lineBgClass = getWeatherGradientClass(event.segment?.weather?.weatherCode);

  return (
    <div className="flex items-stretch gap-0 py-0">
      {/* Gutter: continuous vertical line */}
      <div className="flex flex-col items-center" style={{ width: 26, flexShrink: 0 }}>
        <div className={`w-[3px] rounded-full flex-1 ${lineBgClass} opacity-80`} style={{ minHeight: 28 }} />
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

// ─── Main component ───────────────────────────────────────────────────────────

export function SmartTimeline({ summary, settings, vehicle, poiSuggestions = [], poiInference }: SmartTimelineProps) {
  // ── Step 1: Build raw timeline (synchronous — renders immediately) ────────
  const rawEvents = useMemo(() => {
    if (!summary?.segments?.length) return [];

    const allSuggestions = vehicle
      ? generateSmartStops(summary.segments, createStopConfig(vehicle, settings, summary.fullGeometry), summary.days)
      : [];

    const raw = buildTimedTimeline(
      summary.segments,
      allSuggestions,
      settings,
      summary.roundTripMidpoint,
      (settings.dayTripDurationHours ?? 0) * 60,
      summary.days,
    );
    return applyComboOptimization(raw);
  }, [summary, settings, vehicle]);

  // ── Step 2: Async town resolution (updates labels after geocoding) ───────
  // Uses tiered resolution: hub cache → POI analysis → Nominatim
  const [townMap, setTownMap] = useState<Map<string, string>>(new Map());
  const [isResolvingTowns, setIsResolvingTowns] = useState(true);

  useEffect(() => {
    if (!rawEvents.length || !summary?.fullGeometry?.length) {
      const timer = setTimeout(() => setIsResolvingTowns(false), 0);
      return () => clearTimeout(timer);
    }

    let isActive = true;
    const timer = setTimeout(() => {
      if (isActive) setIsResolvingTowns(true);
    }, 0);
    const controller = new AbortController();

    // Prefer the inference corpus (gas/hotel) for hub detection — it always contains
    // the utility POIs that Tier-2 analyzeForHub needs, regardless of user preferences.
    const hubPOIs = (poiInference && poiInference.length > 0) ? poiInference : poiSuggestions;
    resolveStopTowns(rawEvents, summary.fullGeometry, controller.signal, hubPOIs)
      .then(resolved => {
        if (!controller.signal.aborted && isActive) {
          if (resolved.size > 0) setTownMap(resolved);
          setIsResolvingTowns(false);
        }
      })
      .catch(() => {
        setIsResolvingTowns(false);
        /* network error — keep generic hints */
      });

    return () => {
      isActive = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [rawEvents, summary?.fullGeometry, poiInference, poiSuggestions]);

  // ── Step 3: Merge town names into events ─────────────────────────────────
  const events = useMemo(
    () => applyTownHints(rawEvents, townMap),
    [rawEvents, townMap],
  );

  // ── Ambient Day/Night Tracking ───────────────────────────────────────────
  const [activeAmbient, setActiveAmbient] = useState<'day' | 'night'>('day');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      // Find the first intersecting entry from the viewport center
      const intersecting = entries.find(e => e.isIntersecting);
      if (intersecting) {
        const ambient = intersecting.target.getAttribute('data-ambient');
        if (ambient === 'day' || ambient === 'night') {
          setActiveAmbient(ambient);
        }
      }
    }, { rootMargin: '-40% 0px -40% 0px' });

    const elements = containerRef.current?.querySelectorAll('[data-ambient]') ?? [];
    elements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [events]);

  if (!events.length) return null;

  const comboCount = events.filter(e => e.type === 'combo').length;
  const totalSaved = events.reduce((sum, e) => sum + (e.timeSavedMinutes ?? 0), 0);

  const ambientStyle = activeAmbient === 'night'
    ? { borderColor: 'rgba(99,102,241,0.2)', background: 'linear-gradient(to bottom, rgba(49,46,129,0.1), transparent)' }
    : { borderColor: 'rgba(34,197,94,0.2)', background: 'linear-gradient(to bottom, rgba(34,197,94,0.05), transparent)' };

  return (
    <div
      ref={containerRef}
      className="rounded-xl border overflow-hidden transition-all duration-1000"
      style={ambientStyle}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{ borderColor: activeAmbient === 'night' ? 'rgba(99,102,241,0.15)' : 'rgba(34,197,94,0.15)' }}
      >
        <div className="flex items-center gap-2">
          <Clock className={`h-4 w-4 transition-colors duration-1000 ${activeAmbient === 'night' ? 'text-indigo-400' : 'text-green-500'}`} />
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
              isResolvingTowns={isResolvingTowns}
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
