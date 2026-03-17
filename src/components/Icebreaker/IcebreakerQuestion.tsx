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
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? 'translateY(-6px)' : 'translateY(0)',
        transition: 'opacity 200ms ease, transform 200ms ease',
        animation: isExiting ? 'none' : 'icebreakerFadeIn 280ms ease forwards',
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

      {/* Question */}
      <h2 style={{
        fontFamily: '"Cormorant Garamond", Georgia, serif',
        fontSize: 'clamp(24px, 4vw, 36px)',
        fontWeight: 600,
        color: '#f5f0e8',
        lineHeight: 1.2,
        letterSpacing: '-0.01em',
        margin: 0,
      }}>
        {question}
      </h2>

      {/* Input area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {children}
      </div>

      {/* Nav row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
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
