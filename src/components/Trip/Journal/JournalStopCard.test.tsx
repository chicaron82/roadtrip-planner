import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { JournalEntry, RouteSegment } from '../../../types';
import { JournalStopCard } from './JournalStopCard';

const BASE_SEGMENT: RouteSegment = {
  from: { id: 'from', name: 'Winnipeg', lat: 49.895, lng: -97.138, type: 'origin' },
  to: { id: 'to', name: 'Thunder Bay', lat: 48.382, lng: -89.246, type: 'destination' },
  distanceKm: 700,
  durationMinutes: 480,
  fuelNeededLitres: 63,
  fuelCost: 97,
  arrivalTime: '2026-08-01T20:00:00.000Z',
  timezone: 'America/Toronto',
};

const VISITED_ENTRY: JournalEntry = {
  id: 'entry-1',
  stopId: 'to',
  segmentIndex: 0,
  photos: [],
  notes: '',
  status: 'visited',
  isHighlight: false,
  createdAt: new Date('2026-08-01T20:00:00.000Z'),
  updatedAt: new Date('2026-08-01T20:00:00.000Z'),
  actualArrival: new Date('2026-08-01T20:30:00.000Z'),
};

describe('JournalStopCard', () => {
  it('formats planned and actual times in the stop timezone', () => {
    render(
      <JournalStopCard
        segment={BASE_SEGMENT}
        segmentIndex={0}
        entry={VISITED_ENTRY}
        onUpdateEntry={vi.fn()}
        onAddPhoto={vi.fn()}
        onRemovePhoto={vi.fn()}
      />,
    );

    expect(screen.getByText(/Plan: 4:00 PM/i)).toBeInTheDocument();
    expect(screen.getByText(/Actual: 4:30 PM/i)).toBeInTheDocument();
  });
});
