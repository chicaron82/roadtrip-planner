import { useEffect } from 'react';
import type { Location, TripSettings, TripSummary } from '../../types';
import { buildSeededTitle } from '../../lib/trip-title-seeds';

interface Options {
  tripConfirmed: boolean;
  summary: TripSummary | null;
  showVoila: boolean;
  activeJournal: unknown;
  isJournalComplete: boolean;
  journalSkipped: boolean;
  isJournalLoading: boolean;
  startJournal: (title?: string) => Promise<void>;
  dismissVoilaCurtain: () => void;
  customTitle: string | null;
  locations: Location[];
  settings: TripSettings;
}

/**
 * Fires once after lock-in to create the trip journal.
 *
 * Guards (in order): needs confirmed trip + summary, trip not already
 * done, user not opted out, no in-progress journal, creation not in
 * flight. Delay is 0ms when Voilà curtain is still up (journal creates
 * behind it), 700ms otherwise to let StepsBanner's morph play first.
 */
export function useJournalAutoStart({
  tripConfirmed, summary, showVoila,
  activeJournal, isJournalComplete, journalSkipped, isJournalLoading,
  startJournal, dismissVoilaCurtain,
  customTitle, locations, settings,
}: Options): void {
  useEffect(() => {
    if (!tripConfirmed || !summary) return;
    if (isJournalComplete) return;
    if (journalSkipped) { dismissVoilaCurtain(); return; }
    if (activeJournal) return;
    if (isJournalLoading) return;

    const dest = locations.find(l => l.type === 'destination')?.name?.split(',')[0].trim() ?? '';
    const title = customTitle || (dest ? buildSeededTitle({
      destination: dest,
      days: summary.drivingDays,
      travelerCount: settings.numTravelers ?? 1,
    }) : undefined);

    const delay = showVoila ? 0 : 700;
    const t = setTimeout(async () => {
      await startJournal(title ?? undefined);
      dismissVoilaCurtain();
    }, delay);
    return () => clearTimeout(t);
  }, [
    tripConfirmed, showVoila, activeJournal, isJournalComplete,
    journalSkipped, isJournalLoading, summary, startJournal,
    dismissVoilaCurtain, customTitle, locations, settings.numTravelers,
  ]);
}
