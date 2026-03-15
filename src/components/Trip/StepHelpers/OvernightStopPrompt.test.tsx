/**
 * OvernightStopPrompt.test.tsx
 *
 * Tests:
 * - Location name rendering
 * - Hours and distance display
 * - Arrival and departure times
 * - Room calculation logic (ceil(travelers / 2), with "family suite" copy)
 * - Suggested city appears in benefits list
 * - onAccept / onDecline callback wiring
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { OvernightStopPrompt } from './OvernightStopPrompt';
import type { Location } from '../../../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLocation(name = 'Dryden, ON'): Location {
  return { id: 'loc-dryden', name, lat: 49.78, lng: -92.83, type: 'waypoint' };
}

interface SetupOptions {
  numTravelers?: number;
  hoursBeforeStop?: number;
  distanceBeforeStop?: number;
  arrivalTime?: string;
  departureTime?: string;
  locationName?: string;
  onAccept?: ReturnType<typeof vi.fn>;
  onDecline?: ReturnType<typeof vi.fn>;
}

function setup(opts: SetupOptions = {}) {
  const onAccept = (opts.onAccept ?? vi.fn()) as () => void;
  const onDecline = (opts.onDecline ?? vi.fn()) as () => void;
  const result = render(
    <OvernightStopPrompt
      suggestedLocation={makeLocation(opts.locationName ?? 'Dryden, ON')}
      hoursBeforeStop={opts.hoursBeforeStop ?? 6.5}
      distanceBeforeStop={opts.distanceBeforeStop ?? 380}
      numTravelers={opts.numTravelers ?? 2}
      arrivalTime={opts.arrivalTime ?? '8:30 PM'}
      departureTime={opts.departureTime ?? '8:00 AM'}
      onAccept={onAccept}
      onDecline={onDecline}
    />
  );
  return { ...result, onAccept, onDecline };
}

// ── Tests: content rendering ──────────────────────────────────────────────────

describe('OvernightStopPrompt — content', () => {
  it('renders the suggested location name', () => {
    const { getByText } = setup({ locationName: 'Thunder Bay, ON' });
    expect(getByText('Thunder Bay, ON')).toBeTruthy();
  });

  it('renders hours before stop', () => {
    const { getByText } = setup({ hoursBeforeStop: 7.5 });
    expect(getByText(/7\.5 hours/i)).toBeTruthy();
  });

  it('renders distance before stop', () => {
    const { getByText } = setup({ distanceBeforeStop: 440 });
    expect(getByText(/440 km/i)).toBeTruthy();
  });

  it('renders arrival time', () => {
    const { getByText } = setup({ arrivalTime: '9:15 PM' });
    expect(getByText(/Arrive 9:15 PM/i)).toBeTruthy();
  });

  it('renders departure time', () => {
    const { getByText } = setup({ departureTime: '7:30 AM' });
    expect(getByText(/Depart 7:30 AM/i)).toBeTruthy();
  });

  it('shows city name in benefits list (first segment of location name)', () => {
    const { getAllByText } = setup({ locationName: 'Sault Ste. Marie, ON' });
    // City appears both in the stop detail and in the benefits bullet
    const matches = getAllByText(/Sault Ste\. Marie/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // The benefits bullet uses only the city portion (split by ',')
    const benefitBullet = matches.find((el) => el.tagName === 'LI');
    expect(benefitBullet?.textContent).toContain('Sault Ste. Marie');
  });
});

// ── Tests: room calculation ───────────────────────────────────────────────────

describe('OvernightStopPrompt — room calculation', () => {
  it('shows 1 room for 1 traveler', () => {
    const { getByText } = setup({ numTravelers: 1 });
    expect(getByText(/1 room/i)).toBeTruthy();
  });

  it('shows 1 room for 2 travelers', () => {
    const { getByText } = setup({ numTravelers: 2 });
    expect(getByText(/1 room/i)).toBeTruthy();
  });

  it('shows "2 rooms or family suite" for 3 travelers (<= 4)', () => {
    const { getByText } = setup({ numTravelers: 3 });
    expect(getByText(/2 rooms or family suite/i)).toBeTruthy();
  });

  it('shows "2 rooms or family suite" for 4 travelers', () => {
    const { getByText } = setup({ numTravelers: 4 });
    expect(getByText(/2 rooms or family suite/i)).toBeTruthy();
  });

  it('shows plain room count (no "family suite") for 5+ travelers', () => {
    const { getByText, queryByText } = setup({ numTravelers: 5 });
    expect(getByText(/3 rooms/i)).toBeTruthy();
    expect(queryByText(/family suite/i)).toBeNull();
  });

  it('shows correct room count for 6 travelers (ceil(6/2) = 3)', () => {
    const { getByText } = setup({ numTravelers: 6 });
    expect(getByText(/3 rooms/i)).toBeTruthy();
  });

  it('shows singular "traveler" for 1 traveler', () => {
    const { getByText } = setup({ numTravelers: 1 });
    expect(getByText(/1 traveler/i)).toBeTruthy();
  });

  it('shows plural "travelers" for 2+ travelers', () => {
    const { getByText } = setup({ numTravelers: 3 });
    expect(getByText(/3 travelers/i)).toBeTruthy();
  });
});

// ── Tests: callbacks ──────────────────────────────────────────────────────────

describe('OvernightStopPrompt — callbacks', () => {
  it('calls onAccept when Add Hotel Stop is clicked', () => {
    const { getByText, onAccept } = setup();
    fireEvent.click(getByText('Add Hotel Stop'));
    expect(onAccept).toHaveBeenCalledOnce();
  });

  it('calls onDecline when Keep Single Day is clicked', () => {
    const { getByText, onDecline } = setup();
    fireEvent.click(getByText('Keep Single Day'));
    expect(onDecline).toHaveBeenCalledOnce();
  });

  it('does not call onDecline when Add Hotel Stop is clicked', () => {
    const { getByText, onDecline } = setup();
    fireEvent.click(getByText('Add Hotel Stop'));
    expect(onDecline).not.toHaveBeenCalled();
  });

  it('does not call onAccept when Keep Single Day is clicked', () => {
    const { getByText, onAccept } = setup();
    fireEvent.click(getByText('Keep Single Day'));
    expect(onAccept).not.toHaveBeenCalled();
  });
});
