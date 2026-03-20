/**
 * WorkshopTitleInput — The naming moment.
 *
 * Lives at the bottom of UnifiedWorkshopPanel, immediately before
 * "Calculate my MEE time →". The last act of ownership before committing.
 *
 * Behavior:
 *   null value  → auto mode. Seeded title is displayed and used.
 *   typed value → custom mode. User owns the title.
 *   clearing    → resets to auto (null), not blank.
 *
 * 💚 My Experience Engine — Beat 3 title beat
 */

interface WorkshopTitleInputProps {
  value: string | null;
  seededTitle: string;
  onChange: (title: string | null) => void;
}

export function WorkshopTitleInput({ value, seededTitle, onChange }: WorkshopTitleInputProps) {
  const isCustom = value !== null && value !== '';
  const displayValue = isCustom ? value : seededTitle;

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <p style={{
          fontFamily: '"DM Sans", system-ui, sans-serif',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'rgba(245,240,232,0.5)',
          margin: 0,
        }}>
          What's this trip called?
        </p>
        {!isCustom && (
          <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.3)', letterSpacing: '0.05em' }}>
            ✦ auto
          </span>
        )}
        {isCustom && (
          <span style={{ fontSize: 10, color: 'rgba(234,88,12,0.6)', letterSpacing: '0.05em' }}>
            ✏ custom
          </span>
        )}
      </div>

      {/* Input */}
      <input
        type="text"
        value={displayValue}
        onChange={e => {
          const v = e.target.value;
          onChange(v === '' || v === seededTitle ? null : v);
        }}
        onFocus={e => { if (!isCustom) e.target.select(); }}
        style={{
          width: '100%',
          padding: '10px 12px',
          background: isCustom ? 'rgba(234,88,12,0.08)' : 'rgba(255,255,255,0.04)',
          border: isCustom
            ? '1px solid rgba(234,88,12,0.3)'
            : '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          color: isCustom ? '#f5f0e8' : 'rgba(245,240,232,0.5)',
          fontSize: 14,
          fontFamily: '"Cormorant Garamond", Georgia, serif',
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'all 150ms ease',
        }}
      />

      {/* Reset — only when custom */}
      {isCustom && (
        <button
          onClick={() => onChange(null)}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(245,240,232,0.3)',
            fontSize: 11,
            cursor: 'pointer',
            padding: '4px 0',
            marginTop: 2,
          }}
        >
          ✦ reset to auto
        </button>
      )}
    </div>
  );
}
