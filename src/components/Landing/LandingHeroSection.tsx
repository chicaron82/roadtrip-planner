interface Props {
  pulseActive: boolean;
  hasSavedTrip?: boolean;
  onContinueSavedTrip?: () => void;
  hasActiveSession?: boolean;
  onResumeSession?: () => void;
  onExitStart: (fn: () => void) => void;
}

export function LandingHeroSection({
  pulseActive,
  hasSavedTrip,
  onContinueSavedTrip,
  hasActiveSession,
  onResumeSession,
  onExitStart,
}: Props) {
  return (
    <div style={{ textAlign: 'center', maxWidth: '600px' }}>

      {/* Eyebrow with heartbeat orb */}
      <div
        className="landing-hero-eyebrow"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}
      >
        <div style={{
          width: '9px',
          height: '9px',
          borderRadius: '50%',
          background: '#f97316',
          flexShrink: 0,
          boxShadow: pulseActive
            ? '0 0 0 5px rgba(249,115,22,0.15), 0 0 0 10px rgba(249,115,22,0.06)'
            : '0 0 0 0px rgba(249,115,22,0)',
          transition: 'box-shadow 1.2s ease',
        }} />
        <div style={{ textAlign: 'left' }}>
          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '15px',
            fontWeight: 500,
            letterSpacing: '0.15em',
            color: 'rgba(255,255,255,0.65)',
            textTransform: 'uppercase',
            margin: 0,
            lineHeight: 1.3,
          }}>
            My Experience Engine™ (MEE)
          </p>
          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '11px',
            color: 'rgba(255,255,255,0.3)',
            letterSpacing: '0.05em',
            margin: 0,
            fontStyle: 'italic',
          }}>
            /pronounced "me"/
          </p>
        </div>
      </div>

      {/* Hero title */}
      <h1 className="landing-hero-title" style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 'clamp(36px, 5.5vw, 68px)',
        fontWeight: 300,
        fontStyle: 'italic',
        color: '#F8FAFF',
        lineHeight: 1.0,
        letterSpacing: '-0.01em',
        margin: '0 0 28px',
      }}>
        The Open Road
        <br />
        <span style={{
          fontStyle: 'normal',
          fontWeight: 600,
          background: 'linear-gradient(135deg, #f97316 0%, #fb923c 60%, #fbbf24 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Is Calling.
        </span>
        <br />
        <span style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 'clamp(12px, 1.3vw, 15px)',
          fontStyle: 'normal',
          fontWeight: 400,
          color: 'rgba(255,255,255,0.35)',
          letterSpacing: '0.02em',
          WebkitTextFillColor: 'rgba(255,255,255,0.35)',
        }}>
          Get driving. Enjoy your MEE time.
        </span>
      </h1>

      {/* Continue Saved Trip */}
      {hasSavedTrip && onContinueSavedTrip && !hasActiveSession && (
        <div style={{ marginBottom: '24px' }}>
          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '11px',
            color: '#fb923c',
            letterSpacing: '0.05em',
            marginBottom: '8px',
          }}>
            ✦ You have a saved trip
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); onExitStart(onContinueSavedTrip); }}
            style={{
              background: 'rgba(249, 115, 22, 0.12)',
              border: '1px solid rgba(249, 115, 22, 0.35)',
              color: '#FDBA74',
              padding: '10px 24px',
              borderRadius: '100px',
              fontFamily: "'DM Mono', monospace",
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '0.05em',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 0 20px rgba(249, 115, 22, 0.08)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(249, 115, 22, 0.22)';
              e.currentTarget.style.boxShadow = '0 0 30px rgba(249, 115, 22, 0.18)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(249, 115, 22, 0.12)';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(249, 115, 22, 0.08)';
            }}
          >
            Continue where you left off →
          </button>
        </div>
      )}

      {/* Active Session Resume */}
      {hasActiveSession && onResumeSession && (
        <div style={{ marginBottom: '24px' }}>
          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '11px',
            color: '#fb923c',
            letterSpacing: '0.05em',
            marginBottom: '8px',
          }}>
            ✦ Session restored from background
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); onExitStart(onResumeSession); }}
            className="resume-session-btn"
            style={{
              background: 'rgba(249, 115, 22, 0.15)',
              border: '1px solid rgba(249, 115, 22, 0.4)',
              color: '#FDBA74',
              padding: '10px 24px',
              borderRadius: '100px',
              fontFamily: "'DM Mono', monospace",
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '0.05em',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 0 20px rgba(249, 115, 22, 0.1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(249, 115, 22, 0.25)';
              e.currentTarget.style.boxShadow = '0 0 30px rgba(249, 115, 22, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(249, 115, 22, 0.15)';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(249, 115, 22, 0.1)';
            }}
          >
            Resume where you left off →
          </button>
        </div>
      )}

      {/* Lifecycle indicator */}
      <div className="landing-lifecycle" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        fontFamily: "'DM Mono', monospace",
        fontSize: '10px',
        color: 'rgba(255,255,255,0.25)',
        letterSpacing: '0.12em',
      }}>
        {['DISCOVER', 'VALIDATE', 'BUILD', 'REFINE'].map((step, i) => (
          <span key={step}>
            {i > 0 && <span style={{ opacity: 0.3, marginRight: '10px' }}>→</span>}
            <span style={{ opacity: 0.5 }}>{step}</span>
          </span>
        ))}
        <span style={{ opacity: 0.3 }}>→</span>
        <span style={{ color: '#f97316', textShadow: '0 0 8px rgba(249, 115, 22, 0.5)' }}>
          COMMIT
        </span>
      </div>
    </div>
  );
}
