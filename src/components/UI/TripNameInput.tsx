import { Pencil, Sparkles } from 'lucide-react';

interface TripNameInputProps {
  value: string | null;
  autoTitle: string;
  onChange: (title: string | null) => void;
}

/**
 * Inline trip name input for Step 1.
 *
 * - Empty field = auto mode (MEE title). Shows auto-generated title as placeholder.
 * - Any typed value = custom mode. User owns the title.
 * - Clearing the field resets back to auto.
 */
export function TripNameInput({ value, autoTitle, onChange }: TripNameInputProps) {
  const isCustom = value !== null && value !== '';

  return (
    <div className="mt-4">
      <div className="flex items-center gap-1.5 mb-1.5">
        {isCustom
          ? <Pencil className="h-3 w-3 text-muted-foreground" />
          : <Sparkles className="h-3 w-3 text-blue-400/70" />
        }
        <span className="text-xs font-medium text-muted-foreground">Trip Name</span>
        {!isCustom && (
          <span className="text-[10px] text-blue-400/60 font-medium">auto</span>
        )}
      </div>
      <input
        type="text"
        value={value ?? ''}
        placeholder={autoTitle}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? null : v);
        }}
        className="w-full bg-muted/30 border border-white/10 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500/40 focus:bg-muted/50 transition-colors"
      />
      {isCustom && (
        <button
          onClick={() => onChange(null)}
          className="mt-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          Reset to auto title
        </button>
      )}
    </div>
  );
}
