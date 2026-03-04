/**
 * ═══════════════════════════════════════════════════════════
 * MY EXPERIENCE ENGINE — LANDING ROUTE SCENE
 *
 * Flat horizontal route, three waypoints (one per mode).
 * Two organic waves float above and below for texture — pure
 * aesthetics, no function. Route draws in on mount, orange fill
 * travels to selected waypoint on click.
 *
 * 💚 Built by Aaron "Chicharon" — 18 years on the road
 * ═══════════════════════════════════════════════════════════
 */
import { useState, useEffect } from 'react';
import type { TripMode } from '../../types';
import { MODE_CONFIG, MODE_ORDER, ROUTE_DOTS } from './mode-config';

interface Props {
  onSelectMode: (mode: TripMode) => void;
  lastDestination?: string;
}

// Primary route — horizontal, extends 5 units past each edge so it clips clean
// with overflow:visible on SVG + overflow:hidden on wrapper
const PRIMARY_PATH = 'M-5,12 L105,12';
const PATH_LENGTH  = 110; // exact (straight line, -5 to 105)

// Decorative waves — organic texture, no interaction
const WAVE_ABOVE = 'M-5,8 Q15,5 30,9 Q50,13 65,7 Q80,3 95,8 Q105,9 110,8';
const WAVE_BELOW = 'M-5,17 Q20,21 40,15 Q60,11 80,18 Q95,22 110,16';

// Waypoint positions — fixed on the horizontal line (d = distance from path start at x=-5)
// Symmetric 22-unit spacing. Estimate at x=62 keeps the full label clear of the
// desc panel in mobile landscape (panel left ≈ 663px, label right edge ≈ 616px).
const WAYPOINTS: Record<TripMode, { x: number; y: number; d: number }> = {
  plan:      { x: 18, y: 12, d: 23 },
  adventure: { x: 40, y: 12, d: 45 },
  estimate:  { x: 62, y: 12, d: 67 },
};

// Subtle map tint per mode
const MAP_TINT: Record<TripMode, string> = {
  plan:      'transparent',
  adventure: 'rgba(245,158,11,0.07)',
  estimate:  'rgba(14,165,233,0.07)',
};

// Ghost label — strip province suffix ("Banff, AB" → "Banff"), cap length
const formatGhostLabel = (name: string) => name.split(',')[0].trim().slice(0, 14);
// Fallback cycles through ROUTE_DOTS by day-of-week so it feels alive without state
const GHOST_FALLBACK = ROUTE_DOTS[new Date().getDay() % ROUTE_DOTS.length].label;

export function LandingRouteScene({ onSelectMode, lastDestination }: Props) {
  const [selectedMode, setSelectedMode] = useState<TripMode>('plan');
  const [descVisible, setDescVisible]   = useState(true);
  const [routeMounted, setRouteMounted] = useState(false);

  // Staggered draw-in entrance
  useEffect(() => {
    const id = setTimeout(() => setRouteMounted(true), 300);
    return () => clearTimeout(id);
  }, []);

  const config    = MODE_CONFIG[selectedMode];
  const traveledD = WAYPOINTS[selectedMode].d;

  const selectMode = (mode: TripMode) => {
    if (mode === selectedMode) return;
    setDescVisible(false);
    setTimeout(() => { setSelectedMode(mode); setDescVisible(true); }, 180);
  };

  return (
    <div className="lrs-container">

      {/* Mode tint — world shifts colour with your choice */}
      <div className="lrs-tint" style={{ background: MAP_TINT[selectedMode] }} />

      {/* ── SVG route ── */}
      <div className="lrs-svg-wrap">
        <svg
          viewBox="0 0 100 24"
          preserveAspectRatio="xMidYMid meet"
          overflow="visible"
          className="lrs-svg"
          aria-hidden="true"
        >
          <defs>
            <filter id="lrs-glow" x="-20%" y="-100%" width="140%" height="300%">
              <feGaussianBlur stdDeviation="0.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Decorative wave — above (tan) */}
          <path
            d={WAVE_ABOVE}
            stroke="#c4a882" strokeWidth="0.7" fill="none" opacity={0.3}
            strokeDasharray="300"
            strokeDashoffset={routeMounted ? 0 : 300}
            style={{ transition: 'stroke-dashoffset 3.2s ease 0.6s' }}
          />

          {/* Decorative wave — below (orange) */}
          <path
            d={WAVE_BELOW}
            stroke="#f97316" strokeWidth="0.6" fill="none" opacity={0.12}
            strokeDasharray="300"
            strokeDashoffset={routeMounted ? 0 : 300}
            style={{ transition: 'stroke-dashoffset 3.5s ease 0.8s' }}
          />

          {/* Dim base route — always present */}
          <path d={PRIMARY_PATH} stroke="rgba(249,115,22,0.15)" strokeWidth="1.5" fill="none" />

          {/* Route draw-in */}
          <path
            d={PRIMARY_PATH}
            stroke="rgba(249,115,22,0.40)" strokeWidth="1.5" fill="none"
            strokeDasharray={PATH_LENGTH}
            strokeDashoffset={routeMounted ? 0 : PATH_LENGTH}
            style={{ transition: 'stroke-dashoffset 2.5s ease' }}
          />

          {/* Traveled highlight — animates to selected waypoint */}
          <path
            d={PRIMARY_PATH}
            stroke={config.accentColor} strokeWidth="2.2" fill="none"
            strokeLinecap="round" filter="url(#lrs-glow)"
            strokeDasharray={PATH_LENGTH}
            strokeDashoffset={PATH_LENGTH - traveledD}
            style={{ transition: 'stroke-dashoffset 0.75s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease' }}
          />

          {/* ── Waypoints ── */}
          {MODE_ORDER.map((mode) => {
            const mc = MODE_CONFIG[mode];
            const wp = WAYPOINTS[mode];
            const isActive = mode === selectedMode;

            return (
              <g
                key={mode}
                role="button"
                tabIndex={0}
                aria-pressed={isActive}
                aria-label={mc.cta}
                onClick={() => selectMode(mode)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && selectMode(mode)}
                style={{ cursor: 'pointer', outline: 'none' }}
              >
                {/* Hit area */}
                <circle cx={wp.x} cy={wp.y} r={8} fill="transparent" />

                {/* Outer glow ring */}
                <circle
                  cx={wp.x} cy={wp.y}
                  r={isActive ? 5 : 3}
                  fill="none" stroke={mc.accentColor} strokeWidth="0.5"
                  opacity={isActive ? 0.35 : 0.1}
                  style={{ transition: 'opacity 0.3s ease' }}
                />

                {/* Pulse ring — active only */}
                {isActive && (
                  <circle
                    cx={wp.x} cy={wp.y} r={7}
                    fill="none" stroke={mc.accentColor} strokeWidth="0.4" opacity={0.22}
                    className="lrs-pulse-ring"
                    style={{ transformBox: 'fill-box', transformOrigin: 'center' } as React.CSSProperties}
                  />
                )}

                {/* Core dot */}
                <circle
                  cx={wp.x} cy={wp.y}
                  r={isActive ? 2.2 : 1.6}
                  fill={isActive ? mc.accentColor : 'rgba(255,255,255,0.3)'}
                  style={{ transition: 'fill 0.3s ease' }}
                />

                {/* Mode label — above dot */}
                <text
                  x={wp.x} y={wp.y - 5.5}
                  textAnchor="middle"
                  fill={isActive ? mc.accentColor : 'rgba(255,255,255,0.25)'}
                  fontSize="2.5" fontFamily="DM Mono, monospace" letterSpacing="0.08em"
                  style={{ transition: 'fill 0.3s ease' }}
                >
                  {mode.toUpperCase()}
                </text>

                {/* Tap hint — inactive only */}
                {!isActive && (
                  <text
                    x={wp.x} y={wp.y + 7}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.15)"
                    fontSize="1.9" fontFamily="DM Mono, monospace" letterSpacing="0.03em"
                  >
                    tap
                  </text>
                )}
              </g>
            );
          })}

          {/* ── Ghost destination — decorative 4th waypoint, balances desktop ── */}
          {(() => {
            const label = formatGhostLabel(lastDestination ?? GHOST_FALLBACK);
            return (
              <g aria-hidden="true">
                {/* Outer ring */}
                <circle cx={84} cy={12} r={3} fill="none" stroke="rgba(249,115,22,0.18)" strokeWidth="0.5" />
                {/* Core dot */}
                <circle cx={84} cy={12} r={1.4} fill="rgba(249,115,22,0.28)" />
                {/* City name — italic serif, dim */}
                <text
                  x={84} y={6.5}
                  textAnchor="middle"
                  fill="rgba(249,115,22,0.65)"
                  fontSize="2.4"
                  fontFamily="Cormorant Garamond, Georgia, serif"
                  fontStyle="italic"
                  letterSpacing="0.04em"
                >
                  {label}
                </text>
                {/* Subtle "next?" hint below */}
                <text
                  x={84} y={18.5}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.1)"
                  fontSize="1.8"
                  fontFamily="DM Mono, monospace"
                  letterSpacing="0.05em"
                >
                  next?
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* ── Description panel — lower-right glass card ── */}
      <div
        className={`lrs-desc-panel${descVisible ? ' lrs-desc-visible' : ''}`}
        style={{ borderColor: config.borderColor }}
      >
        <div
          className="lrs-desc-tag"
          style={{ color: config.tagColor, background: `${config.accentColor}20` }}
        >
          {config.icon}&nbsp;{config.tag}
        </div>

        <h3 className="lrs-desc-heading">{config.heading}</h3>
        <p className="lrs-desc-sub">{config.description}</p>

        <ul className="lrs-desc-stats">
          {config.stats.map((s) => (
            <li key={s} style={{ '--lrs-dot': config.accentColor } as React.CSSProperties}>{s}</li>
          ))}
        </ul>

        <button
          className="lrs-desc-cta"
          onClick={() => onSelectMode(selectedMode)}
          style={{
            background: `${config.accentColor}18`,
            color: config.tagColor,
            borderColor: `${config.accentColor}40`,
          }}
        >
          {config.cta} →
        </button>

        <p className="lrs-desc-hint">tap any waypoint to explore modes</p>
      </div>
    </div>
  );
}
