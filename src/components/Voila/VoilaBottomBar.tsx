interface VoilaBottomBarProps {
  activeJournalSummary?: { title: string; visitedCount: number; totalStops: number } | null;
  onReturnToJournal?: () => void;
  onEditTrip: () => void;
  onLockIn: () => void;
  onSkipJournal?: () => void;
}

export function VoilaBottomBar({
  activeJournalSummary, onReturnToJournal,
  onEditTrip, onLockIn, onSkipJournal,
}: VoilaBottomBarProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: '12px 16px',
      borderTop: '1px solid rgba(245, 240, 232, 0.07)',
      flexShrink: 0,
    }}>
      {activeJournalSummary && onReturnToJournal && (
        <button
          onClick={onReturnToJournal}
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'rgba(74, 222, 128, 0.08)',
            border: '1px solid rgba(74, 222, 128, 0.2)',
            borderRadius: 10,
            color: '#86efac',
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🚗</span>
            <span style={{ fontWeight: 500 }}>{activeJournalSummary.title}</span>
            <span style={{ opacity: 0.6, fontSize: 11 }}>
              {activeJournalSummary.visitedCount}/{activeJournalSummary.totalStops} stops
            </span>
          </span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>Return →</span>
        </button>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onEditTrip}
          style={{
            flex: 1,
            padding: '13px 0',
            background: 'rgba(245, 240, 232, 0.06)',
            border: '1px solid rgba(245, 240, 232, 0.1)',
            borderRadius: 12,
            color: '#f5f0e8',
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Let MEE make it better
        </button>
        {activeJournalSummary ? (
          <button
            onClick={onReturnToJournal}
            style={{
              flex: 1,
              padding: '13px 0',
              background: '#f97316',
              border: 'none',
              borderRadius: 12,
              color: '#fff',
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Open journal →
          </button>
        ) : (
          <button
            onClick={onLockIn}
            style={{
              flex: 1,
              padding: '13px 0',
              background: '#f97316',
              border: 'none',
              borderRadius: 12,
              color: '#fff',
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Lock it in →
          </button>
        )}
      </div>

      {!activeJournalSummary && onSkipJournal && (
        <button
          onClick={onSkipJournal}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: '"DM Mono", monospace',
            fontSize: 11,
            color: 'rgba(245, 240, 232, 0.3)',
            letterSpacing: '0.06em',
            textAlign: 'center',
            padding: '2px 0 4px',
          }}
        >
          No thanks, skip journal
        </button>
      )}
    </div>
  );
}
