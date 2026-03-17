/**
 * IcebreakerGate — Routes to the correct icebreaker based on trip mode.
 *
 * Plan      → PlanIcebreaker     (3-question: where / when / who)
 * Adventure → AdventureIcebreaker (2-question: what you've got / who's coming)
 * Estimate  → EstimateIcebreaker  (2-question: where / what's your ride)
 *
 * Renders as a full-screen overlay in the same glass aesthetic as the landing screen.
 * The map remains visible behind it — the world the trip lives in.
 *
 * 💚 My Experience Engine
 */

import type { Location, TripMode, TripSettings, Vehicle } from '../../types';
import { PlanIcebreaker } from './PlanIcebreaker';
import { AdventureIcebreaker } from './AdventureIcebreaker';
import { EstimateIcebreaker } from './EstimateIcebreaker';

export interface IcebreakerPrefill {
  locations?: Partial<Location>[];
  settingsPartial?: Partial<TripSettings>;
  vehiclePrefill?: Vehicle;
  adventurePrefill?: {
    budget?: number;
    days?: number;
    travelers?: number;
    accommodationType?: 'budget' | 'moderate' | 'comfort';
    isRoundTrip?: boolean;
  };
}

interface IcebreakerGateProps {
  mode: TripMode;
  onComplete: (mode: TripMode, prefill: IcebreakerPrefill) => void;
  onEscape: (mode: TripMode, saveAsClassic?: boolean) => void;
  /** Fires while the Adventure icebreaker is active — drives the radius circle on the map. */
  onAdventurePreviewChange?: (lat: number, lng: number, radiusKm: number) => void;
}

export function IcebreakerGate({ mode, onComplete, onEscape, onAdventurePreviewChange }: IcebreakerGateProps) {
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
        {mode === 'plan' && (
          <PlanIcebreaker
            onComplete={(prefill) => onComplete(mode, prefill)}
            onEscape={(saveAsClassic) => onEscape(mode, saveAsClassic)}
          />
        )}
        {mode === 'adventure' && (
          <AdventureIcebreaker
            onComplete={(prefill) => onComplete(mode, prefill)}
            onEscape={(saveAsClassic) => onEscape(mode, saveAsClassic)}
            onPreviewChange={onAdventurePreviewChange}
          />
        )}
        {mode === 'estimate' && (
          <EstimateIcebreaker
            onComplete={(prefill) => onComplete(mode, prefill)}
            onEscape={(saveAsClassic) => onEscape(mode, saveAsClassic)}
          />
        )}
      </div>
    </div>
  );
}
