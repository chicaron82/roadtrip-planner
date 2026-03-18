import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrivacySection } from './PrivacySection';
import { getHistory, clearHistory } from '../../lib/storage';
import { clearUserProfile } from '../../lib/user-profile';

vi.mock('../../lib/storage', () => ({
  getHistory: vi.fn().mockReturnValue([]),
  clearHistory: vi.fn(),
}));

vi.mock('../../lib/user-profile', () => ({
  clearUserProfile: vi.fn(),
}));

const defaultProps = {
  includeStartingLocation: false,
  onIncludeStartingLocationChange: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getHistory).mockReturnValue([]);
  Object.defineProperty(window, 'location', {
    value: { reload: vi.fn() },
    writable: true,
    configurable: true,
  });
});

describe('PrivacySection', () => {
  it('renders without crashing', () => {
    render(<PrivacySection {...defaultProps} />);
    expect(screen.getByText('Trip history')).toBeInTheDocument();
    expect(screen.getByText('All app data')).toBeInTheDocument();
    expect(screen.getByText('Adaptive profile')).toBeInTheDocument();
  });

  it('shows correct trip history count from getHistory()', () => {
    vi.mocked(getHistory).mockReturnValue([{} as never, {} as never, {} as never]);
    render(<PrivacySection {...defaultProps} />);
    expect(screen.getByText('3 trips saved')).toBeInTheDocument();
  });

  it('shows "No trips saved" when history is empty', () => {
    vi.mocked(getHistory).mockReturnValue([]);
    render(<PrivacySection {...defaultProps} />);
    expect(screen.getByText('No trips saved')).toBeInTheDocument();
  });

  it('"Clear" button on trip history calls clearHistory()', () => {
    vi.mocked(getHistory).mockReturnValue([{} as never]);
    render(<PrivacySection {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /^clear$/i }));
    expect(clearHistory).toHaveBeenCalledOnce();
  });

  it('clear-all button shows "Clear all" on first render', () => {
    render(<PrivacySection {...defaultProps} />);
    expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument();
  });

  it('first click on clear-all shows "Confirm?" (two-tap gate)', () => {
    render(<PrivacySection {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
  });

  it('second click on clear-all calls localStorage.clear() and window.location.reload()', () => {
    render(<PrivacySection {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(window.localStorage.clear).toHaveBeenCalled();
    expect(window.location.reload).toHaveBeenCalled();
  });

  it('cancel link after first click resets back to "Clear all"', () => {
    render(<PrivacySection {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument();
  });

  it('"Reset" button calls clearUserProfile()', () => {
    render(<PrivacySection {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(clearUserProfile).toHaveBeenCalledOnce();
  });
});
