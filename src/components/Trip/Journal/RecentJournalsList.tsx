import { BookOpen, CheckCircle2, MapPin } from 'lucide-react';
import { useJournalHistory } from '../../../hooks';

/**
 * Read-only list of past journals, shown in place of RecentTrips when the
 * user is in journal view mode. Journals sorted most-recent-first.
 */
export function RecentJournalsList() {
  const { journals, isLoading } = useJournalHistory();

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center animate-pulse">
        Loading journal history...
      </div>
    );
  }

  if (journals.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        No past journals yet. Your completed trips will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Journal History
      </h3>
      <div className="space-y-2">
        {journals.map(journal => {
          const totalStops = journal.tripSummary.segments.filter(
            s => !s.to.id?.startsWith('guard-')
          ).length;
          const visited = journal.stats.stopsVisited;
          const isComplete = visited >= totalStops && totalStops > 0;
          const dateStr = journal.createdAt
            ? new Date(journal.createdAt).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })
            : null;

          return (
            <div
              key={journal.id}
              className="flex items-start gap-3 rounded-lg border bg-card p-3"
            >
              <div className="mt-0.5 shrink-0">
                {isComplete
                  ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                  : <BookOpen className="h-4 w-4 text-muted-foreground" />
                }
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {journal.metadata.title || 'Untitled Journal'}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {dateStr && (
                    <span className="text-xs text-muted-foreground">{dateStr}</span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {visited}/{totalStops} stops
                  </span>
                  {isComplete && (
                    <span className="text-xs font-medium text-green-600">Complete</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
