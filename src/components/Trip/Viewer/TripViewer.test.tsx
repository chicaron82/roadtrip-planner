/**
 * TripViewer.test.tsx
 *
 * Tests the UI logic TripViewer itself owns:
 * - Expand / collapse (itinerary mode)
 * - Heading switches: "Journal" vs "Itinerary" label
 * - "Write" button visible in journal mode with active journal
 * - "Expand" button visible in itinerary mode
 * - JournalCompleteOverlay shown when isJournalComplete + journal active
 * - JournalFullscreenOverlay shown when Write button is clicked
 *
 * Heavy children (TripTimelineView, JournalCompleteOverlay, JournalFullscreenOverlay)
 * are mocked to avoid deep render trees in these surface tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { TripViewer } from './TripViewer';
import { makeSettings, makeVehicle, makeSummary } from '../../../test/fixtures';
import type { TripViewerProps } from './viewer-types';
import type { TripJournal } from '../../../types';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../TripTimelineView', () => ({
  TripTimelineView: () => <div data-testid="timeline-view">Timeline</div>,
}));

vi.mock('../Journal/JournalCompleteOverlay', () => ({
  JournalCompleteOverlay: ({ onConfirm }: { onConfirm: () => void }) => (
    <div data-testid="journal-complete-overlay">
      <button onClick={onConfirm}>Confirm Complete</button>
    </div>
  ),
}));

vi.mock('../Journal/JournalFullscreenOverlay', () => ({
  JournalFullscreenOverlay: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="journal-fullscreen-overlay">
      <button onClick={onClose}>Close Fullscreen</button>
    </div>
  ),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeViewerSummary() {
  const base = makeSummary();
  return {
    segments: base.segments,
    fullGeometry: [],
    roundTripMidpoint: undefined,
    days: [],
    totalDistanceKm: base.totalDistanceKm,
    totalDurationMinutes: 360,
    totalFuelCost: 70,
  };
}

function makeJournal(overrides: Partial<TripJournal> = {}): TripJournal {
  return {
    id: 'j1',
    ...overrides,
  } as unknown as TripJournal;
}

function makeProps(overrides: Partial<TripViewerProps> = {}): TripViewerProps {
  return {
    summary: makeViewerSummary(),
    settings: makeSettings(),
    vehicle: makeVehicle(),
    viewMode: 'plan',
    activeJournal: null,
    tripMode: 'plan',
    poiSuggestions: [],
    isLoadingPOIs: false,
    onStartJournal: vi.fn(),
    onUpdateJournal: vi.fn(),
    onUpdateStopType: vi.fn(),
    onAddPOI: vi.fn(),
    onDismissPOI: vi.fn(),
    ...overrides,
  };
}

// ── Tests: heading label ──────────────────────────────────────────────────────

describe('TripViewer — heading label', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows "Itinerary" heading in itinerary mode', () => {
    render(<TripViewer {...makeProps({ viewMode: 'plan' })} />);
    expect(screen.getByText('Itinerary')).toBeTruthy();
  });

  it('shows "Journal" heading in journal mode', () => {
    render(<TripViewer {...makeProps({ viewMode: 'journal' })} />);
    expect(screen.getByText('Journal')).toBeTruthy();
  });
});

// ── Tests: expand / collapse ──────────────────────────────────────────────────

describe('TripViewer — expand / collapse', () => {
  it('shows Expand button in itinerary mode', () => {
    render(<TripViewer {...makeProps({ viewMode: 'plan' })} />);
    expect(screen.getByText('Expand')).toBeTruthy();
  });

  it('shows Collapse button after clicking Expand', () => {
    render(<TripViewer {...makeProps({ viewMode: 'plan' })} />);
    fireEvent.click(screen.getByText('Expand'));
    expect(screen.getByText('Collapse')).toBeTruthy();
  });

  it('returns to normal view after clicking Collapse', () => {
    render(<TripViewer {...makeProps({ viewMode: 'plan' })} />);
    fireEvent.click(screen.getByText('Expand'));
    fireEvent.click(screen.getByText('Collapse'));
    expect(screen.getByText('Expand')).toBeTruthy();
  });

  it('shows "Itinerary" h2 heading in expanded state', () => {
    render(<TripViewer {...makeProps({ viewMode: 'plan' })} />);
    fireEvent.click(screen.getByText('Expand'));
    // In expanded state there is an h2 heading
    const h2 = document.querySelector('h2');
    expect(h2?.textContent).toBe('Itinerary');
  });
});

// ── Tests: journal mode controls ──────────────────────────────────────────────

describe('TripViewer — journal mode', () => {
  it('shows Write button in journal mode when journal is active', () => {
    render(
      <TripViewer
        {...makeProps({ viewMode: 'journal', activeJournal: makeJournal() })}
      />
    );
    expect(screen.getByText('Write')).toBeTruthy();
  });

  it('does not show Write button in journal mode when journal is null', () => {
    render(
      <TripViewer {...makeProps({ viewMode: 'journal', activeJournal: null })} />
    );
    expect(screen.queryByText('Write')).toBeNull();
  });

  it('shows Expand button in journal mode when journal is null', () => {
    render(
      <TripViewer {...makeProps({ viewMode: 'journal', activeJournal: null })} />
    );
    expect(screen.getByText('Expand')).toBeTruthy();
  });

  it('opens fullscreen overlay when Write is clicked', () => {
    render(
      <TripViewer
        {...makeProps({ viewMode: 'journal', activeJournal: makeJournal() })}
      />
    );
    fireEvent.click(screen.getByText('Write'));
    expect(screen.getByTestId('journal-fullscreen-overlay')).toBeTruthy();
  });

  it('closes fullscreen overlay when overlay Close is clicked', () => {
    render(
      <TripViewer
        {...makeProps({ viewMode: 'journal', activeJournal: makeJournal() })}
      />
    );
    fireEvent.click(screen.getByText('Write'));
    fireEvent.click(screen.getByText('Close Fullscreen'));
    expect(screen.queryByTestId('journal-fullscreen-overlay')).toBeNull();
  });
});

// ── Tests: journal complete overlay ──────────────────────────────────────────

describe('TripViewer — journal complete overlay', () => {
  it('renders JournalCompleteOverlay when isJournalComplete + journal active', () => {
    const onConfirm = vi.fn();
    render(
      <TripViewer
        {...makeProps({
          viewMode: 'journal',
          activeJournal: makeJournal(),
          isJournalComplete: true,
          onConfirmJournalComplete: onConfirm,
        })}
      />
    );
    expect(screen.getByTestId('journal-complete-overlay')).toBeTruthy();
  });

  it('calls onConfirmJournalComplete when overlay confirm is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <TripViewer
        {...makeProps({
          viewMode: 'journal',
          activeJournal: makeJournal(),
          isJournalComplete: true,
          onConfirmJournalComplete: onConfirm,
        })}
      />
    );
    fireEvent.click(screen.getByText('Confirm Complete'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('does not show complete overlay in itinerary mode (even if complete flag set)', () => {
    render(
      <TripViewer
        {...makeProps({
          viewMode: 'plan',
          activeJournal: makeJournal(),
          isJournalComplete: true,
          onConfirmJournalComplete: vi.fn(),
        })}
      />
    );
    expect(screen.queryByTestId('journal-complete-overlay')).toBeNull();
  });

  it('does not show complete overlay when journal is null', () => {
    render(
      <TripViewer
        {...makeProps({
          viewMode: 'journal',
          activeJournal: null,
          isJournalComplete: true,
          onConfirmJournalComplete: vi.fn(),
        })}
      />
    );
    expect(screen.queryByTestId('journal-complete-overlay')).toBeNull();
  });
});
