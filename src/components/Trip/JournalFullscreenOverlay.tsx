import { ArrowLeft } from 'lucide-react';
import { Button } from '../UI/Button';
import { JournalTimeline } from './JournalTimeline';
import type { TripSummary, TripSettings, TripJournal } from '../../types';

interface Props {
  summary: TripSummary;
  settings: TripSettings;
  journal: TripJournal;
  onUpdateJournal: (journal: TripJournal) => void;
  onClose: () => void;
}

export function JournalFullscreenOverlay({ summary, settings, journal, onUpdateJournal, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 border-b shrink-0"
        style={{ height: '52px', minHeight: '52px' }}
      >
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <span className="text-sm font-semibold truncate flex-1">
          {journal.metadata.title || 'Journal'}
        </span>
      </div>
      {/* Scrollable journal body */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4">
          <JournalTimeline
            summary={summary}
            settings={settings}
            journal={journal}
            onUpdateJournal={onUpdateJournal}
          />
        </div>
      </div>
    </div>
  );
}
