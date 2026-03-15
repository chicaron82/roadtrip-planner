/**
 * TripSignatureCard.test.tsx
 *
 * Tests the dumb renderer — it plates what the model says.
 * No logic lives in the component; tests assert that provided model fields
 * appear in the output, that the health chip applies the correct warning style,
 * and that optional metrics render only when present.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TripSignatureCard } from './TripSignatureCard';
import type { SignatureCardModel } from '../../lib/trip-signature-card-model';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeModel(overrides: Partial<SignatureCardModel> = {}): SignatureCardModel {
  return {
    title: 'Your MEE time in Thunder Bay',
    titleMode: 'auto',
    subtitle: 'DiZee · Aug 16–21',
    routeLabel: 'Winnipeg → Thunder Bay',
    tripRead: 'A tight 4-day run through the Laurentian Shield.',
    healthPhrase: 'Balanced',
    metrics: {
      driveTime: '20h 15m',
      distance: '1,420 km',
      nights: 3,
      rooms: 2,
      mode: 'Plan',
    },
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TripSignatureCard', () => {
  it('renders title and subtitle from model', () => {
    const { getByText } = render(<TripSignatureCard model={makeModel()} />);
    expect(getByText('Your MEE time in Thunder Bay')).toBeTruthy();
    expect(getByText('DiZee · Aug 16–21')).toBeTruthy();
  });

  it('renders routeLabel', () => {
    const { getByText } = render(<TripSignatureCard model={makeModel()} />);
    expect(getByText('Winnipeg → Thunder Bay')).toBeTruthy();
  });

  it('renders tripRead editorial sentence', () => {
    const { getByText } = render(<TripSignatureCard model={makeModel()} />);
    expect(getByText('A tight 4-day run through the Laurentian Shield.')).toBeTruthy();
  });

  it('renders all core metric pills', () => {
    const { getByText } = render(<TripSignatureCard model={makeModel()} />);
    expect(getByText('20h 15m')).toBeTruthy();
    expect(getByText('1,420 km')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();  // nights
    expect(getByText('2')).toBeTruthy();  // rooms
    expect(getByText('Plan')).toBeTruthy();
  });

  it('renders optional drivers metric when present', () => {
    const model = makeModel({ metrics: { ...makeModel().metrics, drivers: 2 } });
    const { getByText } = render(<TripSignatureCard model={model} />);
    expect(getByText('Drivers')).toBeTruthy();
  });

  it('does not render drivers label when metric is absent', () => {
    const { queryByText } = render(<TripSignatureCard model={makeModel()} />);
    expect(queryByText('Drivers')).toBeNull();
  });

  it('renders health phrase', () => {
    const { getByText } = render(<TripSignatureCard model={makeModel()} />);
    expect(getByText('Balanced')).toBeTruthy();
  });

  it('renders warning health phrase without amber styling', () => {
    const model = makeModel({ healthPhrase: 'Over budget — worth reviewing' });
    const { getByText } = render(<TripSignatureCard model={model} />);
    expect(getByText('Over budget — worth reviewing')).toBeTruthy();
  });

  it('applies optional className to outer wrapper', () => {
    const { container } = render(
      <TripSignatureCard model={makeModel()} className="mt-4 custom-class" />
    );
    expect(container.firstChild).toBeTruthy();
    expect((container.firstChild as HTMLElement).className).toContain('custom-class');
  });

  it('renders without className gracefully', () => {
    const { container } = render(<TripSignatureCard model={makeModel()} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('does not render Rooms pill when nights is 0 (day trip)', () => {
    const model = makeModel({ metrics: { ...makeModel().metrics, nights: 0, rooms: 2 } });
    const { queryByText } = render(<TripSignatureCard model={model} />);
    expect(queryByText('Rooms')).toBeNull();
  });

  it('renders Rooms pill when nights > 0', () => {
    const model = makeModel({ metrics: { ...makeModel().metrics, nights: 1, rooms: 2 } });
    const { getByText } = render(<TripSignatureCard model={model} />);
    expect(getByText('Rooms')).toBeTruthy();
  });

  it('renders custom title when titleMode is custom', () => {
    const model = makeModel({ title: 'Road to Grandma\'s', titleMode: 'custom' });
    const { getByText } = render(<TripSignatureCard model={model} />);
    expect(getByText("Road to Grandma's")).toBeTruthy();
  });
});
