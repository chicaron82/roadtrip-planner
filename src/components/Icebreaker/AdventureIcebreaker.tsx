/**
 * AdventureIcebreaker — Two-question onboarding flow for Adventure Mode.
 *
 * Q1: What are you working with?   (days + budget)
 * Q2: Who's coming?               (travelers + accommodation tier + round trip)
 *
 * On completion, emits a prefill for AdventureMode (budget, days, travelers,
 * accommodationType, isRoundTrip). Origin is asked optionally on Q1.
 *
 * 💚 My Experience Engine
 */

import { useState, useEffect } from 'react';
import type { Location } from '../../types';
import type { IcebreakerPrefill } from './IcebreakerGate';
import { IcebreakerQuestion } from './IcebreakerQuestion';
import { LocationSearchInput } from '../Trip/Location/LocationSearchInput';
import { calculateMaxDistance } from '../../lib/adventure/adventure-service';

interface AdventureIcebreakerProps {
  onComplete: (prefill: IcebreakerPrefill) => void;
  onEscape: (saveAsClassic?: boolean) => void;
  /** Fires whenever origin/budget/days changes so the map can render a live radius preview. */
  onPreviewChange?: (lat: number, lng: number, radiusKm: number) => void;
}

const MIN_DAYS = 1;
const MAX_DAYS = 14;
const MIN_BUDGET = 250;
const MAX_BUDGET = 5000;
const BUDGET_STEP = 250;
const MIN_TRAVELERS = 1;
const MAX_TRAVELERS = 12;

type AccommodationType = 'budget' | 'moderate' | 'comfort';

const ACCOMMODATION_OPTIONS: { value: AccommodationType; label: string; emoji: string }[] = [
  { value: 'budget', label: 'Budget', emoji: '🏕️' },
  { value: 'moderate', label: 'Moderate', emoji: '🏨' },
  { value: 'comfort', label: 'Comfort', emoji: '✨' },
];

export function AdventureIcebreaker({ onComplete, onEscape, onPreviewChange }: AdventureIcebreakerProps) {
  const [step, setStep] = useState(1);
  const [isExiting, setIsExiting] = useState(false);

  // Q1
  const [origin, setOrigin] = useState<Partial<Location> | null>(null);
  const [days, setDays] = useState(3);
  const [budget, setBudget] = useState(1000);

  // Q2
  const [numTravelers, setNumTravelers] = useState(2);
  const [accommodationType, setAccommodationType] = useState<AccommodationType>('moderate');
  const [isRoundTrip, setIsRoundTrip] = useState(true);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  // Fire map preview whenever origin / budget / days / travelers / accommodation changes.
  // All five inputs affect the real results — radius must match.
  useEffect(() => {
    if (!onPreviewChange) return;
    if (!origin?.lat || origin.lat === 0) return;
    const radiusKm = calculateMaxDistance({
      origin: { lat: origin.lat, lng: origin.lng!, name: origin.name ?? '', id: '', type: 'origin' as const },
      budget,
      days,
      travelers: numTravelers,
      accommodationType,
      preferences: [],
    });
    onPreviewChange(origin.lat, origin.lng!, radiusKm);
  }, [origin, budget, days, numTravelers, accommodationType, onPreviewChange]);

  const transition = (fn: () => void) => {
    setIsExiting(true);
    setTimeout(() => { fn(); setIsExiting(false); }, 220);
  };

  const goNext = () => transition(() => setStep(s => s + 1));
  const goBack = () => transition(() => setStep(s => s - 1));

  const handleComplete = () => {
    const prefill: IcebreakerPrefill = {
      adventurePrefill: { budget, days, travelers: numTravelers, accommodationType, isRoundTrip },
    };
    if (origin?.lat && origin.lat !== 0) {
      prefill.locations = [{ ...origin, type: 'origin' as const }];
    }
    onComplete(prefill);
  };

  const stepperRow = (label: string, value: string | number, onDec: () => void, onInc: () => void, hint?: string) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <span style={{ color: 'rgba(245,240,232,0.7)', fontSize: '15px' }}>{label}</span>
        {hint && <span style={{ display: 'block', color: 'rgba(245,240,232,0.4)', fontSize: '12px', marginTop: 2 }}>{hint}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={onDec} style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#f5f0e8', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}>−</button>
        <span style={{ color: '#f5f0e8', fontSize: '17px', fontWeight: 600, minWidth: 56, textAlign: 'center' }}>{value}</span>
        <button onClick={onInc} style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#f5f0e8', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}>+</button>
      </div>
    </div>
  );

  return (
    <>
      {step === 1 && (
        <IcebreakerQuestion
          key={1}
          question="What are you working with?"
          isExiting={isExiting}
          onEscape={() => onEscape()}
        >
          {stepperRow('Days', days,
            () => setDays(v => clamp(v - 1, MIN_DAYS, MAX_DAYS)),
            () => setDays(v => clamp(v + 1, MIN_DAYS, MAX_DAYS)),
          )}
          {stepperRow('Budget', `$${budget.toLocaleString()}`,
            () => setBudget(v => clamp(v - BUDGET_STEP, MIN_BUDGET, MAX_BUDGET)),
            () => setBudget(v => clamp(v + BUDGET_STEP, MIN_BUDGET, MAX_BUDGET)),
            'Total trip budget'
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ color: 'rgba(245,240,232,0.5)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Starting from (optional)
            </label>
            <LocationSearchInput
              value={origin?.name ?? ''}
              onSelect={(loc) => setOrigin(loc)}
              placeholder="Your city or address…"
            />
          </div>
          <button
            onClick={goNext}
            style={{ alignSelf: 'flex-start', padding: '12px 28px', background: 'rgba(234,88,12,0.85)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}
          >
            Continue →
          </button>
        </IcebreakerQuestion>
      )}

      {step === 2 && (
        <IcebreakerQuestion
          key={2}
          question="Who's coming?"
          isExiting={isExiting}
          onBack={goBack}
          onEscape={() => onEscape()}
        >
          {stepperRow('Travellers', numTravelers,
            () => setNumTravelers(v => clamp(v - 1, MIN_TRAVELERS, MAX_TRAVELERS)),
            () => setNumTravelers(v => clamp(v + 1, MIN_TRAVELERS, MAX_TRAVELERS)),
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ color: 'rgba(245,240,232,0.5)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accommodation</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {ACCOMMODATION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setAccommodationType(opt.value)}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: '10px', cursor: 'pointer',
                    background: accommodationType === opt.value ? 'rgba(234,88,12,0.85)' : 'rgba(255,255,255,0.07)',
                    border: `1px solid ${accommodationType === opt.value ? 'rgba(234,88,12,0.6)' : 'rgba(255,255,255,0.12)'}`,
                    color: '#f5f0e8', fontSize: '13px', fontWeight: 600, textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '18px', marginBottom: 3 }}>{opt.emoji}</div>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'rgba(245,240,232,0.7)', fontSize: '15px' }}>Round trip</span>
            <button
              onClick={() => setIsRoundTrip(v => !v)}
              style={{
                width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative',
                background: isRoundTrip ? 'rgba(234,88,12,0.85)' : 'rgba(255,255,255,0.12)',
                transition: 'background 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: isRoundTrip ? 26 : 3,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s',
              }} />
            </button>
          </div>

          <button
            onClick={handleComplete}
            style={{ alignSelf: 'flex-start', padding: '12px 28px', background: 'rgba(234,88,12,0.85)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}
          >
            Find my adventure →
          </button>
          <button
            onClick={() => onEscape(true)}
            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'rgba(245,240,232,0.35)', fontSize: '12px', cursor: 'pointer', padding: 0 }}
          >
            Always use classic planner →
          </button>
        </IcebreakerQuestion>
      )}
    </>
  );
}
