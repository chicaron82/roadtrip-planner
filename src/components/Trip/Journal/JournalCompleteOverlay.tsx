import { CheckCircle2, BookOpen } from 'lucide-react';
import type { TripJournal } from '../../../types';

interface Props {
  journal: TripJournal;
  onConfirm: () => void;
}

/**
 * Full-screen overlay shown when the active journal is complete.
 * User must explicitly confirm before state is cleared — no silent auto-wipe.
 */
export function JournalCompleteOverlay({ journal, onConfirm }: Props) {
  const title = journal.metadata.title || 'Your Trip';
  const stopsVisited = journal.stats.stopsVisited;
  const totalStops = journal.tripSummary.segments.filter(
    s => !s.to.id?.startsWith('guard-')
  ).length;

  const startDate = journal.metadata.dates.plannedStart
    ? new Date(journal.metadata.dates.plannedStart).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : null;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-6">
      {/* Icon */}
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
      </div>

      {/* Heading */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-foreground">Trip Complete!</h2>
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
        {startDate && (
          <p className="text-xs text-muted-foreground">{startDate}</p>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <BookOpen className="h-4 w-4" />
        <span>
          {stopsVisited} of {totalStops} stop{totalStops !== 1 ? 's' : ''} visited
        </span>
      </div>

      {/* Body copy */}
      <p className="text-sm text-muted-foreground max-w-xs">
        You've logged every stop on this trip. Mark it as complete to archive
        it — you can still read it any time in your journal history.
      </p>

      {/* CTA */}
      <button
        onClick={onConfirm}
        className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium text-sm transition-all hover:bg-green-700 active:scale-[0.98]"
      >
        <CheckCircle2 className="h-4 w-4" />
        Mark Trip as Complete
      </button>
    </div>
  );
}
