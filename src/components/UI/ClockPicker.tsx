import { useState, useRef, useEffect } from 'react';

interface ClockPickerProps {
  value: string;       // "HH:mm" 24-hour format
  onChange: (value: string) => void;
  disabled?: boolean;
}

const SIZE = 164;
const CENTER = SIZE / 2;
const RADIUS = 60;

// Hours 1–12 at standard clock positions
const HOUR_POSITIONS = Array.from({ length: 12 }, (_, i) => {
  const hour = i + 1;
  const angle = (hour / 12) * 2 * Math.PI - Math.PI / 2;
  return { hour, x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) };
});

// Minutes 00–55 in 5-min steps at the same 12 clock positions (00 at top)
const MINUTE_POSITIONS = Array.from({ length: 12 }, (_, i) => {
  const minute = i * 5;
  const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
  return { minute, x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) };
});

function parse(value: string): { h: number; m: number } {
  const [h, m] = value.split(':').map(Number);
  return { h: h || 0, m: m || 0 };
}

function format(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function to24(hour12: number, pm: boolean): number {
  if (pm) return hour12 === 12 ? 12 : hour12 + 12;
  return hour12 === 12 ? 0 : hour12;
}

export function ClockPicker({ value, onChange, disabled }: ClockPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'hour' | 'minute'>('hour');
  const ref = useRef<HTMLDivElement>(null);

  const { h, m } = parse(value);
  const isPM = h >= 12;
  const hour12 = h % 12 || 12;
  // Snap displayed minutes to nearest 5 for highlight matching
  const snappedM = Math.round(m / 5) * 5 % 60;

  const displayLabel = `${hour12}:${String(m).padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;

  // Close on outside click, reset step for next open
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setStep('hour');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleOpen = () => {
    setStep('hour');
    setIsOpen(o => !o);
  };

  // Clicking an hour advances to minute selection
  const handleHour = (clickedHour: number) => {
    onChange(format(to24(clickedHour, isPM), m));
    setStep('minute');
  };

  // Clicking a minute closes the picker
  const handleMinute = (clickedMin: number) => {
    onChange(format(to24(hour12, isPM), clickedMin));
    setIsOpen(false);
    setStep('hour');
  };

  const handleAmPm = (pm: boolean) => {
    onChange(format(to24(hour12, pm), m));
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className="w-full mt-1 px-3 py-2 text-sm rounded-md border border-input bg-background text-left
                   disabled:opacity-50 disabled:cursor-not-allowed
                   hover:border-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring
                   font-mono tracking-wide"
      >
        {displayLabel}
      </button>

      {isOpen && !disabled && (
        <div
          className="absolute z-50 mt-1.5 p-3 rounded-xl border border-border bg-popover shadow-xl"
          style={{ width: SIZE + 24 }}
        >
          {/* AM / PM */}
          <div className="flex gap-2 mb-3">
            {(['AM', 'PM'] as const).map(period => (
              <button
                key={period}
                type="button"
                onClick={() => handleAmPm(period === 'PM')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  (period === 'PM') === isPM
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {period}
              </button>
            ))}
          </div>

          {/* Time display — click hour or minute segment to jump back/forward */}
          <div className="flex items-center justify-center gap-0.5 mb-2">
            <button
              type="button"
              onClick={() => setStep('hour')}
              className={`px-2 py-0.5 rounded font-mono text-lg font-semibold transition-colors ${
                step === 'hour' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {String(hour12).padStart(2, '0')}
            </button>
            <span className="text-lg font-semibold text-muted-foreground select-none">:</span>
            <button
              type="button"
              onClick={() => setStep('minute')}
              className={`px-2 py-0.5 rounded font-mono text-lg font-semibold transition-colors ${
                step === 'minute' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {String(m).padStart(2, '0')}
            </button>
          </div>

          {/* Clock face */}
          <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
            <div className="absolute inset-0 rounded-full border-2 border-border/60" />
            <div
              className="absolute w-2 h-2 rounded-full bg-muted-foreground/40"
              style={{ left: CENTER - 4, top: CENTER - 4 }}
            />

            {step === 'hour' && HOUR_POSITIONS.map(({ hour, x, y }) => (
              <button
                key={hour}
                type="button"
                onClick={() => handleHour(hour)}
                style={{ position: 'absolute', left: x - 15, top: y - 15, width: 30, height: 30 }}
                className={`rounded-full text-xs font-medium transition-colors flex items-center justify-center ${
                  hour === hour12
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                {hour}
              </button>
            ))}

            {step === 'minute' && MINUTE_POSITIONS.map(({ minute, x, y }) => (
              <button
                key={minute}
                type="button"
                onClick={() => handleMinute(minute)}
                style={{ position: 'absolute', left: x - 15, top: y - 15, width: 30, height: 30 }}
                className={`rounded-full text-xs font-medium transition-colors flex items-center justify-center ${
                  minute === snappedM
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                {String(minute).padStart(2, '0')}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
