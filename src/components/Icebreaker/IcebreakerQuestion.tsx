/**
 * IcebreakerQuestion — Shared question wrapper for all icebreaker flows.
 *
 * Handles the fade-in animation on mount (step change triggers remount via key).
 * The parent controls the fade-out by setting isExiting=true before advancing.
 *
 * 💚 My Experience Engine
 */

interface IcebreakerQuestionProps {
  question: string;
  isExiting: boolean;
  onBack?: () => void;
  onEscape: () => void;
  children: React.ReactNode;
}

export function IcebreakerQuestion({
  question,
  isExiting,
  onBack,
  onEscape,
  children,
}: IcebreakerQuestionProps) {
  return (
    <div
      style={{
        opacity: isExiting ? 0 : undefined,
        transform: isExiting ? 'translateY(-6px)' : undefined,
        transition: isExiting ? 'opacity 200ms ease, transform 200ms ease' : undefined,
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
        width: '100%',
      }}
    >
      <style>{`
        @keyframes icebreakerFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Eyebrow + Question — tightly grouped so they read as one thought */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Conversational primer — shown only on the first question (no back nav) */}
        {!onBack && (
          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 'clamp(11px, 1.2vw, 13px)',
            fontWeight: 500,
            color: 'rgba(255, 255, 255, 0.4)',
            letterSpacing: '0.1em',
            textAlign: 'center',
            margin: 0,
            animation: 'icebreakerFadeIn 280ms ease both',
          }}>
            Talk to MEE
          </p>
        )}

        {/* Question */}
        <h2 style={{
          fontFamily: '"Cormorant Garamond", Georgia, serif',
          fontSize: 'clamp(24px, 4vw, 36px)',
          fontWeight: 600,
          color: '#f5f0e8',
          lineHeight: 1.2,
          letterSpacing: '-0.01em',
          margin: 0,
          animation: `icebreakerFadeIn 280ms ease ${!onBack ? '100ms' : '0ms'} both`,
        }}>
          {question}
        </h2>

      </div>

      {/* Input area */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        animation: 'icebreakerFadeIn 280ms ease 60ms both',
      }}>
        {children}
      </div>

      {/* Nav row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '4px',
        animation: 'icebreakerFadeIn 280ms ease 80ms both',
      }}>
        {onBack ? (
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.5)', fontSize: '14px', cursor: 'pointer', padding: '4px 0' }}
          >
            ← Back
          </button>
        ) : <span />}
        <button
          onClick={onEscape}
          style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.35)', fontSize: '12px', cursor: 'pointer', padding: '4px 0' }}
        >
          Skip to full planner →
        </button>
      </div>
    </div>
  );
}
