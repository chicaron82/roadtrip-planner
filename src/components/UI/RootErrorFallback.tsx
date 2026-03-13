/**
 * Root-level fallback UI for the outermost ErrorBoundary in main.tsx.
 *
 * Intentionally uses plain inline styles rather than Tailwind or the app's
 * design-system components — a root-level crash happens before any CSS
 * bundles or context providers are guaranteed to have loaded.
 */
export function RootErrorFallback() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0e0b07', color: 'rgba(255,255,255,0.85)',
      padding: '2rem', textAlign: 'center', gap: '1rem',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ fontSize: '2.5rem' }}>🛑</div>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Something went wrong</h1>
      <p style={{ color: 'rgba(255,255,255,0.45)', margin: 0, maxWidth: 360, lineHeight: 1.6 }}>
        An unexpected error occurred. Resetting your trip should fix it.
      </p>
      <button
        onClick={() => { window.location.href = window.location.pathname; }}
        style={{
          marginTop: '0.5rem', padding: '0.625rem 1.5rem',
          background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)',
          borderRadius: '0.5rem', color: '#fb923c', cursor: 'pointer',
          fontSize: '0.875rem', fontWeight: 600, letterSpacing: '0.05em',
        }}
      >
        Reset Trip
      </button>
    </div>
  );
}
