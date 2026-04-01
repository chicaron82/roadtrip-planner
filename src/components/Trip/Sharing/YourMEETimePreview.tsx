/**
 * YourMEETimePreview — Template loading screen for the recipient.
 *
 * The companion to MakeMEETimeScreen. When a template file is loaded,
 * instead of immediately pre-filling the wizard, this screen appears.
 * The recipient sees the trip, makes quick edits (travelers, title),
 * and either builds straight to Voilà or opens the full wizard.
 *
 * "The gift is received. The trip becomes theirs."
 *
 * 💚 My Experience Engine
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { TemplateImportResult } from '../../../lib/url';
import type { Location } from '../../../types';
import { searchLocations } from '../../../lib/api';
import { LineageDisplay } from './LineageDisplay';
import { WorkshopTitleInput } from '../../Workshop/WorkshopTitleInput';

function getFreshnessLabel(createdAt?: string): { text: string; warn: boolean } {
  if (!createdAt) return { text: '', warn: false };
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  if (days < 1)  return { text: 'Shared today', warn: false };
  if (days < 7)  return { text: `Shared ${days} day${days !== 1 ? 's' : ''} ago`, warn: false };
  if (days < 90) return { text: `Shared ${Math.floor(days / 7)} week${Math.floor(days / 7) !== 1 ? 's' : ''} ago`, warn: false };
  return { text: `Shared ${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? 's' : ''} ago`, warn: true };
}

function RoutePreviewSVG({ locations }: { locations: TemplateImportResult['locations'] }) {
  const stops = locations.filter(l => l.name);
  if (stops.length < 2) return null;
  const W = 400, dotY = 16, dotR = 5;
  const xs = stops.map((_, i) => i === 0 ? dotR : i === stops.length - 1 ? W - dotR : (i / (stops.length - 1)) * W);
  return (
    <svg viewBox={`0 0 ${W} 44`} style={{ width: '100%', overflow: 'visible', display: 'block' }}>
      {xs.slice(0, -1).map((x, i) => (
        <line key={i} x1={x} y1={dotY} x2={xs[i + 1]} y2={dotY} stroke="rgba(245,240,232,0.12)" strokeWidth={1.5} />
      ))}
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={dotY} r={dotR}
          fill={i === 0 || i === stops.length - 1 ? 'rgba(249,115,22,0.75)' : 'rgba(245,240,232,0.3)'} />
      ))}
      {xs.map((x, i) => (
        <text key={i} x={x} y={dotY + 18} textAnchor="middle"
          fill="rgba(245,240,232,0.38)" fontSize={9} fontFamily="DM Mono, monospace">
          {stops[i].name.split(',')[0].substring(0, 14)}
        </text>
      ))}
    </svg>
  );
}

type Recommendation = NonNullable<TemplateImportResult['meta']['recommendations']>[number];

function RecommendationRow({ rec }: { rec: Recommendation }) {
  return (
    <div style={{ paddingLeft: 4, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <span style={{ fontSize: 10 }}>{rec.isHighlight ? '★' : '📍'}</span>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'rgba(245,240,232,0.65)' }}>
          {rec.location ?? 'En route'}
        </span>
        {rec.isHighlight && (
          <span style={{ fontSize: 9, color: '#f97316', background: 'rgba(249,115,22,0.1)', padding: '1px 5px', borderRadius: 4 }}>highlight</span>
        )}
        {rec.rating != null && (
          <span style={{ fontSize: 10, color: '#f59e0b', letterSpacing: '-0.05em' }}>{'★'.repeat(rec.rating)}{'☆'.repeat(5 - rec.rating)}</span>
        )}
      </div>
      {rec.notes && (
        <p style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 11, color: 'rgba(245,240,232,0.45)', margin: 0, paddingLeft: 18, lineHeight: 1.4 }}>
          &ldquo;{rec.notes}&rdquo;
        </p>
      )}
    </div>
  );
}

export interface YourMEETimePreviewProps {
  template: TemplateImportResult;
  onBuild: (modified: TemplateImportResult) => void;
  onOpenInPlanner: (modified: TemplateImportResult) => void;
  onDismiss: () => void;
}

export function YourMEETimePreview({ template, onBuild, onOpenInPlanner, onDismiss }: YourMEETimePreviewProps) {
  const { meta, locations, settings } = template;
  const originExcluded = locations[0]?.lat === 0 || !locations[0]?.name;
  const [numTravelers, setNumTravelers] = useState(settings?.numTravelers ?? 2);
  const [numRooms, setNumRooms] = useState(settings?.numRooms ?? 1);
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const [discoveriesOpen, setDiscoveriesOpen] = useState(false);

  // Origin search state — only active when template has no starting location
  const [originText, setOriginText] = useState('');
  const [originSuggestions, setOriginSuggestions] = useState<Partial<Location>[]>([]);
  const [selectedOrigin, setSelectedOrigin] = useState<Partial<Location> | null>(null);
  const [originSearching, setOriginSearching] = useState(false);
  const originDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleOriginTextChange = useCallback((text: string) => {
    setOriginText(text);
    setSelectedOrigin(null);
    clearTimeout(originDebounce.current);
    if (!text.trim()) { setOriginSuggestions([]); return; }
    originDebounce.current = setTimeout(async () => {
      setOriginSearching(true);
      try {
        const results = await searchLocations(text);
        setOriginSuggestions(results.slice(0, 5));
      } finally {
        setOriginSearching(false);
      }
    }, 300);
  }, []);

  const handleOriginSelect = useCallback((loc: Partial<Location>) => {
    setSelectedOrigin(loc);
    setOriginText(loc.name?.split(',')[0] ?? '');
    setOriginSuggestions([]);
  }, []);

  const buildModified = useCallback((): TemplateImportResult => {
    const locs = [...template.locations];
    if (originExcluded && selectedOrigin) {
      const origin: Location = {
        id: selectedOrigin.id ?? `origin-${Date.now()}`,
        lat: selectedOrigin.lat ?? 0,
        lng: selectedOrigin.lng ?? 0,
        name: selectedOrigin.name ?? '',
        type: 'origin',
      };
      // Replace the empty origin slot if present, otherwise prepend
      if (locs[0]?.type === 'origin') locs[0] = origin;
      else locs.unshift(origin);
    }
    return {
      ...template,
      locations: locs,
      settings: { ...template.settings, numTravelers, numDrivers: numTravelers, numRooms },
      meta: { ...meta, title: customTitle ?? meta.title },
    };
  }, [template, meta, originExcluded, selectedOrigin, numTravelers, numRooms, customTitle]);

  const freshness = getFreshnessLabel(meta.createdAt);
  const recs = meta.recommendations ?? [];
  const hasDiscoveries = recs.length > 0;
  const lineageTitles: string[] = meta.lineage ?? [];

  const origin = locations.find(l => l.type === 'origin' && l.name);
  const dest   = locations.find(l => l.type === 'destination');
  const wps    = locations.filter(l => l.type === 'waypoint').length;

  const btn = (extra: React.CSSProperties): React.CSSProperties => ({
    width: 28, height: 28, borderRadius: 7,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: 'rgba(245,240,232,0.7)', fontSize: 16, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    ...extra,
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={onDismiss} style={{ position: 'absolute', inset: 0, background: 'rgba(14,11,7,0.82)' }} />
      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 500,
        maxHeight: '92vh', overflowY: 'auto',
        background: 'rgba(20,16,10,0.97)', borderRadius: '20px 20px 0 0',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.14)' }} />
        </div>

        <div style={{ padding: '0 24px 110px' }}>
          {/* Header */}
          <h2 style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: 24, fontWeight: 600, color: '#f5f0e8', margin: '10px 0 6px' }}>
            Your MEE Time Preview 🎁
          </h2>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'rgba(245,240,232,0.7)', margin: '0 0 2px' }}>
            From {meta.author}
          </p>
          <LineageDisplay currentTitle={meta.title} lineageTitles={lineageTitles} />
          {freshness.text && (
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: freshness.warn ? 'rgba(249,115,22,0.7)' : 'rgba(245,240,232,0.32)', margin: '4px 0 0' }}>
              {freshness.text}{freshness.warn && ' · ⚠ Cost estimates may be outdated'}
            </p>
          )}

          {/* Route preview */}
          <div style={{ margin: '18px 0', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 0 10px' }}>
            <RoutePreviewSVG locations={locations} />
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'rgba(245,240,232,0.38)', margin: '6px 0 0', textAlign: 'center' }}>
              {selectedOrigin?.name?.split(',')[0] ?? origin?.name ?? '?'} → {dest?.name ?? '?'}{wps > 0 ? ` · ${wps} stop${wps !== 1 ? 's' : ''}` : ''}
            </p>
          </div>

          {/* Make it yours */}
          <p style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(245,240,232,0.45)', margin: '0 0 14px' }}>
            Make it yours:
          </p>

          {originExcluded && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'rgba(245,240,232,0.7)', margin: '0 0 8px' }}>
                📍 Where are you departing from?
              </p>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={originText}
                  onChange={e => handleOriginTextChange(e.target.value)}
                  placeholder="Search city or town…"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${selectedOrigin ? 'rgba(249,115,22,0.5)' : 'rgba(255,255,255,0.12)'}`,
                    borderRadius: 10, color: '#f5f0e8',
                    fontFamily: 'DM Mono, monospace', fontSize: 13,
                    outline: 'none',
                  }}
                />
                {originSearching && (
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'rgba(245,240,232,0.3)' }}>
                    …
                  </span>
                )}
                {selectedOrigin && (
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#f97316', fontSize: 14 }}>✓</span>
                )}
                {originSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                    background: 'rgba(20,16,10,0.98)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10, marginTop: 4, overflow: 'hidden',
                  }}>
                    {originSuggestions.map((loc, i) => (
                      <button
                        key={i}
                        onClick={() => handleOriginSelect(loc)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '9px 12px', background: 'none', border: 'none',
                          borderBottom: i < originSuggestions.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                          color: 'rgba(245,240,232,0.8)', fontFamily: 'DM Mono, monospace',
                          fontSize: 12, cursor: 'pointer',
                        }}
                      >
                        {loc.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Travelers + rooms */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'rgba(245,240,232,0.7)', margin: '0 0 8px' }}>👥 Who's coming?</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button style={btn({})} onClick={() => setNumTravelers(v => Math.max(1, v - 1))}>−</button>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#f5f0e8', minWidth: 72, textAlign: 'center' }}>
                {numTravelers} traveler{numTravelers !== 1 ? 's' : ''}
              </span>
              <button style={btn({})} onClick={() => setNumTravelers(v => Math.min(12, v + 1))}>+</button>
              <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
              <button style={btn({})} onClick={() => setNumRooms(v => Math.max(1, v - 1))}>−</button>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#f5f0e8', minWidth: 56, textAlign: 'center' }}>
                {numRooms} room{numRooms !== 1 ? 's' : ''}
              </span>
              <button style={btn({})} onClick={() => setNumRooms(v => Math.min(numTravelers, v + 1))}>+</button>
            </div>
          </div>

          {/* Discoveries */}
          {hasDiscoveries && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'rgba(245,240,232,0.7)', margin: 0 }}>
                  🔍 {meta.author}'s discoveries
                </p>
                <button
                  onClick={() => setDiscoveriesOpen(v => !v)}
                  style={{ background: 'none', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'rgba(245,240,232,0.4)', cursor: 'pointer', padding: 0 }}>
                  {recs.length} tip{recs.length !== 1 ? 's' : ''} {discoveriesOpen ? '↑' : '↓'}
                </button>
              </div>
              {discoveriesOpen && (
                <div style={{ padding: '10px 12px', background: 'rgba(245,240,232,0.03)', borderRadius: 8, border: '1px solid rgba(245,240,232,0.07)' }}>
                  {recs.slice(0, 4).map((rec, i) => <RecommendationRow key={i} rec={rec} />)}
                  {recs.length > 4 && (
                    <p style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 11, color: 'rgba(245,240,232,0.3)', margin: 0 }}>
                      + {recs.length - 4} more
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Trip title */}
          <WorkshopTitleInput value={customTitle} seededTitle={meta.title} onChange={setCustomTitle} />
        </div>

        {/* Sticky action bar */}
        <div style={{
          position: 'sticky', bottom: 0,
          padding: '12px 24px 24px',
          background: 'rgba(20,16,10,0.98)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', gap: 10,
        }}>
          <button
            onClick={() => onOpenInPlanner(buildModified())}
            style={{ flex: 1, padding: '13px 10px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(245,240,232,0.65)', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer' }}>
            Open in full planner →
          </button>
          <button
            onClick={() => onBuild(buildModified())}
            disabled={originExcluded && !selectedOrigin}
            style={{ flex: 2, padding: '13px 16px', borderRadius: 12, border: 'none', background: originExcluded && !selectedOrigin ? 'rgba(249,115,22,0.3)' : '#f97316', color: '#fff', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, cursor: originExcluded && !selectedOrigin ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}>
            Build my MEE time →
          </button>
        </div>
      </div>
    </div>
  );
}
