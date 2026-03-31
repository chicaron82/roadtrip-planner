import { useState, useEffect, useCallback } from 'react';
import type { TripSummary, TripSettings, Vehicle, TripJournal, TripOrigin } from '../../types';
import {
  createJournal,
  updateJournal,
  getActiveJournal,
  setActiveJournalId,
} from '../../lib/journal-storage';
import { clearActiveSession } from '../../lib/storage';

export type ViewMode = 'plan' | 'journal';

/** Returns true when every real (non-guard) stop has been visited. */
function checkJournalComplete(journal: TripJournal): boolean {
  const realSegmentIndices = new Set(
    journal.tripSummary.segments
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => !s.to.id?.startsWith('guard-'))
      .map(({ i }) => i),
  );
  if (realSegmentIndices.size === 0) return false;
  const stopsVisited = journal.entries.filter(
    e => realSegmentIndices.has(e.segmentIndex) && e.status === 'visited',
  ).length;
  return stopsVisited >= realSegmentIndices.size;
}

interface UseJournalOptions {
  summary: TripSummary | null;
  settings: TripSettings;
  vehicle: Vehicle;
  /** Pre-computed origin to attach to new journals (e.g. challenge or template fork) */
  origin?: TripOrigin | null;
  /** Default title hint — shown pre-filled in the name input */
  defaultTitle?: string;
}

interface UseJournalReturn {
  // State
  activeJournal: TripJournal | null;
  viewMode: ViewMode;
  isLoading: boolean;
  error: string | null;
  isJournalComplete: boolean;
  /** True when complete but overlay not yet dismissed — drives TripViewer overlay. */
  showCompleteOverlay: boolean;
  journalSkipped: boolean;

  // Actions
  startJournal: (title?: string) => Promise<void>;
  skipJournal: () => void;
  updateActiveJournal: (journal: TripJournal) => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
  clearJournal: () => void;
  confirmComplete: () => void;
  clearError: () => void;
  /** Seal the journal as a read-only souvenir. Sets finalized + finalizedAt + actualEnd. */
  finalizeJournal: () => Promise<void>;
}

export function useJournal({
  summary,
  settings,
  vehicle,
  origin,
  defaultTitle,
}: UseJournalOptions): UseJournalReturn {
  const [activeJournal, setActiveJournal] = useState<TripJournal | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('plan');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isJournalComplete, setIsJournalComplete] = useState(false);
  const [completionAcknowledged, setCompletionAcknowledged] = useState(false);
  const [journalSkipped, setJournalSkipped] = useState(false);

  // Load active journal on mount — but only if it's in-progress (not complete).
  // A completed journal means the trip is done; the next journey should start
  // fresh through the wizard. In-progress journals (partial visits) are restored
  // so the user can pick up mid-trip after a page reload.
  useEffect(() => {
    const loadActiveJournal = async () => {
      try {
        const journal = await getActiveJournal();
        if (!journal) return;

        const realSegmentIndices = new Set(
          journal.tripSummary.segments
            .map((s, i) => ({ s, i }))
            .filter(({ s }) => !s.to.id?.startsWith('guard-'))
            .map(({ i }) => i),
        );
        const totalRealStops = realSegmentIndices.size;
        const stopsVisited = journal.entries.filter(
          e => realSegmentIndices.has(e.segmentIndex) && e.status === 'visited',
        ).length;

        if (totalRealStops > 0 && stopsVisited >= totalRealStops) {
          // Trip complete — load the journal so the completion confirmation UI
          // can appear. The user explicitly confirms before we clear state.
          setActiveJournal(journal);
          setIsJournalComplete(true);
          return;
        }

        setActiveJournal(journal);
        setViewMode('journal');
      } catch (err) {
        console.error('Failed to load active journal:', err);
      }
    };
    loadActiveJournal();
  }, []);

  const startJournal = useCallback(async (title?: string) => {
    if (!summary) {
      setError('Cannot start journal without a trip summary');
      return;
    }

    // Set loading first — blocks the auto-start effect from firing a second time
    // while this async operation is in flight.
    setIsLoading(true);
    setError(null);

    // Clear any previously completed journal so this run starts fresh.
    // The completed journal remains archived in IndexedDB; only the active
    // pointer and React state are cleared here.
    setActiveJournal(null);
    setIsJournalComplete(false);
    setCompletionAcknowledged(false);
    setActiveJournalId(null);

    try {
      const resolvedTitle = title || defaultTitle || undefined;
      const journal = await createJournal(
        summary,
        settings,
        vehicle,
        resolvedTitle,
        origin ?? undefined,
      );
      setActiveJournal(journal);
      setActiveJournalId(journal.id);
      setViewMode('journal');
    } catch (err) {
      console.error('Failed to create journal:', err);
      setError('Failed to start journal. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [summary, settings, vehicle, origin, defaultTitle]);

  const updateActiveJournal = useCallback(async (updatedJournal: TripJournal) => {
    try {
      const saved = await updateJournal(updatedJournal);
      setActiveJournal(saved);
    } catch (err) {
      console.error('Failed to update journal:', err);
      setError('Failed to save journal changes.');
    }
  }, []);

  // Detect completion mid-journey (e.g. user marks the last stop as visited).
  useEffect(() => {
    if (!activeJournal || isJournalComplete) return;
    if (checkJournalComplete(activeJournal)) {
      setIsJournalComplete(true);
    }
  }, [activeJournal, isJournalComplete]);

  const finalizeJournal = useCallback(async () => {
    if (!activeJournal) return;
    // Derive actualEnd from the last visited entry's arrival timestamp
    const visitedEntries = activeJournal.entries
      .filter(e => e.status === 'visited' && e.actualArrival)
      .sort((a, b) => new Date(b.actualArrival!).getTime() - new Date(a.actualArrival!).getTime());
    const lastArrival = visitedEntries[0]?.actualArrival;
    const now = new Date();
    const actualEnd = lastArrival
      ? new Date(lastArrival).toISOString().slice(0, 10)
      : now.toISOString().slice(0, 10);

    const finalized: TripJournal = {
      ...activeJournal,
      finalized: true,
      finalizedAt: now,
      metadata: {
        ...activeJournal.metadata,
        dates: { ...activeJournal.metadata.dates, actualEnd },
      },
      updatedAt: now,
    };
    try {
      const saved = await updateJournal(finalized);
      setActiveJournal(saved);
      setIsJournalComplete(true);
      clearActiveSession(); // trip is done — don't restore this session on next page load
    } catch (err) {
      console.error('Failed to finalize journal:', err);
      setError('Failed to save journal. Please try again.');
    }
  }, [activeJournal]);

  const skipJournal = useCallback(() => {
    setJournalSkipped(true);
  }, []);

  const clearJournal = useCallback(() => {
    setActiveJournal(null);
    setViewMode('plan');
    setIsJournalComplete(false);
    setCompletionAcknowledged(false);
    setJournalSkipped(false);
    setActiveJournalId(null); // persist the clear — prevents stale journal reloading on next page load
  }, []);

  /** User explicitly confirms the trip is done — dismisses the overlay but keeps
   *  the journal alive so TripRecapCard (print, export) remains accessible. */
  const confirmComplete = useCallback(() => {
    setCompletionAcknowledged(true);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    activeJournal,
    viewMode,
    isLoading,
    error,
    isJournalComplete,
    showCompleteOverlay: isJournalComplete && !completionAcknowledged,
    journalSkipped,
    startJournal,
    skipJournal,
    updateActiveJournal,
    setViewMode,
    clearJournal,
    confirmComplete,
    clearError,
    finalizeJournal,
  };
}
