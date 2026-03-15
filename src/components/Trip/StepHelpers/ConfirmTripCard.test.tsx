/**
 * ConfirmTripCard.test.tsx
 *
 * Tests:
 * - Unconfirmed state: stats, subline copy (mode-voice), confirm button
 * - Confirmed state: green confirmed UI, Modify Plan + Open Journal buttons
 * - Mode-voice wiring: adventure vs plan subline
 * - Callback wiring: onConfirm, onUnconfirm, onGoToJournal
 * - Edge cases: no journal callback, zero added stops
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { ConfirmTripCard } from './ConfirmTripCard';

// ── Helpers ───────────────────────────────────────────────────────────────────

interface SetupOptions {
  confirmed?: boolean;
  addedStopCount?: number;
  totalDays?: number;
  tripMode?: 'plan' | 'adventure' | 'estimate';
  onConfirm?: ReturnType<typeof vi.fn>;
  onUnconfirm?: ReturnType<typeof vi.fn>;
  onGoToJournal?: ReturnType<typeof vi.fn>;
}

function setup(opts: SetupOptions = {}) {
  const onConfirm = (opts.onConfirm ?? vi.fn()) as () => void;
  const onUnconfirm = (opts.onUnconfirm ?? vi.fn()) as () => void;
  const onGoToJournal = opts.onGoToJournal as (() => void) | undefined;

  const result = render(
    <ConfirmTripCard
      confirmed={opts.confirmed ?? false}
      addedStopCount={opts.addedStopCount ?? 0}
      totalDays={opts.totalDays ?? 3}
      tripMode={opts.tripMode ?? 'plan'}
      onConfirm={onConfirm}
      onUnconfirm={onUnconfirm}
      onGoToJournal={onGoToJournal}
    />
  );
  return { ...result, onConfirm, onUnconfirm };
}

// ── Tests: unconfirmed state ──────────────────────────────────────────────────

describe('ConfirmTripCard — unconfirmed', () => {
  it('shows day count', () => {
    const { getByText } = setup({ totalDays: 5 });
    expect(getByText(/5 days/i)).toBeTruthy();
  });

  it('shows singular "day" for 1 day', () => {
    const { getByText } = setup({ totalDays: 1 });
    expect(getByText(/1 day/i)).toBeTruthy();
    expect(() => getByText(/1 days/i)).toThrow();
  });

  it('shows added stop count when > 0', () => {
    const { getByText } = setup({ addedStopCount: 3 });
    expect(getByText(/3 stops added/i)).toBeTruthy();
  });

  it('does not show stop count when 0', () => {
    const { queryByText } = setup({ addedStopCount: 0 });
    expect(queryByText(/stops added/i)).toBeNull();
  });

  it('shows "1 stop added" (singular) for exactly 1 stop', () => {
    const { getByText } = setup({ addedStopCount: 1 });
    expect(getByText(/1 stop added/i)).toBeTruthy();
  });

  it('renders Confirm Trip button', () => {
    const { getByText } = setup();
    expect(getByText('Confirm Trip')).toBeTruthy();
  });

  it('calls onConfirm when button is clicked', () => {
    const { getByText, onConfirm } = setup();
    fireEvent.click(getByText('Confirm Trip'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('shows plan-mode subline for plan tripMode', () => {
    const { container } = setup({ tripMode: 'plan' });
    const subline = container.querySelector('.text-\\[11px\\]') ?? container;
    // Plan subline contains "MEE helped" (from buildConfirmSubline)
    expect(subline.textContent).toContain('MEE');
  });

  it('shows adventure-mode subline for adventure tripMode', () => {
    const { container } = setup({ tripMode: 'adventure' });
    const subline = container.querySelector('.text-\\[11px\\]') ?? container;
    expect(subline.textContent).toContain('MEE');
  });

  it('adventure subline differs from plan subline', () => {
    const { container: planContainer } = setup({ tripMode: 'plan' });
    const { container: adventureContainer } = setup({ tripMode: 'adventure' });
    const planText = planContainer.textContent ?? '';
    const adventureText = adventureContainer.textContent ?? '';
    expect(planText).not.toEqual(adventureText);
  });
});

// ── Tests: confirmed state ────────────────────────────────────────────────────

describe('ConfirmTripCard — confirmed', () => {
  it('shows "Trip Confirmed" heading', () => {
    const { getByText } = setup({ confirmed: true });
    expect(getByText('Trip Confirmed')).toBeTruthy();
  });

  it('shows Modify Plan button', () => {
    const { getByText } = setup({ confirmed: true });
    expect(getByText('Modify Plan')).toBeTruthy();
  });

  it('calls onUnconfirm when Modify Plan is clicked', () => {
    const onUnconfirm = vi.fn();
    const { getByText } = setup({ confirmed: true, onUnconfirm });
    fireEvent.click(getByText('Modify Plan'));
    expect(onUnconfirm).toHaveBeenCalledOnce();
  });

  it('shows Open Journal button when onGoToJournal is provided', () => {
    const { getByText } = setup({ confirmed: true, onGoToJournal: vi.fn() });
    expect(getByText('Open Journal')).toBeTruthy();
  });

  it('does not show Open Journal button when onGoToJournal absent', () => {
    const { queryByText } = setup({ confirmed: true });
    expect(queryByText('Open Journal')).toBeNull();
  });

  it('calls onGoToJournal when Open Journal is clicked', () => {
    const onGoToJournal = vi.fn();
    const { getByText } = setup({ confirmed: true, onGoToJournal });
    fireEvent.click(getByText('Open Journal'));
    expect(onGoToJournal).toHaveBeenCalledOnce();
  });

  it('does not show Confirm Trip button in confirmed state', () => {
    const { queryByText } = setup({ confirmed: true });
    expect(queryByText('Confirm Trip')).toBeNull();
  });
});

// ── Tests: confetti cleanup ───────────────────────────────────────────────────

describe('ConfirmTripCard — confetti timer', () => {
  it('does not throw during confirm → unconfirm cycle', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <ConfirmTripCard
        confirmed={false}
        addedStopCount={0}
        totalDays={2}
        onConfirm={vi.fn()}
        onUnconfirm={vi.fn()}
      />
    );
    // Trigger confirmed state (confetti timer starts)
    act(() => {
      rerender(
        <ConfirmTripCard
          confirmed={true}
          addedStopCount={0}
          totalDays={2}
          onConfirm={vi.fn()}
          onUnconfirm={vi.fn()}
        />
      );
    });
    // Advance past confetti duration without error
    act(() => { vi.advanceTimersByTime(1500); });
    vi.useRealTimers();
  });
});
