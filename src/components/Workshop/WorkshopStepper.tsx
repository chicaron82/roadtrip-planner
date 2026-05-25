import type { CSSProperties } from 'react';

export interface WorkshopStepperProps {
  value: number;
  min: number;
  max: number;
  label: (n: number) => string;
  onChange: (n: number) => void;
}

export function WorkshopStepper({ value, min, max, label, onChange }: WorkshopStepperProps) {
  const btnStyle = (disabled: boolean, active: boolean): CSSProperties => ({
    width: 36, height: 36, borderRadius: '50%', fontSize: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 150ms ease', flexShrink: 0,
    cursor: disabled ? 'default' : 'pointer',
    border: disabled ? '1px solid rgba(255,255,255,0.08)' : active
      ? '1.5px solid rgba(234,88,12,0.6)' : '1.5px solid rgba(234,88,12,0.5)',
    background: disabled ? 'rgba(255,255,255,0.03)' : active
      ? 'rgba(234,88,12,0.2)' : 'rgba(234,88,12,0.12)',
    color: disabled ? 'rgba(245,240,232,0.2)' : active ? '#f5f0e8' : 'rgba(234,88,12,0.9)',
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
      <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        style={btnStyle(value <= min, false)}>−</button>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: '#f5f0e8', lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: 13, color: 'rgba(245,240,232,0.45)', marginLeft: 6 }}>{label(value)}</span>
      </div>
      <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
        style={btnStyle(value >= max, true)}>+</button>
    </div>
  );
}
