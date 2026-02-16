import { useState, useEffect, useCallback } from 'react';
import type { TripSummary, TripSettings, Vehicle, TripJournal } from '../types';
import {
  createJournal,
  updateJournal,
  getActiveJournal,
  setActiveJournalId,
} from '../lib/journal-storage';

export type ViewMode = 'plan' | 'journal';

interface UseJournalOptions {
  summary: TripSummary | null;
  settings: TripSettings;
  vehicle: Vehicle;
}

interface UseJournalReturn {
  // State
  activeJournal: TripJournal | null;
  viewMode: ViewMode;
  isLoading: boolean;
  error: string | null;

  // Actions
  startJournal: () => Promise<void>;
  updateActiveJournal: (journal: TripJournal) => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
  clearJournal: () => void;
}

export function useJournal({
  summary,
  settings,
  vehicle,
}: UseJournalOptions): UseJournalReturn {
  const [activeJournal, setActiveJournal] = useState<TripJournal | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('plan');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load active journal on mount
  useEffect(() => {
    const loadActiveJournal = async () => {
      try {
        const journal = await getActiveJournal();
        if (journal) {
          setActiveJournal(journal);
        }
      } catch (err) {
        console.error('Failed to load active journal:', err);
      }
    };
    loadActiveJournal();
  }, []);

  const startJournal = useCallback(async () => {
    if (!summary) {
      setError('Cannot start journal without a trip summary');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const journal = await createJournal(summary, settings, vehicle);
      setActiveJournal(journal);
      setActiveJournalId(journal.id);
      setViewMode('journal');
    } catch (err) {
      console.error('Failed to create journal:', err);
      setError('Failed to start journal. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [summary, settings, vehicle]);

  const updateActiveJournal = useCallback(async (updatedJournal: TripJournal) => {
    try {
      const saved = await updateJournal(updatedJournal);
      setActiveJournal(saved);
    } catch (err) {
      console.error('Failed to update journal:', err);
      setError('Failed to save journal changes.');
    }
  }, []);

  const clearJournal = useCallback(() => {
    setActiveJournal(null);
    setViewMode('plan');
  }, []);

  return {
    activeJournal,
    viewMode,
    isLoading,
    error,
    startJournal,
    updateActiveJournal,
    setViewMode,
    clearJournal,
  };
}
