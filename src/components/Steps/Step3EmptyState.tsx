import type { PlanningStep } from '../../hooks';

interface Step3EmptyStateProps {
  onGoToStep: (step: PlanningStep) => void;
}

/**
 * Shown in Step 3 when no route has been calculated yet.
 * Guides the user back into the planning flow with clear next-step actions.
 */
export function Step3EmptyState({ onGoToStep }: Step3EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '32px 20px 28px',
        borderRadius: 16,
        background: 'rgba(249,115,22,0.04)',
        border: '1px solid rgba(249,115,22,0.12)',
      }}
    >
      {/* Animated route icon */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        {/* Pulse rings */}
        <div style={{
          position: 'absolute', inset: '-10px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)',
          animation: 'ping 2.4s cubic-bezier(0,0,0.2,1) infinite',
        }} />
        <div style={{
          width: 52, height: 52,
          borderRadius: '50%',
          background: 'rgba(249,115,22,0.1)',
          border: '1px solid rgba(249,115,22,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Road / waypoint icon */}
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(249,115,22,0.85)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="2" />
            <path d="M12 7v10" strokeDasharray="2 2" />
            <circle cx="12" cy="19" r="2" />
            <path d="M8 5 Q4 12 8 19" opacity="0.35" />
            <path d="M16 5 Q20 12 16 19" opacity="0.35" />
          </svg>
        </div>
      </div>

      {/* Headline */}
      <p style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 22,
        fontWeight: 600,
        fontStyle: 'italic',
        color: 'rgba(245,240,232,0.85)',
        margin: '0 0 8px',
        lineHeight: 1.2,
      }}>
        Your route is waiting.
      </p>

      {/* Sub-copy */}
      <p style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 12,
        color: 'rgba(255,255,255,0.35)',
        margin: '0 0 24px',
        lineHeight: 1.6,
        maxWidth: 240,
        letterSpacing: '0.02em',
      }}>
        Set your locations and hit Calculate to see your full trip breakdown here.
      </p>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => onGoToStep(1)}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            background: 'rgba(249,115,22,0.14)',
            border: '1px solid rgba(249,115,22,0.35)',
            color: '#fb923c',
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: '0.05em',
            cursor: 'pointer',
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(249,115,22,0.22)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(249,115,22,0.14)')}
        >
          ① Set Locations
        </button>
        <button
          onClick={() => onGoToStep(2)}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.45)',
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: '0.05em',
            cursor: 'pointer',
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
        >
          ② Configure Drive
        </button>
      </div>
    </div>
  );
}