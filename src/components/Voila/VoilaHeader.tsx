import { printTrip } from '../Trip/StepHelpers/TripPrintView';
import type { PrintInput } from '../../lib/canonical-trip';
import type { TimedEvent } from '../../lib/trip-timeline';

interface VoilaHeaderProps {
  printInput?: PrintInput;
  precomputedEvents?: TimedEvent[];
  onShare: () => void;
}

export function VoilaHeader({ printInput, precomputedEvents, onShare }: VoilaHeaderProps) {
  const canPrint = !!(printInput && precomputedEvents?.length);
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px 12px',
      borderBottom: '1px solid rgba(245, 240, 232, 0.07)',
      flexShrink: 0,
    }}>
      <button
        onClick={() => { if (canPrint) printTrip({ printInput: printInput!, precomputedEvents: precomputedEvents! }); }}
        disabled={!canPrint}
        style={{
          background: 'rgba(245, 240, 232, 0.06)',
          border: '1px solid rgba(245, 240, 232, 0.1)',
          borderRadius: 100,
          padding: '6px 14px',
          color: canPrint ? 'rgba(245, 240, 232, 0.7)' : 'rgba(245, 240, 232, 0.25)',
          fontFamily: '"DM Sans", system-ui, sans-serif',
          fontSize: 13,
          cursor: canPrint ? 'pointer' : 'default',
        }}
      >
        Print
      </button>

      <p style={{
        fontFamily: '"DM Mono", "Courier New", monospace',
        fontSize: 12,
        color: '#f97316',
        letterSpacing: '0.1em',
        opacity: 0.85,
        margin: '0 8px',
        flex: 1,
        textAlign: 'center',
        whiteSpace: 'nowrap',
      }}>
        ✦ Here&apos;s your MEE time.
      </p>

      <button
        onClick={onShare}
        style={{
          background: 'rgba(245, 240, 232, 0.06)',
          border: '1px solid rgba(245, 240, 232, 0.1)',
          borderRadius: 100,
          padding: '6px 14px',
          color: 'rgba(245, 240, 232, 0.7)',
          fontFamily: '"DM Sans", system-ui, sans-serif',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Share
      </button>
    </div>
  );
}
