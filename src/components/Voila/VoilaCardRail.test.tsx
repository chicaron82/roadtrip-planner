/**
 * VoilaCardRail — unit tests
 *
 * Focus: dot count matches gasStops config, card labels render correctly.
 * No DOM layout needed — RTL render + text/role queries.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VoilaCardRail } from './VoilaCardRail';
import { makeSummary, makeSettings } from '../../test/fixtures';

describe('VoilaCardRail', () => {
  const onOpenDetail = vi.fn();

  // ── Dot indicators ────────────────────────────────────────────────────────

  describe('dot count', () => {
    it('renders 3 dots when gasStops = 0 (no fuel-stop card)', () => {
      render(
        <VoilaCardRail
          summary={makeSummary({ gasStops: 0 })}
          settings={makeSettings()}
          onOpenDetail={onOpenDetail}
        />,
      );
      expect(screen.getAllByRole('button', { name: /Go to card/i })).toHaveLength(3);
    });

    it('renders 4 dots when gasStops > 0 (fuel-stop card present)', () => {
      render(
        <VoilaCardRail
          summary={makeSummary({ gasStops: 2 })}
          settings={makeSettings()}
          onOpenDetail={onOpenDetail}
        />,
      );
      expect(screen.getAllByRole('button', { name: /Go to card/i })).toHaveLength(4);
    });

    it('renders 4 dots when gasStops = 1', () => {
      render(
        <VoilaCardRail
          summary={makeSummary({ gasStops: 1 })}
          settings={makeSettings()}
          onOpenDetail={onOpenDetail}
        />,
      );
      expect(screen.getAllByRole('button', { name: /Go to card/i })).toHaveLength(4);
    });
  });

  // ── Budget card ───────────────────────────────────────────────────────────

  describe('Budget card', () => {
    it('shows "No estimate" when costBreakdown is absent', () => {
      render(
        <VoilaCardRail
          summary={makeSummary({ gasStops: 0, costBreakdown: undefined })}
          settings={makeSettings()}
          onOpenDetail={onOpenDetail}
        />,
      );
      expect(screen.getByText('No estimate')).toBeInTheDocument();
    });

    it('shows per-person cost for group trips in CAD', () => {
      render(
        <VoilaCardRail
          summary={makeSummary({
            gasStops: 0,
            costBreakdown: { fuel: 100, accommodation: 200, meals: 80, misc: 20, total: 400, perPerson: 100 },
          })}
          settings={makeSettings({ currency: 'CAD', numTravelers: 4 })}
          onOpenDetail={onOpenDetail}
        />,
      );
      expect(screen.getByText('C$100/person')).toBeInTheDocument();
    });

    it('shows total cost for solo traveler in USD', () => {
      render(
        <VoilaCardRail
          summary={makeSummary({
            gasStops: 0,
            costBreakdown: { fuel: 50, accommodation: 100, meals: 40, misc: 10, total: 200, perPerson: 200 },
          })}
          settings={makeSettings({ currency: 'USD', numTravelers: 1 })}
          onOpenDetail={onOpenDetail}
        />,
      );
      expect(screen.getByText('$200')).toBeInTheDocument();
    });
  });

  // ── Itinerary card ────────────────────────────────────────────────────────

  describe('Itinerary card', () => {
    it('shows singular "1 day planned"', () => {
      render(
        <VoilaCardRail
          summary={makeSummary({ gasStops: 0, drivingDays: 1 })}
          settings={makeSettings()}
          onOpenDetail={onOpenDetail}
        />,
      );
      expect(screen.getByText('1 day planned')).toBeInTheDocument();
    });

    it('shows plural "5 days planned"', () => {
      render(
        <VoilaCardRail
          summary={makeSummary({ gasStops: 0, drivingDays: 5 })}
          settings={makeSettings()}
          onOpenDetail={onOpenDetail}
        />,
      );
      expect(screen.getByText('5 days planned')).toBeInTheDocument();
    });
  });
});
