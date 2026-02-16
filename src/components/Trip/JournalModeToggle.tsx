import { Map, BookOpen } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ViewMode = 'plan' | 'journal';

interface JournalModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  hasActiveJournal: boolean;
  className?: string;
}

export function JournalModeToggle({
  mode,
  onChange,
  hasActiveJournal,
  className,
}: JournalModeToggleProps) {
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

      {/* Journal Mode Button */}
      <button
        onClick={() => onChange('journal')}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
          mode === 'journal'
            ? 'bg-white text-purple-600 shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
        )}
      >
        <BookOpen className="h-4 w-4" />
        <span>Journal</span>
        {!hasActiveJournal && mode !== 'journal' && (
          <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">
            NEW
          </span>
        )}
      </button>
    </div>
  );
}

// Start Journal CTA for when no journal exists yet
interface StartJournalCTAProps {
  onStart: () => void;
  className?: string;
}

export function StartJournalCTA({ onStart, className }: StartJournalCTAProps) {
  return (
    <div
      className={cn(
        'rounded-xl border-2 border-dashed border-purple-200 bg-purple-50/50 p-6 text-center',
        className
      )}
    >
      <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-3">
        <BookOpen className="h-6 w-6 text-purple-600" />
      </div>

      <h3 className="font-bold text-purple-900 mb-1">Start Your Trip Journal</h3>

      <p className="text-sm text-purple-700 mb-4 max-w-xs mx-auto">
        Capture photos, add notes, and track actual times as you travel. Create memories you can
        share!
      </p>

      <button
        onClick={onStart}
        className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-sm transition-colors"
      >
        <BookOpen className="h-4 w-4" />
        Start Journaling
      </button>

      <p className="text-xs text-purple-500 mt-3">
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
