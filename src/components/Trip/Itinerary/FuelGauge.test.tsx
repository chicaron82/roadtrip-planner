/**
 * FuelGauge.test.tsx
 *
 * Tests the segmented tank indicator:
 * - Segment counts
 * - Color logic (green/amber/red)
 * - Label logic (Required / Meal / Top-up / Default)
 * - Percentage text
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { FuelGauge } from './FuelGauge';

describe('FuelGauge', () => {
  it('renders the percentage and default label', () => {
    const { getByText } = render(<FuelGauge tankPercent={75} priority="recommended" />);
    // Use precise string match to avoid regex overlap (e.g. 0 matching in 100)
    expect(getByText('75% · FUEL STOP')).toBeDefined();
  });

  it('renders REQUIRED STOP label for required priority', () => {
    const { getByText } = render(<FuelGauge tankPercent={15} priority="required" />);
    expect(getByText(/15% · REQUIRED STOP/)).toBeDefined();
  });

  it('renders FUEL + MEAL label when comboMeal is true', () => {
    const { getByText } = render(<FuelGauge tankPercent={40} priority="recommended" comboMeal={true} />);
    expect(getByText(/40% · FUEL \+ MEAL/)).toBeDefined();
  });

  it('renders TOP-UP COMFORT label for topup fillType', () => {
    const { getByText } = render(<FuelGauge tankPercent={60} priority="recommended" fillType="topup" />);
    expect(getByText(/60% · TOP-UP COMFORT/)).toBeDefined();
  });

  it('uses green color for > 50%', () => {
    const { container } = render(<FuelGauge tankPercent={51} priority="recommended" />);
    const textSpan = container.querySelector('span[style*="color: rgb(34, 197, 94)"]');
    expect(textSpan).not.toBeNull();
  });

  it('uses amber color for 26-50%', () => {
    const { container } = render(<FuelGauge tankPercent={40} priority="recommended" />);
    const textSpan = container.querySelector('span[style*="color: rgb(245, 158, 11)"]');
    expect(textSpan).not.toBeNull();
  });

  it('uses red color for <= 25%', () => {
    const { container } = render(<FuelGauge tankPercent={25} priority="recommended" />);
    const textSpan = container.querySelector('span[style*="color: rgb(239, 68, 68)"]');
    expect(textSpan).not.toBeNull();
  });

  it('limits percentage to 0-100 range', () => {
    const { getByText: getByText100 } = render(<FuelGauge tankPercent={150} priority="recommended" />);
    expect(getByText100('100% · FUEL STOP')).toBeDefined();

    const { getByText: getByText0 } = render(<FuelGauge tankPercent={-20} priority="recommended" />);
    expect(getByText0('0% · FUEL STOP')).toBeDefined();
  });
});
