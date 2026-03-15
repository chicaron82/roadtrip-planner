import { Share2, Printer } from 'lucide-react';
import type { TripPrintViewProps } from '../Trip/StepHelpers/TripPrintView';
import type { TimedEvent } from '../../lib/trip-timeline';
import type { TripMode, TripJournal } from '../../types';
import { Button } from '../UI/Button';
import { DifficultyBadge } from '../Trip/StepHelpers/DifficultyBadge';
import { printTrip } from '../Trip/StepHelpers/TripPrintView';
import { buildResultsFramingLine } from '../../lib/mode-voice';

interface Difficulty {
  color: string;
  emoji: string;
  level: string;
}

interface Step3HeaderProps {
  hasTrip: boolean;
  printInput?: TripPrintViewProps['printInput'];
  shareUrl: string | null;
  difficulty?: Difficulty | null;
  precomputedEvents?: TimedEvent[];
  isCalculating?: boolean;
  tripMode?: TripMode;
  journal?: TripJournal | null;
  onOpenGoogleMaps: () => void;
  onCopyShareLink: () => void;
}

export function Step3Header({
  hasTrip,
  printInput,
  shareUrl,
  difficulty,
  precomputedEvents,
  isCalculating,
  tripMode,
  journal,
  onOpenGoogleMaps,
  onCopyShareLink,
}: Step3HeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold">Your Trip</h2>
            {difficulty && <DifficultyBadge difficulty={difficulty} />}
          </div>
          <p className="text-sm text-muted-foreground">
            {buildResultsFramingLine(tripMode ?? 'plan')}
          </p>
        </div>
        <div className="flex gap-2">
          {hasTrip && (
            <Button size="sm" variant="outline" className="gap-1" onClick={onOpenGoogleMaps}>
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              Google Maps
            </Button>
          )}
          {shareUrl && (
            <Button size="sm" variant="outline" className="gap-1" onClick={onCopyShareLink}>
              <Share2 className="h-3 w-3" /> Share
            </Button>
          )}
          {printInput && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={isCalculating || !precomputedEvents?.length}
              onClick={() => printTrip({ printInput, precomputedEvents: precomputedEvents ?? [], journal: journal ?? undefined })}
            >
              <Printer className="h-3 w-3" /> Print
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}