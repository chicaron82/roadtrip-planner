import { useState } from 'react';
import { Map, BookOpen, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { TripMode } from '../../types';

export type ViewMode = 'plan' | 'journal';

const MODE_COLOR: Record<string, string> = {
  plan: '#22C55E',
  estimate: '#3B82F6',
  adventure: '#F59E0B',
};

interface JournalModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  hasActiveJournal: boolean;
  disabled?: boolean;
  className?: string;
  tripMode?: TripMode;
}

export function JournalModeToggle({
  mode,
  onChange,
  hasActiveJournal,
  disabled,
  className,
  tripMode = 'plan',
}: JournalModeToggleProps) {
  const journalDisabled = disabled && mode !== 'journal';
  const accentColor = MODE_COLOR[tripMode] ?? '#22C55E';
  return (
    <div className={cn('flex items-center gap-1 p-1 rounded-lg bg-muted/50', className)}>
      {/* Plan Mode Button */}
      <button
        onClick={() => onChange('plan')}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
          mode === 'plan'
            ? 'bg-white text-primary shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
        )}
      >
        <Map className="h-4 w-4" />
        <span>Plan</span>
      </button>

      {/* My MEE Time (Journal) Mode Button */}
      <button
        onClick={() => !journalDisabled && onChange('journal')}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
          journalDisabled
            ? 'text-muted-foreground/50 cursor-not-allowed'
            : mode === 'journal'
              ? 'bg-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
        )}
        style={mode === 'journal' && !journalDisabled ? { color: accentColor } : undefined}
        title={journalDisabled ? 'Confirm your trip first' : undefined}
      >
        {journalDisabled ? <Lock className="h-3.5 w-3.5" /> : <BookOpen className="h-4 w-4" />}
        <span>My MEE Time</span>
        {journalDisabled && (
          <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">
            Confirm first
          </span>
        )}
        {!journalDisabled && !hasActiveJournal && mode !== 'journal' && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
            style={{ background: `${accentColor}18`, color: accentColor }}
          >
            NEW
          </span>
        )}
      </button>
    </div>
  );
}

// Start Journal CTA — expands to show a name input before creating the journal
interface StartJournalCTAProps {
  onStart: (title?: string) => void;
  className?: string;
  /** Pre-filled title suggestion (e.g. challenge title or template name) */
  defaultName?: string;
  /** Mode colour used for accents instead of flat purple */
  tripMode?: TripMode;
}

export function StartJournalCTA({ onStart, className, defaultName, tripMode = 'plan' }: StartJournalCTAProps) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(defaultName ?? '');
  const accentColor = MODE_COLOR[tripMode] ?? '#22C55E';

  if (!expanded) {
    return (
      <div
        className={cn('rounded-xl border-2 border-dashed p-6 text-center', className)}
        style={{
          borderColor: `${accentColor}40`,
          background: `${accentColor}06`,
        }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
          style={{ background: `${accentColor}18` }}
        >
          <BookOpen className="h-6 w-6" style={{ color: accentColor }} />
        </div>

        <h3 className="font-bold mb-1" style={{ color: 'hsl(var(--foreground))' }}>
          Remember This MEE Time
        </h3>

        <p className="text-sm mb-4 max-w-xs mx-auto" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Capture the real version of this trip — what actually happened.
        </p>

        <button
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-white rounded-lg font-medium text-sm transition-all hover:opacity-90"
          style={{ background: accentColor }}
        >
          <BookOpen className="h-4 w-4" />
          Remember My MEE Time
        </button>

        <p className="text-xs mt-3" style={{ color: `${accentColor}80` }}>
          Works offline. Your memories are saved locally.
        </p>
      </div>
    );
  }

  // Expanded: name input form
  return (
    <div
      className={cn('rounded-xl border-2 p-6', className)}
      style={{
        borderColor: `${accentColor}50`,
        background: `${accentColor}06`,
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="h-5 w-5" style={{ color: accentColor }} />
        <h3 className="font-bold text-foreground">Name your MEE time</h3>
      </div>

      <p className="text-sm text-muted-foreground mb-3">
        Give it a personal title — your name, a vibe, anything that feels right.
      </p>

      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g. Jenny's Eastern US Run"
        maxLength={80}
        className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 placeholder:text-muted-foreground/40 mb-4"
        style={{
          borderColor: `${accentColor}40`,
          // @ts-expect-error CSS custom property
          '--tw-ring-color': `${accentColor}60`,
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') onStart(name.trim() || undefined);
        }}
        autoFocus
      />

      <div className="flex gap-2">
        <button
          onClick={() => onStart(name.trim() || undefined)}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-lg font-medium text-sm transition-all hover:opacity-90"
          style={{ background: accentColor }}
        >
          <BookOpen className="h-4 w-4" />
          Remember My MEE Time
        </button>
        <button
          onClick={() => setExpanded(false)}
          className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:bg-muted"
        >
          Back
        </button>
      </div>

      <p className="text-xs mt-3 text-center" style={{ color: `${accentColor}80` }}>
        Works offline. Your memories are saved locally.
      </p>
    </div>
  );
}

// Active Trip Indicator
interface ActiveTripIndicatorProps {
  tripTitle: string;
  dayNumber: number;
  photosCount: number;
  className?: string;
}

export function ActiveTripIndicator({
  tripTitle,
  dayNumber,
  photosCount,
  className,
}: ActiveTripIndicatorProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
        <span className="text-sm font-medium">
          Day {dayNumber}: {tripTitle}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-purple-100">
        <span>{photosCount} photos</span>
      </div>
    </div>
  );
}
