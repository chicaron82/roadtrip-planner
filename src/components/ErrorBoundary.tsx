import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level error boundary. Catches render errors that would otherwise
 * white-screen the app (e.g. malformed URL state, corrupted TripSummary).
 * Offers a hard reset that navigates to the bare URL, clearing all query params.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[MEE] Render error caught by boundary:', error, info.componentStack);
  }

  handleReset = () => {
    window.location.href = window.location.pathname;
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a1628',
          color: '#e2e8f0',
          padding: '2rem',
          textAlign: 'center',
          gap: '1rem',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: '2.5rem' }}>🛑</div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
          Something went wrong
        </h1>
        <p style={{ color: '#94a3b8', margin: 0, maxWidth: 360, lineHeight: 1.6 }}>
          An unexpected error occurred. Resetting your trip should fix it.
        </p>
        <button
          onClick={this.handleReset}
          style={{
            marginTop: '0.5rem',
            padding: '0.625rem 1.5rem',
            background: 'rgba(249,115,22,0.15)',
            border: '1px solid rgba(249,115,22,0.4)',
            borderRadius: '0.5rem',
            color: '#fb923c',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 600,
            letterSpacing: '0.05em',
          }}
        >
          Reset Trip
        </button>
        {import.meta.env.DEV && this.state.error && (
          <pre
            style={{
              marginTop: '1rem',
              padding: '1rem',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '0.5rem',
              fontSize: '0.75rem',
              color: '#fca5a5',
              maxWidth: '100%',
              overflow: 'auto',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
            }}
          >
            {this.state.error.message}
          </pre>
        )}
      </div>
    );
  }
}
