/**
 * source-tier-utils — unit tests
 *
 * Pure function — no DOM, no rendering.
 * Tests all TimedEventType branches and the overnight declared/inferred split.
 */

import { describe, it, expect } from 'vitest';
import { deriveEventSourceTier } from './source-tier-utils';
import type { TimedEvent } from './trip-timeline-types';
import type { RouteSegment } from '../types';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<TimedEvent>): TimedEvent {
  return {
    id: 'test-event',
    type: 'drive',
    arrivalTime: new Date(),
    departureTime: new Date(),
    durationMinutes: 60,
    distanceFromOriginKm: 100,
    locationHint: 'Test Location',
    stops: [],
    timezone: 'America/Winnipeg',
    ...overrides,
  };
}

function makeSegmentWithStopType(stopType: string): Partial<RouteSegment> {
  return { stopType: stopType as RouteSegment['stopType'] };
}

// ── structural events → null ──────────────────────────────────────────────────

describe('deriveEventSourceTier — structural events', () => {
  it('returns null for departure events', () => {
    expect(deriveEventSourceTier(makeEvent({ type: 'departure' }))).toBeNull();
  });

  it('returns null for drive events', () => {
    expect(deriveEventSourceTier(makeEvent({ type: 'drive' }))).toBeNull();
  });
});

// ── declared events ───────────────────────────────────────────────────────────

describe('deriveEventSourceTier — declared events', () => {
  it('returns "declared" for waypoint events', () => {
    expect(deriveEventSourceTier(makeEvent({ type: 'waypoint' }))).toBe('declared');
  });

  it('returns "declared" for arrival events', () => {
    expect(deriveEventSourceTier(makeEvent({ type: 'arrival' }))).toBe('declared');
  });

  it('returns "declared" for destination events', () => {
    expect(deriveEventSourceTier(makeEvent({ type: 'destination' }))).toBe('declared');
  });

  it('returns "declared" for overnight when segment.stopType is "overnight"', () => {
    const event = makeEvent({
      type: 'overnight',
      segment: makeSegmentWithStopType('overnight') as RouteSegment,
    });
    expect(deriveEventSourceTier(event)).toBe('declared');
  });
});

// ── inferred events ───────────────────────────────────────────────────────────

describe('deriveEventSourceTier — inferred events', () => {
  it('returns "inferred" for fuel events', () => {
    expect(deriveEventSourceTier(makeEvent({ type: 'fuel' }))).toBe('inferred');
  });

  it('returns "inferred" for meal events', () => {
    expect(deriveEventSourceTier(makeEvent({ type: 'meal' }))).toBe('inferred');
  });

  it('returns "inferred" for rest events', () => {
    expect(deriveEventSourceTier(makeEvent({ type: 'rest' }))).toBe('inferred');
  });

  it('returns "inferred" for combo events', () => {
    expect(deriveEventSourceTier(makeEvent({ type: 'combo' }))).toBe('inferred');
  });

  it('returns "inferred" for overnight without a segment', () => {
    expect(deriveEventSourceTier(makeEvent({ type: 'overnight', segment: undefined }))).toBe('inferred');
  });

  it('returns "inferred" for overnight when segment.stopType is not "overnight"', () => {
    const event = makeEvent({
      type: 'overnight',
      segment: makeSegmentWithStopType('drive') as RouteSegment,
    });
    expect(deriveEventSourceTier(event)).toBe('inferred');
  });

  it('returns "inferred" for overnight when segment.stopType is null/undefined', () => {
    const event = makeEvent({
      type: 'overnight',
      segment: { stopType: undefined } as unknown as RouteSegment,
    });
    expect(deriveEventSourceTier(event)).toBe('inferred');
  });
});

// ── presence of engine stops does not override type-based derivation ──────────

describe('deriveEventSourceTier — stops array does not affect result', () => {
  it('waypoint with stops[] still returns "declared"', () => {
    const event = makeEvent({
      type: 'waypoint',
      stops: [{ id: 's1', type: 'fuel' } as never],
    });
    expect(deriveEventSourceTier(event)).toBe('declared');
  });

  it('fuel event with empty stops[] still returns "inferred"', () => {
    expect(deriveEventSourceTier(makeEvent({ type: 'fuel', stops: [] }))).toBe('inferred');
  });
});
