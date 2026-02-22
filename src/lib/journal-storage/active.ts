import type { TripJournal } from '../../types';
import { getJournal } from './crud';

const ACTIVE_JOURNAL_KEY = 'active-journal-id';

/**
 * Set the currently active journal (for the ongoing trip)
 */
export function setActiveJournalId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_JOURNAL_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_JOURNAL_KEY);
  }
}

/**
 * Get the currently active journal ID
 */
export function getActiveJournalId(): string | null {
  return localStorage.getItem(ACTIVE_JOURNAL_KEY);
}

/**
 * Get the active journal (if any)
 */
export async function getActiveJournal(): Promise<TripJournal | null> {
  const id = getActiveJournalId();
  if (!id) return null;
  return getJournal(id);
}
