import type {
  TripJournal,
  JournalEntry,
  BudgetActual,
  QuickCapture,
  JournalDayMeta,
} from '../../types';
import { getJournal, updateJournal } from './crud';

/**
 * Add or update a journal entry
 */
export async function upsertJournalEntry(
  journalId: string,
  entry: JournalEntry
): Promise<TripJournal> {
  const journal = await getJournal(journalId);
  if (!journal) throw new Error(`Journal ${journalId} not found`);

  const existingIndex = journal.entries.findIndex(e => e.id === entry.id);
  if (existingIndex >= 0) {
    journal.entries[existingIndex] = { ...entry, updatedAt: new Date() };
  } else {
    journal.entries.push({ ...entry, createdAt: new Date(), updatedAt: new Date() });
  }

  return updateJournal(journal);
}

/**
 * Add a quick capture
 */
export async function addQuickCapture(
  journalId: string,
  capture: QuickCapture
): Promise<TripJournal> {
  const journal = await getJournal(journalId);
  if (!journal) throw new Error(`Journal ${journalId} not found`);

  journal.quickCaptures.push(capture);
  return updateJournal(journal);
}

/**
 * Add a budget actual entry
 */
export async function addBudgetActual(
  journalId: string,
  actual: BudgetActual
): Promise<TripJournal> {
  const journal = await getJournal(journalId);
  if (!journal) throw new Error(`Journal ${journalId} not found`);

  journal.budgetActuals.push(actual);
  return updateJournal(journal);
}

/**
 * Update day metadata (title, mood)
 */
export async function updateDayMeta(
  journalId: string,
  dayMeta: JournalDayMeta
): Promise<TripJournal> {
  const journal = await getJournal(journalId);
  if (!journal) throw new Error(`Journal ${journalId} not found`);

  const existingIndex = journal.dayMeta.findIndex(d => d.dayNumber === dayMeta.dayNumber);
  if (existingIndex >= 0) {
    journal.dayMeta[existingIndex] = dayMeta;
  } else {
    journal.dayMeta.push(dayMeta);
  }

  return updateJournal(journal);
}
