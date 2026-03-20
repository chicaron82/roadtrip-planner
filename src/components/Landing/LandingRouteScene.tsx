/**
 * ═══════════════════════════════════════════════════════════
 * MY EXPERIENCE ENGINE — LANDING ROUTE SCENE
 *
 * Flat horizontal route with dynamic node count:
 * - First-timers: 3 evenly spaced nodes (plan/adventure/estimate)
 * - Returning users: 4 nodes, fourth is contextual session resume
 * Popover description centered on selected node (desktop).
 * Stacks below SVG on mobile portrait.
 *
 * 💚 Built by Aaron "Chicharon" — 18 years on the road
 * ═══════════════════════════════════════════════════════════
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { TripMode } from '../../types';
import { MODE_CONFIG, ROUTE_DOTS } from './mode-config';

type NodeId = TripMode | 'resume';

interface Props {
  onSelectMode: (mode: TripMode) => void;
  lastDestination?: string;
  hasActiveSession?: boolean;
  onResumeSession?: () => void;
  hasSavedTrip?: boolean;
  onContinueSavedTrip?: () => void;
  onExitStart: (fn: () => void) => void;
}

const PRIMARY_PATH = 'M-5,12 L105,12';
const PATH_LENGTH  = 110;
const WAVE_ABOVE = 'M-5,8 Q15,5 30,9 Q50,13 65,7 Q80,3 95,8 Q105,9 110,8';
const WAVE_BELOW = 'M-5,17 Q20,21 40,15 Q60,11 80,18 Q95,22 110,16';

const WAYPOINTS_3: Partial<Record<NodeId, { x: number; y: number; d: number }>> = {
  plan:      { x: 25, y: 12, d: 30 },
  adventure: { x: 50, y: 12, d: 55 },
  estimate:  { x: 75, y: 12, d: 80 },
};

const WAYPOINTS_4: Partial<Record<NodeId, { x: number; y: number; d: number }>> = {
  plan:      { x: 20, y: 12, d: 25 },
  adventure: { x: 40, y: 12, d: 45 },
  estimate:  { x: 60, y: 12, d: 65 },
  resume:    { x: 80, y: 12, d: 85 },
};

const MAP_TINT: Record<NodeId, string> = {
  plan:      'transparent',
  adventure: 'rgba(245,158,11,0.07)',
  estimate:  'rgba(14,165,233,0.07)',
  resume:    'transparent',
};

const formatLabel = (name: string) => name.split(',')[0].trim().slice(0, 14);
const DEST_FALLBACK = ROUTE_DOTS[new Date().getDay() % ROUTE_DOTS.length].label;

interface NodeConfig {
  icon: string; tag: string; tagColor: string; accentColor: string;
  heading: string; description: string; stats: string[];
  cta: string; borderColor: string;
}

export function LandingRouteScene({
  onSelectMode, lastDestination,
  hasActiveSession, onResumeSession,
  hasSavedTrip, onContinueSavedTrip,
  onExitStart,
}: Props) {
  const hasResume = !!(hasActiveSession || hasSavedTrip);
  const NODE_ORDER: NodeId[] = hasResume
    ? ['plan', 'adventure', 'estimate', 'resume']
    : ['plan', 'adventure', 'estimate'];
  const WAYPOINTS = (hasResume ? WAYPOINTS_4 : WAYPOINTS_3) as Record<NodeId, { x: number; y: number; d: number }>;

  const [selectedNode, setSelectedNode] = useState<NodeId | null>(null);
  const [descVisible, setDescVisible] = useState(false);
  const [routeMounted, setRouteMounted] = useState(false);
  const [popoverLeft, setPopoverLeft] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setRouteMounted(true), 300);
    return () => clearTimeout(id);
  }, []);

  // Compute popover horizontal position from SVG coordinate math
  const computePosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width: cw, height: ch } = el.getBoundingClientRect();
    const mobile = cw <= 640;
    setIsMobile(mobile);
    if (!selectedNode || mobile) { setPopoverLeft(null); return; }

    const vbAspect = 100 / 24;
    const cAspect = cw / ch;
    let scale: number, offsetX: number;
    if (cAspect < vbAspect) { scale = cw / 100; offsetX = 0; }
    else { scale = ch / 24; offsetX = (cw - 100 * scale) / 2; }

    const wp = WAYPOINTS[selectedNode];
    let left = offsetX + wp.x * scale;
    const halfPanel = 130;
    left = Math.max(halfPanel, Math.min(cw - halfPanel, left));
    setPopoverLeft(left);
  }, [selectedNode]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    computePosition();
    const ro = new ResizeObserver(computePosition);
    ro.observe(el);
    return () => ro.disconnect();
  }, [computePosition]);

  // Click-outside — desktop only
  useEffect(() => {
    if (selectedNode === null || isMobile) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Element;
      if (t.closest('[role="button"]') || t.closest('.lrs-desc-panel')) return;
      setDescVisible(false);
      setTimeout(() => setSelectedNode(null), 180);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [selectedNode, isMobile]);

  const resumeLabel = formatLabel(lastDestination ?? DEST_FALLBACK);

  const getNodeConfig = (node: NodeId): NodeConfig => {
    if (node !== 'resume') {
      const mc = MODE_CONFIG[node];
      return { icon: mc.icon, tag: mc.tag, tagColor: mc.tagColor, accentColor: mc.accentColor,
        heading: mc.heading, description: mc.description, stats: mc.stats,
        cta: mc.cta, borderColor: mc.borderColor };
    }
    if (hasActiveSession) return {
      icon: '✦', tag: 'ACTIVE SESSION', tagColor: '#FDBA74', accentColor: '#f97316',
      heading: resumeLabel, description: 'Pick up right where you left off.',
      stats: ['Route preserved', 'Journal intact'],
      cta: 'Resume My Trip', borderColor: 'rgba(249, 115, 22, 0.6)' };
    if (hasSavedTrip) return {
      icon: '📌', tag: 'SAVED TRIP', tagColor: '#FDBA74', accentColor: '#f97316',
      heading: resumeLabel, description: 'Continue your saved adventure.',
      stats: ['Trip data ready', 'Pick up anytime'],
      cta: 'Continue Trip', borderColor: 'rgba(249, 115, 22, 0.6)' };
    return {
      icon: '📍', tag: 'DESTINATION', tagColor: '#FDBA74', accentColor: 'rgba(249,115,22,0.5)',
      heading: 'Destination\nMEE', description: 'Your next journey starts here.',
      stats: [], cta: 'Start Planning', borderColor: 'rgba(249, 115, 22, 0.3)' };
  };

  const config = selectedNode ? getNodeConfig(selectedNode) : null;
  const traveledD = selectedNode ? WAYPOINTS[selectedNode].d : 0;
  const highlightColor = selectedNode
    ? (selectedNode === 'resume' ? '#f97316' : MODE_CONFIG[selectedNode].accentColor)
    : '#f97316';

  const selectNode = (node: NodeId) => {
    if (node === selectedNode) {
      if (!isMobile) { setDescVisible(false); setTimeout(() => setSelectedNode(null), 180); }
      return;
    }
    if (selectedNode) {
      setDescVisible(false);
      setTimeout(() => { setSelectedNode(node); setDescVisible(true); }, 180);
    } else {
      setSelectedNode(node); setDescVisible(true);
    }
  };

  const handleCtaClick = () => {
    if (!selectedNode) return;
    if (selectedNode === 'resume') {
      if (hasActiveSession && onResumeSession) onExitStart(onResumeSession);
      else if (hasSavedTrip && onContinueSavedTrip) onExitStart(onContinueSavedTrip);
      else onSelectMode('plan');
    } else { onSelectMode(selectedNode); }
  };

  const getAccent = (node: NodeId) => node === 'resume'
    ? (hasActiveSession || hasSavedTrip ? '#f97316' : 'rgba(249,115,22,0.5)')
    : MODE_CONFIG[node].accentColor;

  return (
    <div className="lrs-container" ref={containerRef}>
      <div className="lrs-tint" style={{ background: MAP_TINT[selectedNode ?? 'plan'] }} />

      <div className="lrs-svg-wrap">
        <svg viewBox="0 0 100 24" preserveAspectRatio="xMidYMid meet"
          overflow="visible" className="lrs-svg">
          <defs>
            <filter id="lrs-glow" x="-20%" y="-100%" width="140%" height="300%">
              <feGaussianBlur stdDeviation="0.6" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <path d={WAVE_ABOVE} stroke="#c4a882" strokeWidth="0.7" fill="none" opacity={0.3}
            strokeDasharray="300" strokeDashoffset={routeMounted ? 0 : 300}
            style={{ transition: 'stroke-dashoffset 3.2s ease 0.6s' }} />

          <path d={WAVE_BELOW} stroke="#f97316" strokeWidth="0.6" fill="none" opacity={0.12}
            strokeDasharray="300" strokeDashoffset={routeMounted ? 0 : 300}
            style={{ transition: 'stroke-dashoffset 3.5s ease 0.8s' }} />

          <path d={PRIMARY_PATH} stroke="rgba(249,115,22,0.15)" strokeWidth="1.5" fill="none" />

          <path d={PRIMARY_PATH} stroke="rgba(249,115,22,0.40)" strokeWidth="1.5" fill="none"
            strokeDasharray={PATH_LENGTH} strokeDashoffset={routeMounted ? 0 : PATH_LENGTH}
            style={{ transition: 'stroke-dashoffset 2.5s ease' }} />

          <path d={PRIMARY_PATH} stroke={highlightColor} strokeWidth="2.2" fill="none"
            strokeLinecap="round" filter="url(#lrs-glow)"
            strokeDasharray={PATH_LENGTH}
            strokeDashoffset={selectedNode ? PATH_LENGTH - traveledD : PATH_LENGTH}
            style={{ transition: 'stroke-dashoffset 0.75s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease' }} />

          {NODE_ORDER.map((node) => {
            const wp = WAYPOINTS[node];
            const isActive = node === selectedNode;
            const accent = getAccent(node);
            const isResume = node === 'resume';
            const label = isResume ? resumeLabel : node.toUpperCase();

            const isPlanHint = node === 'plan' && selectedNode === null;

            return (
              <g key={node} role="button" tabIndex={0} aria-pressed={isActive}
                aria-label={isResume ? resumeLabel : MODE_CONFIG[node as TripMode].cta}
                onClick={() => selectNode(node)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectNode(node); } }}
                style={{ cursor: 'pointer', outline: 'none' }}>
                <circle cx={wp.x} cy={wp.y} r={8} fill="transparent" />
                <circle cx={wp.x} cy={wp.y} r={isActive ? 5 : 3}
                  fill="none" stroke={accent} strokeWidth="0.5"
                  opacity={isActive ? 0.35 : 0.1} style={{ transition: 'opacity 0.3s ease' }} />
                {(isActive || isPlanHint) && (
                  <circle cx={wp.x} cy={wp.y} r={7}
                    fill="none" stroke={accent} strokeWidth="0.4" opacity={0.22}
                    className="lrs-pulse-ring"
                    style={{ transformBox: 'fill-box', transformOrigin: 'center' } as React.CSSProperties} />
                )}
                <circle cx={wp.x} cy={wp.y} r={isActive ? 2.2 : 1.6}
                  fill={isActive ? accent : 'rgba(255,255,255,0.3)'}
                  style={{ transition: 'fill 0.3s ease' }} />
                <text x={wp.x} y={wp.y - 5.5} textAnchor="middle"
                  fill={isActive ? accent : (isResume ? 'rgba(249,115,22,0.45)' : 'rgba(255,255,255,0.25)')}
                  fontSize={isResume ? '2.4' : '2.5'}
                  fontFamily={isResume ? 'Cormorant Garamond, Georgia, serif' : 'DM Mono, monospace'}
                  fontStyle={isResume ? 'italic' : 'normal'}
                  letterSpacing={isResume ? '0.04em' : '0.08em'}
                  style={{ transition: 'fill 0.3s ease' }}>
                  {label}
                </text>
                {!isActive && (
                  <text x={wp.x} y={wp.y + 7} textAnchor="middle"
                    fill="rgba(255,255,255,0.15)"
                    fontSize="1.9" fontFamily="DM Mono, monospace" letterSpacing="0.03em">
                    {isResume && (hasActiveSession || hasSavedTrip) ? 'resume' : 'tap'}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {config && (
        <div className={`lrs-desc-panel${descVisible ? ' lrs-desc-visible' : ''}`}
          style={{
            borderColor: config.borderColor,
            ...(popoverLeft != null ? { '--lrs-left': `${popoverLeft}px` } as React.CSSProperties : {}),
          }}>
          <div className="lrs-desc-tag"
            style={{ color: config.tagColor, background: `${config.accentColor}20` }}>
            {config.icon}&nbsp;{config.tag}
          </div>
          <h3 className="lrs-desc-heading">{config.heading}</h3>
          <p className="lrs-desc-sub">{config.description}</p>
          {config.stats.length > 0 && (
            <ul className="lrs-desc-stats">
              {config.stats.map((s) => (
                <li key={s} style={{ '--lrs-dot': config.accentColor } as React.CSSProperties}>{s}</li>
              ))}
            </ul>
          )}
          <button className="lrs-desc-cta" onClick={handleCtaClick}
            style={{
              background: `${config.accentColor}18`,
              color: config.tagColor,
              borderColor: `${config.accentColor}40`,
            }}>
            {config.cta} →
          </button>
          <p className="lrs-desc-hint">tap any waypoint to explore modes</p>
        </div>
      )}
    </div>
  );
}
