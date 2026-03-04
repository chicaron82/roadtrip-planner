/**
 * SignpostScene v2 — Cinematic Crossroads
 *
 * Four visual layers:
 *   1. Sky / dusk backdrop gradient          ← barely moves on camera pan
 *   2. Road perspective + dust + branches     ← main scene, pans with camera
 *   3. Highway-style sign arms               ← inside scene layer
 *   4. Description panel                     ← below, cross-fades on mode change
 *
 * Camera pan: selecting a path nudges the scene with a subtle
 * translateX/Y + scale that makes it feel like the camera is leaning
 * toward the chosen road. Sky moves at ~30% of scene speed = parallax.
 *
 * Dust particles use native SVG <animateTransform> to drift upward along
 * the road without clashing with CSS keyframe opacity values.
 *
 * 💚 My Experience Engine
 */

import { useState, useEffect, useRef } from 'react';
import type { TripMode } from '../../types';
import { MODE_CONFIG, MODE_ORDER } from './mode-config';

// ── Scene geometry ─────────────────────────────────────────────────────────────
const VB_W  = 400;
const VB_H  = 290;
const POLE_X   = 200;
const POLE_TOP = 86;

// Branch paths — from pole-top outward. Carefully tuned so label
// positions don't overlap and feel naturally spaced.
const BRANCHES: Record<TripMode, {
  d: string;
  labelX: number; labelY: number;
  side: 'left' | 'right';
  dist: string;
}> = {
  plan: {
    d: `M ${POLE_X} ${POLE_TOP}
        C ${POLE_X - 14} ${POLE_TOP - 8},
          ${POLE_X - 68} ${POLE_TOP - 36},
          ${POLE_X - 124} ${POLE_TOP - 66}`,
    labelX: 58, labelY: 46,
    side: 'left',
    dist: '0 km',
  },
  adventure: {
    d: `M ${POLE_X} ${POLE_TOP}
        C ${POLE_X + 6} ${POLE_TOP - 18},
          ${POLE_X + 20} ${POLE_TOP - 54},
          ${POLE_X + 24} ${POLE_TOP - 90}`,
    labelX: 232, labelY: 36,
    side: 'right',
    dist: '∞ km',
  },
  estimate: {
    d: `M ${POLE_X} ${POLE_TOP}
        C ${POLE_X + 18} ${POLE_TOP - 8},
          ${POLE_X + 70} ${POLE_TOP - 28},
          ${POLE_X + 118} ${POLE_TOP - 53}`,
    labelX: 308, labelY: 82,
    side: 'right',
    dist: '~1 min',
  },
};

// Accent colors match MODE_CONFIG accentColor exactly
const MODE_COLORS: Record<TripMode, string> = {
  plan:      '#f97316',
  adventure: '#F59E0B',
  estimate:  '#0ea5e9',
};

// Static fallback path lengths (overridden by getTotalLength on mount)
const PATH_LENGTHS: Record<TripMode, number> = {
  plan: 150, adventure: 94, estimate: 127,
};

// ── Camera pan per mode ────────────────────────────────────────────────────────
// scene moves more; sky moves ~30% as much → parallax illusion
const CAMERA: Record<TripMode, { scene: string; sky: string }> = {
  plan:      { scene: 'translateX(-15px) scale(1.02)',  sky: 'translateX(-5px)' },
  adventure: { scene: 'translateY(-10px) scale(1.025)', sky: 'translateY(-3px) scale(1.005)' },
  estimate:  { scene: 'translateX(15px) scale(1.02)',   sky: 'translateX(5px)' },
};

// ── Dust particles (deterministic, no Math.random) ────────────────────────────
const DUST = Array.from({ length: 13 }, (_, i) => ({
  id: i,
  // Sine spread keeps them within the road trapezoid width
  x:    184 + Math.round(Math.sin(i * 2.39) * 10),
  y:    192 + Math.round((i * 21) % 88),
  r:    0.7 + (i % 3) * 0.55,
  dur:  2.5 + (i % 4) * 0.55,
  del:  -(i  * 0.52),
  op:   0.10 + (i % 5) * 0.04,
  dx:   Math.round(Math.cos(i * 1.7) * 4),   // slight horizontal drift
}));

// ── Tiny helper ───────────────────────────────────────────────────────────────
function usePathLength(ref: React.RefObject<SVGPathElement | null>): number {
  const [len, setLen] = useState(0);
  useEffect(() => {
    if (ref.current) setLen(ref.current.getTotalLength());
  }, [ref]);
  return len;
}

// ── BranchPath ────────────────────────────────────────────────────────────────
// Two SVG paths stacked:
//   1. Base draw  — stroke-dashoffset animation reveals the path
//   2. Glow pulse — short bright dash that zips along when active

function BranchPath({
  mode, isActive, isDrawing,
}: {
  mode: TripMode; isActive: boolean; isDrawing: boolean;
}) {
  const ref   = useRef<SVGPathElement>(null);
  const dynLen = usePathLength(ref);
  const len   = dynLen || PATH_LENGTHS[mode];
  const color = MODE_COLORS[mode];
  const { d } = BRANCHES[mode];

  return (
    <>
      {/* Base path — draws itself from pole outward */}
      <path
        ref={ref}
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={isActive ? 2.5 : 1.2}
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={isActive ? 0 : len}
        opacity={isActive ? 1 : 0.15}
        style={{
          transition: isDrawing
            ? `stroke-dashoffset 0.50s cubic-bezier(0.4,0,0.2,1),
               opacity 0.28s ease, stroke-width 0.3s ease`
            : `opacity 0.38s ease, stroke-width 0.3s ease`,
          filter: isActive ? `drop-shadow(0 0 5px ${color}bb)` : 'none',
        }}
      />

      {/* Traveling glow — a short bright dash that races along on selection */}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`18 ${len}`}
        strokeDashoffset={isActive ? (isDrawing ? len : 0) : len}
        opacity={isActive ? 0.55 : 0}
        style={{
          transition: isDrawing
            ? `stroke-dashoffset 0.55s cubic-bezier(0.4,0,0.2,1) 0.05s,
               opacity 0.2s ease`
            : `opacity 0.3s ease`,
          filter: `drop-shadow(0 0 7px ${color})`,
        }}
      />
    </>
  );
}

// ── SignArm — highway-style panel ─────────────────────────────────────────────
function SignArm({
  mode, isActive, onClick,
}: {
  mode: TripMode; isActive: boolean; onClick: () => void;
}) {
  const config = MODE_CONFIG[mode];
  const color  = MODE_COLORS[mode];
  const branch = BRANCHES[mode];

  return (
    <button
      onClick={onClick}
      aria-label={`${config.tag}: ${config.description}`}
      aria-pressed={isActive}
      style={{
        position:  'absolute',
        left:      `${(branch.labelX / VB_W) * 100}%`,
        top:       `${(branch.labelY / VB_H) * 100}%`,
        transform: 'translate(-50%, -50%)',
        cursor:    'pointer',
        border:    'none',
        background:'none',
        padding:   0,
        zIndex:    10,
      }}
    >
      {/* Highway-style panel */}
      <div
        style={{
          display:    'flex',
          alignItems: 'center',
          gap:         '5px',
          padding:    '5px 10px 5px 8px',
          // Warm MEE dark base — NOT highway green
          background: isActive
            ? 'rgba(18, 13, 6, 0.97)'
            : 'rgba(11, 8, 4, 0.90)',
          border: `1.5px solid ${isActive
            ? color + 'cc'
            : 'rgba(200, 140, 50, 0.22)'}`,
          borderRadius: '4px',
          boxShadow: isActive
            ? `0 0 22px ${color}55,
               0 0 8px  ${color}33,
               0 4px 12px rgba(0,0,0,0.65),
               inset 0 1px 0 rgba(255,255,255,0.05)`
            : `0 2px 8px rgba(0,0,0,0.55),
               inset 0 1px 0 rgba(255,255,255,0.03)`,
          minWidth:   '84px',
          whiteSpace: 'nowrap',
          transition: 'all 0.32s ease',
          animation:  isActive ? 'none' : 'sign-hint-pulse 3.5s ease-in-out infinite',
        }}
      >
        {/* Direction arrow */}
        <span style={{
          fontSize:   '10px',
          color:      isActive ? color : 'rgba(200,155,70,0.42)',
          transition: 'color 0.3s ease',
          lineHeight: 1,
        }}>
          {branch.side === 'left' ? '◂' : '▸'}
        </span>

        {/* Mode label — highway-condensed feel */}
        <span style={{
          fontFamily:    "'DM Mono', 'Roboto Condensed', monospace",
          fontSize:      '10px',
          fontWeight:    700,
          letterSpacing: '0.12em',
          color:         isActive ? '#ffffff' : 'rgba(220,175,95,0.62)',
          textTransform: 'uppercase',
          transition:    'color 0.3s ease',
        }}>
          {config.tag.replace(' MODE', '')}
        </span>

        {/* Distance flavor — tiny highway marker feel */}
        <span style={{
          fontFamily:    "'DM Mono', monospace",
          fontSize:      '8px',
          color:         isActive ? `${color}bb` : 'rgba(200,155,70,0.28)',
          letterSpacing: '0.04em',
          transition:    'color 0.3s ease',
          marginLeft:    '2px',
        }}>
          {branch.dist}
        </span>
      </div>
    </button>
  );
}

// ── ModeDescriptionPanel ──────────────────────────────────────────────────────
function ModeDescriptionPanel({
  mode, onSelect,
}: {
  mode: TripMode; onSelect: (m: TripMode) => void;
}) {
  const [visible,     setVisible]     = useState(false);
  const [currentMode, setCurrentMode] = useState(mode);
  const [fading,      setFading]      = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (mode === currentMode) return;
    const tOut  = setTimeout(() => setFading(true), 0);
    const tSwap = setTimeout(() => { setCurrentMode(mode); setFading(false); }, 230);
    return () => { clearTimeout(tOut); clearTimeout(tSwap); };
  }, [mode, currentMode]);

  const cfg = MODE_CONFIG[currentMode];
  const col = MODE_COLORS[currentMode];

  return (
    <div
      style={{
        opacity:    visible ? (fading ? 0 : 1) : 0,
        transform:  visible ? 'translateY(0)' : 'translateY(18px)',
        transition: 'opacity 0.32s ease, transform 0.44s cubic-bezier(0.34,1.2,0.64,1)',
        background: 'rgba(14,11,7,0.72)',
        border:     `1px solid ${col}28`,
        borderRadius: '14px',
        padding:    '16px 18px',
        backdropFilter:         'blur(20px)',
        WebkitBackdropFilter:   'blur(20px)',
        boxShadow: `0 8px 32px rgba(0,0,0,0.42), 0 0 0 1px ${col}14`,
        width:    '100%',
        maxWidth: '420px',
      }}
    >
      {/* Tag row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{
          fontFamily:    "'DM Mono', monospace",
          fontSize:      '10px',
          fontWeight:    700,
          letterSpacing: '0.14em',
          color:         col,
          background:    `${col}14`,
          border:        `1px solid ${col}2e`,
          borderRadius:  '100px',
          padding:       '3px 10px',
        }}>
          {cfg.icon} {cfg.tag}
        </span>
        <div style={{ flex: 1, height: '1px', background: `linear-gradient(to right, ${col}26, transparent)` }} />
      </div>

      {/* Heading */}
      <div style={{
        fontFamily:   "'Cormorant Garamond', Georgia, serif",
        fontSize:     'clamp(16px, 3.5vw, 21px)',
        fontWeight:   600,
        fontStyle:    'italic',
        color:        '#F8FAFF',
        lineHeight:   1.15,
        marginBottom: '7px',
        whiteSpace:   'pre-line',
      }}>
        {cfg.heading}
      </div>

      {/* Description */}
      <p style={{
        fontFamily: "'Sora', system-ui, sans-serif",
        fontSize:   '12px',
        color:      'rgba(255,255,255,0.47)',
        lineHeight: 1.6,
        margin:     '0 0 11px',
      }}>
        {cfg.description}
      </p>

      {/* Stats */}
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {cfg.stats.map(stat => (
          <li key={stat} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.40)' }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: col, flexShrink: 0, display: 'inline-block' }} />
            {stat}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={() => onSelect(currentMode)}
        style={{
          width:         '100%',
          padding:       '10px 20px',
          borderRadius:  '9px',
          border:        `1px solid ${col}44`,
          background:    `${col}14`,
          color:          col,
          fontFamily:    "'DM Mono', monospace",
          fontSize:      '12px',
          fontWeight:    700,
          letterSpacing: '0.05em',
          cursor:        'pointer',
          transition:    'all 0.2s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background  = `${col}28`;
          e.currentTarget.style.boxShadow   = `0 0 20px ${col}28`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background  = `${col}14`;
          e.currentTarget.style.boxShadow   = 'none';
        }}
      >
        {cfg.cta} →
      </button>

      {/* Subtle "explore more" hint */}
      <p style={{
        fontFamily:    "'DM Mono', monospace",
        fontSize:      '9px',
        color:         'rgba(255,255,255,0.18)',
        letterSpacing: '0.05em',
        margin:        '10px 0 0',
        textAlign:     'center',
        fontStyle:     'italic',
      }}>
        Curious where the other roads lead? Tap another sign.
      </p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface SignpostSceneProps {
  onSelectMode: (mode: TripMode) => void;
}

export function SignpostScene({ onSelectMode }: SignpostSceneProps) {
  const [selectedMode, setSelectedMode] = useState<TripMode>('plan');
  const [drawingMode,  setDrawingMode]  = useState<TripMode>('plan');
  const [isDrawing,    setIsDrawing]    = useState(false);

  const handleArmClick = (mode: TripMode) => {
    if (mode === selectedMode) return;
    setIsDrawing(true);
    setDrawingMode(mode);
    setSelectedMode(mode);
    setTimeout(() => setIsDrawing(false), 620);
  };

  const cam = CAMERA[selectedMode];

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      gap:           '14px',
      width:         '100%',
      maxWidth:      '420px',
    }}>

      {/* ── Scene ── */}
      <div
        role="group"
        aria-label="Choose your road"
        style={{
          position:     'relative',
          width:        '100%',
          aspectRatio:  `${VB_W} / ${VB_H}`,
          overflow:     'hidden',
          borderRadius: '16px',
        }}
      >
        {/* ── Layer 1: Sky / dusk backdrop ── */}
        {/* Moves slower than the scene → parallax depth */}
        <div
          aria-hidden="true"
          style={{
            position:   'absolute',
            inset:      '-12%',
            background: `
              radial-gradient(ellipse 130% 55% at 50% 85%,
                rgba(100,50,8,0.60) 0%, transparent 65%),
              linear-gradient(to bottom,
                rgba(6, 4, 2, 0.99)  0%,
                rgba(18,10, 4, 0.94) 30%,
                rgba(60,28, 6, 0.78) 62%,
                rgba(20,12, 4, 0.45) 85%,
                transparent          100%)
            `,
            transform:  cam.sky,
            transition: 'transform 0.72s cubic-bezier(0.4,0,0.2,1)',
          }}
        />

        {/* ── Layer 2 + 3: Road / scene / sign arms (camera pans together) ── */}
        <div
          aria-hidden="true"
          style={{
            position:   'absolute',
            inset:      0,
            transform:  cam.scene,
            transition: 'transform 0.65s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            style={{ width: '100%', height: '100%', overflow: 'visible' }}
          >
            {/* ── Road trapezoid ── */}
            <polygon points="157,290 243,290 213,170 187,170" fill="url(#roadG)" />

            {/* ── Road shoulders ── */}
            <polygon points="92,290 167,290 187,170 172,180" fill="url(#shouldG)" opacity="0.35" />
            <polygon points="308,290 233,290 213,170 228,180" fill="url(#shouldG)" opacity="0.35" />

            {/* ── Animated center dashes ── */}
            <line
              x1="200" y1="170" x2="200" y2="292"
              stroke="rgba(255,200,70,0.5)"
              strokeWidth="1.8"
              strokeDasharray="12 10"
              strokeLinecap="round"
              style={{ animation: 'road-dash 0.68s linear infinite' }}
            />

            {/* ── Vanishing-point horizon glow ── */}
            <ellipse cx="200" cy="170" rx="80" ry="14" fill="rgba(249,115,22,0.06)" />

            {/* ── Dust particles — SVG-native animation ── */}
            {DUST.map(p => (
              <circle
                key={p.id}
                cx={p.x} cy={p.y} r={p.r}
                fill="rgba(255,210,110,0.9)"
                opacity={p.op}
              >
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values={`0,0; ${p.dx},${-40}`}
                  dur={`${p.dur}s`}
                  begin={`${p.del}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values={`${p.op}; ${p.op * 0.4}; 0`}
                  dur={`${p.dur}s`}
                  begin={`${p.del}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}

            {/* ── Branch paths ── */}
            {MODE_ORDER.map(mode => (
              <BranchPath
                key={mode}
                mode={mode}
                isActive={selectedMode === mode}
                isDrawing={isDrawing && drawingMode === mode}
              />
            ))}

            {/* ── Pole ── */}
            {/* Shadow */}
            <rect x="203" y="86" width="4" height="86" fill="rgba(0,0,0,0.22)" rx="2" transform="skewX(3)" />
            {/* Post */}
            <rect x="197" y="86" width="7" height="86" fill="url(#poleG)" rx="3" />
            {/* Cap */}
            <ellipse cx="200.5" cy="86" rx="4.5" ry="2.2" fill="#8B6914" />
            {/* Base flare */}
            <ellipse cx="200.5" cy="172" rx="7" ry="2.6" fill="rgba(70,44,8,0.52)" />

            {/* ── Gradient defs ── */}
            <defs>
              <linearGradient id="roadG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#161616" />
                <stop offset="100%" stopColor="#282828" />
              </linearGradient>
              <linearGradient id="shouldG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#0f0f0f" />
                <stop offset="100%" stopColor="#1e1e1e" />
              </linearGradient>
              <linearGradient id="poleG" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#6B4F12" />
                <stop offset="40%"  stopColor="#8B6914" />
                <stop offset="100%" stopColor="#5A3F0A" />
              </linearGradient>
            </defs>
          </svg>

          {/* ── Sign arm panels (highway style, MEE amber palette) ── */}
          {MODE_ORDER.map(mode => (
            <SignArm
              key={mode}
              mode={mode}
              isActive={selectedMode === mode}
              onClick={() => handleArmClick(mode)}
            />
          ))}
        </div>
      </div>

      {/* ── Layer 4: Description panel ── */}
      <ModeDescriptionPanel mode={selectedMode} onSelect={onSelectMode} />
    </div>
  );
}
