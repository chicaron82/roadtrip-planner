/**
 * ShareOptionsRow — Single checkbox row in the MakeMEETimeScreen curation checklist.
 *
 * 💚 My Experience Engine
 */

interface ShareOptionsRowProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  preview: string;
  required?: boolean;
  disabled?: boolean;
}

export function ShareOptionsRow({ checked, onChange, label, preview, required, disabled }: ShareOptionsRowProps) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: '12px 0',
      borderBottom: '1px solid rgba(245, 240, 232, 0.06)',
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.5 : 1,
    }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        style={{ marginTop: 2, accentColor: '#f97316', flexShrink: 0 }}
      />
      <div>
        <div style={{
          fontFamily: '"DM Sans", system-ui, sans-serif',
          fontSize: 14,
          color: 'rgba(245, 240, 232, 0.9)',
          marginBottom: 2,
        }}>
          {label}
          {required && (
            <span style={{ color: '#f97316', marginLeft: 4, fontSize: 12 }}>*</span>
          )}
        </div>
        <div style={{
          fontFamily: '"DM Sans", system-ui, sans-serif',
          fontSize: 12,
          color: 'rgba(245, 240, 232, 0.4)',
        }}>
          {preview}
        </div>
      </div>
    </label>
  );
}
