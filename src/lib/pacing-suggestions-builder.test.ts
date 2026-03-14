/**
 * pacing-suggestions-builder.test.ts
 *
 * Tests the coordination logic of buildPacingSuggestions which brings together:
 * - Basic pacing analysis
 * - Outbound departure optimization
 * - Return departure optimization
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildPacingSuggestions } from './pacing-suggestions-builder';
import { generatePacingSuggestions } from './segment-analyzer';
import { findOptimalOutboundDeparture } from './outbound-departure-optimizer';
import { findOptimalReturnDeparture } from './return-departure-optimizer';
import { makeSettings, makeVehicle, makeSegment } from '../test/fixtures';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('./segment-analyzer', () => ({
  generatePacingSuggestions: vi.fn(),
}));

vi.mock('./outbound-departure-optimizer', () => ({
  findOptimalOutboundDeparture: vi.fn(),
}));

vi.mock('./return-departure-optimizer', () => ({
  findOptimalReturnDeparture: vi.fn(),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VEHICLE = makeVehicle();
const SETTINGS = makeSettings({ departureTime: '09:00' });
const START_TIME = new Date('2025-08-16T09:00:00');
const SUMMARY = {
  segments: [makeSegment(), makeSegment()],
  fullGeometry: [[0, 0], [1, 1]] as [number, number][],
  roundTripMidpoint: 1,
  totalDurationMinutes: 600,
};

describe('buildPacingSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns base suggestions from generatePacingSuggestions', () => {
    vi.mocked(generatePacingSuggestions).mockReturnValue(['Base suggestion']);
    vi.mocked(findOptimalOutboundDeparture).mockReturnValue(null);
    vi.mocked(findOptimalReturnDeparture).mockReturnValue(null);

    const result = buildPacingSuggestions({
      maxDayMinutes: 600,
      settings: SETTINGS,
      isAlreadySplit: false,
      routeSummary: SUMMARY,
      vehicle: VEHICLE,
      startTime: START_TIME,
    });

    expect(result).toContain('Base suggestion');
    expect(result).toHaveLength(1);
  });

  it('adds outbound tip when an optimal departure is found', () => {
    vi.mocked(generatePacingSuggestions).mockReturnValue([]);
    vi.mocked(findOptimalOutboundDeparture).mockReturnValue({
      suggestedTime: '08:30',
      hubName: 'Dryden',
      arrivalTime: '12:00 PM',
      minutesDelta: 30,
      comboKm: 300,
    });

    const result = buildPacingSuggestions({
      maxDayMinutes: 600,
      settings: SETTINGS,
      isAlreadySplit: false,
      routeSummary: SUMMARY,
      vehicle: VEHICLE,
      startTime: START_TIME,
    });

    expect(result.some(s => s.includes('Outbound tip') && s.includes('08:30') && s.includes('Dryden'))).toBe(true);
  });

  it('adds return trip tip when an optimal return departure is found', () => {
    vi.mocked(generatePacingSuggestions).mockReturnValue([]);
    vi.mocked(findOptimalOutboundDeparture).mockReturnValue(null);
    vi.mocked(findOptimalReturnDeparture).mockReturnValue({
      suggestedTime: '10:00 AM',
      hubName: 'Kenora',
      minutesDelta: 60,
      timeSavedMinutes: 15,
      comboKm: 300,
    });

    const result = buildPacingSuggestions({
      maxDayMinutes: 600,
      settings: SETTINGS,
      isAlreadySplit: false,
      routeSummary: SUMMARY,
      vehicle: VEHICLE,
      startTime: START_TIME,
    });

    const tip = result.find(s => s.includes('Return trip tip'));
    expect(tip).toBeDefined();
    expect(tip).toContain('1h later');
    expect(tip).toContain('Kenora');
    expect(tip).toContain('saving ~15 min');
  });

  it('formats minutes delta correctly for short shifts (< 60m)', () => {
    vi.mocked(generatePacingSuggestions).mockReturnValue([]);
    vi.mocked(findOptimalReturnDeparture).mockReturnValue({
      suggestedTime: '09:15',
      hubName: 'Test',
      minutesDelta: 15,
      timeSavedMinutes: 5,
      comboKm: 100,
    });

    const result = buildPacingSuggestions({
      maxDayMinutes: 600,
      settings: SETTINGS,
      isAlreadySplit: false,
      routeSummary: SUMMARY,
      vehicle: VEHICLE,
      startTime: START_TIME,
    });

    const tip = result.find(s => s.includes('Return trip tip'));
    expect(tip).toContain('15 min later');
  });

  it('formats hours and minutes delta correctly for complex shifts (> 60m)', () => {
    vi.mocked(generatePacingSuggestions).mockReturnValue([]);
    vi.mocked(findOptimalReturnDeparture).mockReturnValue({
      suggestedTime: '10:15',
      hubName: 'Test',
      minutesDelta: 75, // 1h 15m
      timeSavedMinutes: 10,
      comboKm: 150,
    });

    const result = buildPacingSuggestions({
      maxDayMinutes: 600,
      settings: SETTINGS,
      isAlreadySplit: false,
      routeSummary: SUMMARY,
      vehicle: VEHICLE,
      startTime: START_TIME,
    });

    const tip = result.find(s => s.includes('Return trip tip'));
    expect(tip).toContain('1h 15min later');
  });

  it('handles negative delta (earlier) correctly', () => {
    vi.mocked(generatePacingSuggestions).mockReturnValue([]);
    vi.mocked(findOptimalReturnDeparture).mockReturnValue({
      suggestedTime: '08:00',
      hubName: 'Test',
      minutesDelta: -60,
      timeSavedMinutes: 10,
      comboKm: 200,
    });

    const result = buildPacingSuggestions({
      maxDayMinutes: 600,
      settings: SETTINGS,
      isAlreadySplit: false,
      routeSummary: SUMMARY,
      vehicle: VEHICLE,
      startTime: START_TIME,
    });

    const tip = result.find(s => s.includes('Return trip tip'));
    expect(tip).toContain('1h earlier');
  });

  it('does nothing if no vehicle is provided', () => {
    vi.mocked(generatePacingSuggestions).mockReturnValue(['Base']);

    const result = buildPacingSuggestions({
      maxDayMinutes: 600,
      settings: SETTINGS,
      isAlreadySplit: false,
      routeSummary: SUMMARY,
      vehicle: undefined,
      startTime: START_TIME,
    });

    expect(result).toHaveLength(1);
    expect(findOptimalOutboundDeparture).not.toHaveBeenCalled();
    expect(findOptimalReturnDeparture).not.toHaveBeenCalled();
  });
});
