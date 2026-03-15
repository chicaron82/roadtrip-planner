import { useState, useEffect } from 'react';
import type { TripJournal } from '../types';
import { getAllJournals } from '../lib/journal-storage';

interface UseJournalHistoryReturn {
  journals: TripJournal[];
  isLoading: boolean;
}

/**
 * Fetches all journals from IndexedDB on mount, sorted most-recent-first.
 * Read-only — for display in journal history panels.
 */
export function useJournalHistory(): UseJournalHistoryReturn {
  const [journals, setJournals] = useState<TripJournal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAllJournals()
      .then(all => { if (!cancelled) setJournals(all); })
      .catch(err => { console.error('Failed to load journal history:', err); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { journals, isLoading };
}
