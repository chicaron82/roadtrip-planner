/**
 * Tests for trip-timeline.ts — buildTimedTimeline
 *
 * Covers:
 *   - Departure and arrival bookend events
 *   - Single segment, no stops → departure + drive + arrival
 *   - Single segment with a mid-drive fuel stop → drive is split around it
 *   - Single segment with multiple en-route stops → ordered by estimatedTime
 *   - Boundary (post-segment) overnight stop → clock advances to next morning
 *   - Round-trip day-trip destination dwell event
 *   - Dismissed stops are excluded
 *   - Stop deduplication (same id never emitted twice)
 *   - isMidDriveForThisSegment path: en-route stops on multi-segment routes
 *   - Failsafe even distribution when estimatedTime is invalid
 *
 * 💚 My Experience Engine
 */

import { describe, it, expect } from 'vitest';
import { buildTimedTimeline } from './trip-timeline';
import type { TimedEvent } from './trip-timeline';
import type { SuggestedStop } from './stop-suggestions';
import { makeSegment, makeSettings, makeLocation } from '../test/fixtures';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeStop(
  overrides: Partial<SuggestedStop> & Pick<SuggestedStop, 'id' | 'type'>,
): SuggestedStop {
  return {
    afterSegmentIndex: 0,
    estimatedTime: new Date('2025-08-16T11:00:00'),
    duration: 15,
    reason: 'test stop',
    priority: 'recommended',
    details: {},
    dismissed: false,
    ...overrides,
  };
}

function types(events: TimedEvent[]) {
  return events.map(e => e.type);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildTimedTimeline', () => {
  // ── Basic structure ─────────────────────────────────────────────────────

  it('returns empty array when no segments', () => {
    const result = buildTimedTimeline([], [], makeSettings());
    expect(result).toHaveLength(0);
  });

  it('produces departure + drive + arrival for a single segment with no stops', () => {
    const seg = makeSegment({ durationMinutes: 120, distanceKm: 200 });
    const result = buildTimedTimeline([seg], [], makeSettings());

    expect(types(result)).toEqual(['departure', 'drive', 'arrival']);
  });

  it('departure event has zero duration and is at departure time', () => {
    const settings = makeSettings({ departureDate: '2025-08-16', departureTime: '09:00' });
    const seg = makeSegment({ durationMinutes: 60 });
    const [dep] = buildTimedTimeline([seg], [], settings);

    expect(dep.type).toBe('departure');
    expect(dep.durationMinutes).toBe(0);
    expect(dep.arrivalTime.getHours()).toBe(9);
    expect(dep.arrivalTime.getMinutes()).toBe(0);
  });

  it('arrival event is at departure time + drive duration', () => {
    const settings = makeSettings({ departureDate: '2025-08-16', departureTime: '09:00' });
    const seg = makeSegment({ durationMinutes: 120 }); // 2h drive
    const events = buildTimedTimeline([seg], [], settings);
    const arrival = events[events.length - 1];

    expect(arrival.type).toBe('arrival');
    // 9:00 + 2h = 11:00
    expect(arrival.arrivalTime.getHours()).toBe(11);
    expect(arrival.arrivalTime.getMinutes()).toBe(0);
  });

  // ── Mid-drive stop splitting (hasMidDriveTime path) ───────────────────────

  it('splits a segment around a mid-drive fuel stop', () => {
    const settings = makeSettings({ departureDate: '2025-08-16', departureTime: '09:00' });
    // 200km / 4h drive; fuel stop at the 2h mark (~halfway)
    const seg = makeSegment({ durationMinutes: 240, distanceKm: 200 });
    const fuel = makeStop({
      id: 'fuel-1',
      type: 'fuel',
      afterSegmentIndex: -1, // mid-drive for segment 0
      estimatedTime: new Date('2025-08-16T11:00:00'), // 2h after 9AM
      duration: 10,
    });

    const result = buildTimedTimeline([seg], [fuel], settings);
    const eventTypes = types(result);

    // departure → drive (first half) → fuel → drive (second half) → arrival
    expect(eventTypes).toContain('fuel');
    const fuelIdx = eventTypes.indexOf('fuel');
    expect(eventTypes[fuelIdx - 1]).toBe('drive'); // drive before fuel
    expect(eventTypes[fuelIdx + 1]).toBe('drive'); // drive after fuel
  });

  it('mid-drive fuel stop advances the clock by stop duration', () => {
    const settings = makeSettings({ departureDate: '2025-08-16', departureTime: '09:00' });
    const seg = makeSegment({ durationMinutes: 240, distanceKm: 200 });
    const fuel = makeStop({
      id: 'fuel-1',
      type: 'fuel',
      afterSegmentIndex: -1,
      estimatedTime: new Date('2025-08-16T11:00:00'), // 2h in
      duration: 15,
    });

    const result = buildTimedTimeline([seg], [fuel], settings);
    const fuelEvent = result.find(e => e.type === 'fuel')!;
    expect(fuelEvent.durationMinutes).toBe(15);
    // departure from fuel stop is 15min after arrival
    const gap = fuelEvent.departureTime.getTime() - fuelEvent.arrivalTime.getTime();
    expect(gap).toBe(15 * 60 * 1000);
  });

  it('orders multiple mid-drive stops by estimatedTime', () => {
    const settings = makeSettings({ departureDate: '2025-08-16', departureTime: '09:00' });
    const seg = makeSegment({ durationMinutes: 360, distanceKm: 400 }); // 6h drive
    const meal = makeStop({
      id: 'meal-1',
      type: 'meal',
      afterSegmentIndex: -1,
      estimatedTime: new Date('2025-08-16T13:00:00'), // 4h in
      duration: 30,
    });
    const fuel = makeStop({
      id: 'fuel-1',
      type: 'fuel',
      afterSegmentIndex: -1,
      estimatedTime: new Date('2025-08-16T11:00:00'), // 2h in — comes first
      duration: 10,
    });

    const result = buildTimedTimeline([seg], [fuel, meal], settings);
    const stopTypes = result.filter(e => e.type === 'fuel' || e.type === 'meal').map(e => e.type);

    // fuel (2h mark) should come before meal (4h mark)
    expect(stopTypes).toEqual(['fuel', 'meal']);
  });

  it('three mid-drive stops produce correct interleaving', () => {
    // Single 8h segment: depart 08:00, stops at 10h, 12h, 14h
    const settings = makeSettings({ departureDate: '2025-08-16', departureTime: '08:00' });
    const seg = makeSegment({ durationMinutes: 480, distanceKm: 700 });
    const stops = [
      makeStop({ id: 'f1', type: 'fuel', afterSegmentIndex: -1, estimatedTime: new Date('2025-08-16T10:00:00'), duration: 15 }),
      makeStop({ id: 'm1', type: 'meal', afterSegmentIndex: -1, estimatedTime: new Date('2025-08-16T12:00:00'), duration: 30 }),
      makeStop({ id: 'f2', type: 'fuel', afterSegmentIndex: -1, estimatedTime: new Date('2025-08-16T14:00:00'), duration: 15 }),
    ];

    const result = buildTimedTimeline([seg], stops, settings);
    const eventTypes = types(result);

    expect(eventTypes).toEqual([
      'departure',
      'drive', 'fuel',
      'drive', 'meal',
      'drive', 'fuel',
      'drive',
      'arrival',
    ]);
  });

  // ── Multi-segment ──────────────────────────────────────────────────────────

  it('produces a waypoint event between two segments with mismatched names', () => {
    // seg1.to.name !== seg2.from.name → waypoint is emitted
    const seg1 = makeSegment({
      from: makeLocation('Winnipeg'),
      to: makeLocation('Kenora'),
      durationMinutes: 120,
      distanceKm: 200,
    });
    const seg2 = makeSegment({
      from: makeLocation('Dryden'), // deliberately mismatched — not "Kenora"
      to: makeLocation('Thunder Bay'),
      durationMinutes: 180,
      distanceKm: 300,
    });

    const result = buildTimedTimeline([seg1, seg2], [], makeSettings());
    expect(types(result)).toContain('waypoint');
  });

  it('does NOT produce a waypoint when adjacent segment names match', () => {
    const seg1 = makeSegment({
      from: makeLocation('Winnipeg'),
      to: makeLocation('Kenora'),
      durationMinutes: 120,
      distanceKm: 200,
    });
    const seg2 = makeSegment({
      from: makeLocation('Kenora'), // matches seg1.to.name → no waypoint
      to: makeLocation('Thunder Bay'),
      durationMinutes: 180,
      distanceKm: 300,
    });

    const result = buildTimedTimeline([seg1, seg2], [], makeSettings());
    expect(types(result)).not.toContain('waypoint');
  });

  // ── isMidDriveForThisSegment path (single-segment fallback) ──────────────
  //
  // generateSmartStops tags en-route stops for segment 0 with afterSegmentIndex=-1
  // (= i-1 for i=0). When hasMidDriveTime is unreliable (drifted or NaN estimatedTime),
  // isMidDriveForThisSegment catches these stops and places them mid-drive.
  // For stops with afterSegmentIndex=0 on a 2-segment route, they are correctly
  // consumed as boundary-after of seg0 (the natural segment junction).

  it('afterSegmentIndex=0 on a 2-segment route appears at the segment junction (not mid-drive)', () => {
    // A stop at afterSegmentIndex=0 is boundary-after of seg0, which is the
    // correct placement: it fires at the junction between seg0 and seg1.
    const settings = makeSettings({ departureDate: '2025-08-16', departureTime: '08:00' });
    const seg0 = makeSegment({ from: makeLocation('A'), to: makeLocation('B'), durationMinutes: 120, distanceKm: 150 });
    const seg1 = makeSegment({ from: makeLocation('B'), to: makeLocation('C'), durationMinutes: 240, distanceKm: 300 });

    const junctionFuel = makeStop({
      id: 'fuel-junction',
      type: 'fuel',
      afterSegmentIndex: 0, // boundary-after of seg0
      estimatedTime: new Date('2025-08-16T12:00:00'),
      duration: 15,
    });

    const result = buildTimedTimeline([seg0, seg1], [junctionFuel], settings);
    const eventTypes = types(result);

    // Fuel appears between the two drives (at the junction), not splitting either
    expect(eventTypes).toContain('fuel');
    const fuelIdx = eventTypes.indexOf('fuel');
    expect(eventTypes[fuelIdx - 1]).toBe('drive');
    expect(eventTypes[fuelIdx + 1]).toBe('drive');
    // 2 drive segments total — fuel did NOT split either one
    expect(eventTypes.filter(t => t === 'drive')).toHaveLength(2);
    // Stop emitted exactly once
    expect(result.filter(e => e.type === 'fuel')).toHaveLength(1);
  });

  it('isMidDriveForThisSegment: single-segment, 3 stops with afterSegmentIndex=-1 split the drive', () => {
    // generateSmartStops sets afterSegmentIndex = index-1 = -1 for in-route stops on seg 0.
    // isMidDriveForThisSegment fires for i=0 when afterSegmentIndex === -1 === i-1.
    const settings = makeSettings({ departureDate: '2025-08-16', departureTime: '08:00' });
    const seg = makeSegment({ durationMinutes: 360, distanceKm: 400 });
    const stops = [
      makeStop({ id: 'f1', type: 'fuel', afterSegmentIndex: -1, estimatedTime: new Date('2025-08-16T10:00:00'), duration: 15 }),
      makeStop({ id: 'm1', type: 'meal', afterSegmentIndex: -1, estimatedTime: new Date('2025-08-16T11:00:00'), duration: 30 }),
      makeStop({ id: 'f2', type: 'fuel', afterSegmentIndex: -1, estimatedTime: new Date('2025-08-16T12:30:00'), duration: 15 }),
    ];

    const result = buildTimedTimeline([seg], stops, settings);
    const eventTypes = types(result);

    // departure + 4 drive segments + 3 stops + arrival
    expect(eventTypes).toEqual([
      'departure',
      'drive', 'fuel',
      'drive', 'meal',
      'drive', 'fuel',
      'drive',
      'arrival',
    ]);
    // All 3 stops emitted exactly once
    expect(result.filter(e => e.type === 'fuel')).toHaveLength(2);
    expect(result.filter(e => e.type === 'meal')).toHaveLength(1);
  });

  it('failsafe: stops with out-of-bounds estimatedTime are distributed evenly', () => {
    // afterSegmentIndex = -1 → isMidDriveForThisSegment for segment 0
    // estimatedTime at epoch (far out of range) → fraction <= 0.05 → failsafe kicks in
    // 3 stops → distributed at 25%, 50%, 75% of segment
    const settings = makeSettings({ departureDate: '2025-08-16', departureTime: '08:00' });
    const seg = makeSegment({ durationMinutes: 360, distanceKm: 400 });

    const epoch = new Date(0); // Jan 1 1970 — far out of range
    const stops = [
      makeStop({ id: 'f1', type: 'fuel', afterSegmentIndex: -1, estimatedTime: epoch, duration: 15 }),
      makeStop({ id: 'f2', type: 'fuel', afterSegmentIndex: -1, estimatedTime: epoch, duration: 15 }),
      makeStop({ id: 'f3', type: 'fuel', afterSegmentIndex: -1, estimatedTime: epoch, duration: 15 }),
    ];

    const result = buildTimedTimeline([seg], stops, settings);
    const fuelEvents = result.filter(e => e.type === 'fuel');

    // All 3 emitted
    expect(fuelEvents).toHaveLength(3);
    // Times must be strictly ascending (evenly distributed)
    expect(fuelEvents[0].arrivalTime < fuelEvents[1].arrivalTime).toBe(true);
    expect(fuelEvents[1].arrivalTime < fuelEvents[2].arrivalTime).toBe(true);
  });

  // ── Overnight stops ───────────────────────────────────────────────────────
  //
  // The overnight event's own departureTime is arr + duration (nominal).
  // The important behavior is that currentTime is reset to NEXT MORNING at
  // the trip's departure hour. We verify this via the drive event that follows.

  it('overnight stop advances clock to next morning at departure time', () => {
    const settings = makeSettings({
      departureDate: '2025-08-16',
      departureTime: '09:00',
    });
    // 2-segment trip so there's a drive AFTER the overnight to check
    const seg0 = makeSegment({ durationMinutes: 120, distanceKm: 200 });
    const seg1 = makeSegment({ durationMinutes: 120, distanceKm: 200 });
    const overnight = makeStop({
      id: 'overnight-1',
      type: 'overnight',
      afterSegmentIndex: 0, // boundary-after seg0 (between the two segments)
      estimatedTime: new Date('2025-08-16T11:00:00'),
      duration: 480, // nominal 8h
    });

    const result = buildTimedTimeline([seg0, seg1], [overnight], settings);
    const overnightEvent = result.find(e => e.type === 'overnight')!;
    expect(overnightEvent).toBeDefined();

    // The drive AFTER the overnight should start at 09:00 on Aug 17
    const overnightIdx = result.indexOf(overnightEvent);
    const driveAfter = result.slice(overnightIdx + 1).find(e => e.type === 'drive')!;
    expect(driveAfter).toBeDefined();
    expect(driveAfter.arrivalTime.getDate()).toBe(17);   // next day
    expect(driveAfter.arrivalTime.getHours()).toBe(9);   // departure hour
    expect(driveAfter.arrivalTime.getMinutes()).toBe(0);
  });

  it('overnight clock advance respects non-standard departure times', () => {
    const settings = makeSettings({
      departureDate: '2025-08-16',
      departureTime: '06:30',
    });
    const seg0 = makeSegment({ durationMinutes: 120, distanceKm: 200 });
    const seg1 = makeSegment({ durationMinutes: 60, distanceKm: 100 });
    const overnight = makeStop({
      id: 'night',
      type: 'overnight',
      afterSegmentIndex: 0,
      estimatedTime: new Date('2025-08-16T11:00:00'),
      duration: 480,
    });

    const result = buildTimedTimeline([seg0, seg1], [overnight], settings);
    const overnightIdx = result.findIndex(e => e.type === 'overnight');
    const driveAfter = result.slice(overnightIdx + 1).find(e => e.type === 'drive')!;

    expect(driveAfter.arrivalTime.getHours()).toBe(6);
    expect(driveAfter.arrivalTime.getMinutes()).toBe(30);
  });

  // ── Dismissed stops ───────────────────────────────────────────────────────

  it('excludes dismissed stops', () => {
    const seg = makeSegment({ durationMinutes: 240, distanceKm: 200 });
    const dismissed = makeStop({
      id: 'fuel-dismissed',
      type: 'fuel',
      afterSegmentIndex: -1,
      estimatedTime: new Date('2025-08-16T11:00:00'),
      dismissed: true,
    });

    const result = buildTimedTimeline([seg], [dismissed], makeSettings());
    expect(result.find(e => e.type === 'fuel')).toBeUndefined();
  });

  // ── Deduplication ─────────────────────────────────────────────────────────

  it('never emits the same stop id twice', () => {
    const seg1 = makeSegment({ durationMinutes: 60, distanceKm: 100 });
    const seg2 = makeSegment({ durationMinutes: 60, distanceKm: 100 });
    const fuel = makeStop({
      id: 'fuel-shared',
      type: 'fuel',
      afterSegmentIndex: 0,
      estimatedTime: new Date('2025-08-16T10:00:00'),
    });

    const result = buildTimedTimeline([seg1, seg2], [fuel], makeSettings());
    const fuelEvents = result.filter(e => e.id === 'event-fuel-shared');
    expect(fuelEvents).toHaveLength(1);
  });

  // ── Round-trip destination dwell ──────────────────────────────────────────

  it('emits a destination event at the round-trip midpoint when dwell > 0', () => {
    const settings = makeSettings({ departureDate: '2025-08-16', departureTime: '09:00' });
    const outbound = makeSegment({
      from: makeLocation('Winnipeg'),
      to: makeLocation('Thunder Bay'),
      durationMinutes: 120,
    });
    const returnLeg = makeSegment({
      from: makeLocation('Thunder Bay'),
      to: makeLocation('Winnipeg'),
      durationMinutes: 120,
    });

    // Midpoint = 1 (return starts at index 1), 2h dwell at destination
    const result = buildTimedTimeline(
      [outbound, returnLeg],
      [],
      settings,
      1,      // roundTripMidpoint
      120,    // destinationStayMinutes
    );

    expect(types(result)).toContain('destination');
    const dwellEvent = result.find(e => e.type === 'destination')!;
    expect(dwellEvent.durationMinutes).toBe(120);
  });

  it('does NOT emit a destination event when dwell is 0', () => {
    const settings = makeSettings({ departureDate: '2025-08-16', departureTime: '09:00' });
    const outbound = makeSegment({ durationMinutes: 120 });
    const returnLeg = makeSegment({ durationMinutes: 120 });

    const result = buildTimedTimeline([outbound, returnLeg], [], settings, 1, 0);
    expect(result.find(e => e.type === 'destination')).toBeUndefined();
  });

  it('destination locationHint uses the segment-before-midpoint destination name', () => {
    // 4-segment: A→B, B→C, C→B, B→A. midpoint=2 → dwell fired before seg[2].
    // segments[midpoint-1] = segments[1]: B→C, so .to.name = 'C'
    const settings = makeSettings({ departureDate: '2025-08-16', departureTime: '07:00' });
    const segs = [
      makeSegment({ from: makeLocation('Toronto'), to: makeLocation('Kingston'), durationMinutes: 100 }),
      makeSegment({ from: makeLocation('Kingston'), to: makeLocation('Ottawa'), durationMinutes: 80 }),
      makeSegment({ from: makeLocation('Ottawa'), to: makeLocation('Kingston'), durationMinutes: 80 }),
      makeSegment({ from: makeLocation('Kingston'), to: makeLocation('Toronto'), durationMinutes: 100 }),
    ];

    const result = buildTimedTimeline(segs, [], settings, 2, 120);
    const dest = result.find(e => e.type === 'destination')!;
    expect(dest.locationHint).toBe('Ottawa');
  });

  it('destination dwell advances the clock: arrival is delayed by dwell minutes', () => {
    const settings = makeSettings({ departureDate: '2025-08-16', departureTime: '08:00' });
    const out = makeSegment({ durationMinutes: 120, distanceKm: 200 });
    const ret = makeSegment({ durationMinutes: 120, distanceKm: 200 });

    const withDwell = buildTimedTimeline([out, ret], [], settings, 1, 120);
    const withoutDwell = buildTimedTimeline([out, ret], [], settings, 1, 0);

    const arrivalWith = withDwell.find(e => e.type === 'arrival')!;
    const arrivalWithout = withoutDwell.find(e => e.type === 'arrival')!;

    const diffMin = (arrivalWith.arrivalTime.getTime() - arrivalWithout.arrivalTime.getTime()) / 60_000;
    expect(diffMin).toBe(120);
  });

  it('destination event appears immediately before the first return drive', () => {
    const settings = makeSettings({ departureDate: '2025-08-16', departureTime: '08:00' });
    const out = makeSegment({ durationMinutes: 120, distanceKm: 200 });
    const ret = makeSegment({ durationMinutes: 120, distanceKm: 200 });

    const result = buildTimedTimeline([out, ret], [], settings, 1, 60);
    const destIdx = result.findIndex(e => e.type === 'destination');

    expect(destIdx).toBeGreaterThan(0);
    expect(result[destIdx + 1].type).toBe('drive');
  });

  // ── Cumulative distance ───────────────────────────────────────────────────

  it('tracks cumulative distance correctly across segments', () => {
    const seg1 = makeSegment({ distanceKm: 100, durationMinutes: 60 });
    const seg2 = makeSegment({ distanceKm: 150, durationMinutes: 90 });
    const result = buildTimedTimeline([seg1, seg2], [], makeSettings());

    const arrival = result[result.length - 1];
    expect(arrival.distanceFromOriginKm).toBeCloseTo(250, 0);
  });
});
