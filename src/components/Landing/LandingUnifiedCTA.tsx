/**
 * LandingUnifiedCTA — "One question. Every path. No mode menu."
 *
 * Replaces the three mode cards with a single MEE opening question
 * and four quiet ghost escape hatches. The first-timer sees a warm
 * invitation. The returning user sees their shortcut.
 *
 * 💚 My Experience Engine — Unified Landing (Item 4)
 */

interface LandingUnifiedCTAProps {
  onPrimary: () => void;
  onAdventure: () => void;
  onEstimate: () => void;
  /** Caller must save entry preference before calling this. */
  onClassic: () => void;
  isReturning: boolean;
  lastDestination?: string;
  hasSavedTrip?: boolean;
  onContinueSavedTrip?: () => void;
  hasActiveSession?: boolean;
  onResumeSession?: () => void;
}

const HATCH_STYLE: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontFamily: "'DM Mono', monospace",
  fontSize: '12px',
  letterSpacing: '0.04em',
  color: 'rgba(245, 240, 232, 0.35)',
  cursor: 'pointer',
  padding: '4px 0',
  textDecoration: 'none',
  transition: 'color 0.2s ease, text-decoration 0.2s ease',
};

function GhostHatch({ label, onClick, delay }: { label: string; onClick: () => void; delay: number }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...HATCH_STYLE,
        animation: `mee-fade-in 400ms ease ${delay}ms both`,
        opacity: 0,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.color = 'rgba(245, 240, 232, 0.65)';
        (e.currentTarget as HTMLButtonElement).style.textDecoration = 'underline';
        (e.currentTarget as HTMLButtonElement).style.textUnderlineOffset = '3px';
        (e.currentTarget as HTMLButtonElement).style.textDecorationColor = 'rgba(245,240,232,0.25)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.color = 'rgba(245, 240, 232, 0.35)';
        (e.currentTarget as HTMLButtonElement).style.textDecoration = 'none';
      }}
    >
      {label}
    </button>
  );
}

const FADE_IN_STYLE = `
  @keyframes mee-fade-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

export function LandingUnifiedCTA({
  onPrimary,
  onAdventure,
  onEstimate,
  onClassic,
  isReturning,
  lastDestination,
  hasSavedTrip,
  onContinueSavedTrip,
  hasActiveSession,
  onResumeSession,
}: LandingUnifiedCTAProps) {
  const hasResume = !!(hasSavedTrip || hasActiveSession);
  const resumeHandler = onResumeSession ?? onContinueSavedTrip;
  const resumeLabel = lastDestination
    ? `✦ Continue your ${lastDestination.split(',')[0].trim()} trip →`
    : '✦ Continue your trip →';

  const question = isReturning ? 'Ready for your next one?' : 'Where is your MEE time?';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0',
      width: '100%',
      maxWidth: '400px',
      animation: 'mee-fade-in 500ms ease 200ms both',
      opacity: 0,
    }}>
      <style>{FADE_IN_STYLE}</style>

      {/* Resume banner */}
      {hasResume && resumeHandler && (
        <button
          onClick={resumeHandler}
          style={{
            background: 'rgba(249, 115, 22, 0.06)',
            border: '1px solid rgba(249, 115, 22, 0.2)',
            borderRadius: '100px',
            padding: '7px 18px',
            fontFamily: "'DM Mono', monospace",
            fontSize: '11px',
            letterSpacing: '0.04em',
            color: 'rgba(249, 115, 22, 0.7)',
            cursor: 'pointer',
            marginBottom: '24px',
            transition: 'background 0.2s ease, color 0.2s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(249,115,22,0.12)';
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(249,115,22,0.9)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(249,115,22,0.06)';
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(249,115,22,0.7)';
          }}
        >
          {resumeLabel}
        </button>
      )}

      {/* Opening question */}
      <p style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 'clamp(26px, 4vw, 38px)',
        fontWeight: 300,
        fontStyle: 'italic',
        color: 'rgba(245, 240, 232, 0.85)',
        textAlign: 'center',
        margin: '0 0 28px',
        lineHeight: 1.2,
        letterSpacing: '-0.01em',
      }}>
        {question}
      </p>

      {/* Primary CTA */}
      <button
        onClick={onPrimary}
        style={{
          width: '100%',
          maxWidth: '340px',
          padding: '14px 28px',
          background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
          border: 'none',
          borderRadius: '12px',
          fontFamily: "'DM Mono', monospace",
          fontSize: '14px',
          fontWeight: 500,
          letterSpacing: '0.06em',
          color: '#0d0d10',
          cursor: 'pointer',
          marginBottom: '28px',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          boxShadow: '0 4px 20px rgba(249,115,22,0.25)',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 28px rgba(249,115,22,0.35)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(249,115,22,0.25)';
        }}
        onMouseDown={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0) scale(0.98)';
        }}
        onMouseUp={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
        }}
      >
        Tell MEE →
      </button>

      {/* Ghost escape hatches */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
      }}>
        <GhostHatch label="I know where I'm going →"     onClick={onPrimary}   delay={300} />
        <GhostHatch label="Let MEE figure it out →"       onClick={onAdventure} delay={400} />
        <GhostHatch label="Just checking if it's doable →" onClick={onEstimate}  delay={500} />
        <GhostHatch label="Take me straight to the planner →" onClick={onClassic} delay={600} />
      </div>
    </div>
  );
}
