/**
 * provider-telemetry.ts — Dev-mode provider usage counters.
 *
 * Answers: Is Google being called? How often does fallback trigger?
 * Production: all functions are no-ops.
 * Dev: logs to console, accumulates on window.__MEE_PROVIDERS__.
 *
 * 💚 My Experience Engine — Provider telemetry
 */

type EventType = 'geocoding' | 'routing' | 'poi';
type Outcome = 'success' | 'failure';

interface ProviderEvent {
  type: EventType;
  provider: string;
  outcome: Outcome;
  durationMs: number;
  timestamp: number;
}

export function recordProviderEvent(
  type: EventType,
  provider: string,
  outcome: Outcome,
  durationMs: number,
): void {
  if (!import.meta.env.DEV) return;

  const event: ProviderEvent = { type, provider, outcome, durationMs, timestamp: Date.now() };

  const w = window as unknown as { __MEE_PROVIDERS__?: ProviderEvent[] };
  if (!w.__MEE_PROVIDERS__) w.__MEE_PROVIDERS__ = [];
  w.__MEE_PROVIDERS__.push(event);

  const label = `[MEE provider] ${type} ${provider} ${outcome} in ${durationMs.toFixed(0)}ms`;
  if (outcome === 'failure') {
    console.warn(label);
  } else {
    console.info(label);
  }
}
