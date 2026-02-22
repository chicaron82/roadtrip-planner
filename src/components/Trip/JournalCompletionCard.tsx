import type { TripJournal, TripSummary, TripSettings } from '../../types';
import { exportJournalAsHTML, exportJournalAsTemplate } from '../../lib/journal-export';

interface JournalCompletionCardProps {
  journal: TripJournal;
  summary: TripSummary;
  settings: TripSettings;
  totalStops: number;
}

export function JournalCompletionCard({ journal, summary, settings, totalStops }: JournalCompletionCardProps) {
  return (
    <div className="rounded-xl border-2 border-green-200 bg-gradient-to-r from-green-50 to-white p-6 text-center">
      <div className="text-4xl mb-3">🎉</div>
      <h3 className="text-xl font-bold text-green-900 mb-2">Trip Complete!</h3>
      <p className="text-sm text-green-700 mb-4">
        You visited all {totalStops} stops and captured {journal.stats.photosCount} memories.
      </p>
      <div className="flex justify-center gap-3">
        <button
          onClick={() => exportJournalAsHTML(journal, summary)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
        >
          Export Journal
        </button>
        <button
          onClick={() => exportJournalAsTemplate(journal, summary, settings)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          Share as Template
        </button>
      </div>
    </div>
  );
}
