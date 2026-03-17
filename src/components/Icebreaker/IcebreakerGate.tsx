/**
 * IcebreakerGate — Routes to the correct icebreaker based on trip mode.
 *
 * Plan     → PlanIcebreaker (3-question flow)
 * Adventure → passthrough (icebreaker TBD next session)
 * Estimate  → passthrough (icebreaker TBD next session)
 *
 * Renders as a full-screen overlay in the same glass aesthetic as the landing screen.
 * The map remains visible behind it — the world the trip lives in.
 *
 * 💚 My Experience Engine
 */

import type { Location, TripMode, TripSettings } from '../../types';
import { PlanIcebreaker } from './PlanIcebreaker';

export interface IcebreakerPrefill {
  locations?: Partial<Location>[];
  settingsPartial?: Partial<TripSettings>;
}

interface IcebreakerGateProps {
  mode: TripMode;
  onComplete: (mode: TripMode, prefill: IcebreakerPrefill) => void;
  onEscape: (mode: TripMode, saveAsClassic?: boolean) => void;
}

export function IcebreakerGate({ mode, onComplete, onEscape }: IcebreakerGateProps) {
  if (mode !== 'plan') {
    // Adventure + Estimate icebreakers coming next session — pass through
    onEscape(mode);
    return null;
  }

  return (
    <div
      className="landing-screen"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {/* Same warm overlay as landing */}
      <div className="landing-bg-overlay" />
      <div className="landing-aurora" style={{ animation: 'landing-aurora 12s ease-in-out infinite' }} />

      <div style={{
        position: 'relative',
        zIndex: 10,
        width: '100%',
        maxWidth: '480px',
        padding: 'clamp(32px, 6vw, 64px) clamp(20px, 5vw, 48px)',
      }}>
        <PlanIcebreaker
          onComplete={onComplete}
          onEscape={(saveAsClassic) => onEscape(mode, saveAsClassic)}
        />
      </div>
    </div>
  );
}
