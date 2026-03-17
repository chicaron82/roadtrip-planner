/**
 * PlanIcebreaker — Three-question onboarding flow for Plan Mode.
 *
 * Q1: Where is your MEE time?      (origin + destination)
 * Q2: When is your MEE time?       (dates + departure time)
 * Q3: Who's coming?                (travelers + drivers)
 *
 * On completion, emits a prefill for App to apply before opening the wizard.
 * On escape, hands off to the classic wizard with no prefill.
 *
 * 💚 My Experience Engine
 */

import { useState } from 'react';
import type { Location } from '../../types';
import type { IcebreakerPrefill } from './IcebreakerGate';
import { IcebreakerQuestion } from './IcebreakerQuestion';
import { LocationSearchInput } from '../Trip/Location/LocationSearchInput';
import { DateRangePicker } from '../UI/DateRangePicker';

interface PlanIcebreakerProps {
  onComplete: (prefill: IcebreakerPrefill) => void;
  onEscape: (saveAsClassic?: boolean) => void;
}

const MIN_TRAVELERS = 1;
const MAX_TRAVELERS = 12;

export function PlanIcebreaker({ onComplete, onEscape }: PlanIcebreakerProps) {
  const [step, setStep] = useState(1);
  const [isExiting, setIsExiting] = useState(false);

  // Q1
  const [origin, setOrigin] = useState<Partial<Location> | null>(null);
  const [destination, setDestination] = useState<Partial<Location> | null>(null);
  const [stop, setStop] = useState<Partial<Location> | null>(null);
  const [showAddStop, setShowAddStop] = useState(false);

  // Q2
  const today = new Date().toISOString().slice(0, 10);
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [departureTime, setDepartureTime] = useState('09:00');

  // Q3
  const [numTravelers, setNumTravelers] = useState(1);
  const [numDrivers, setNumDrivers] = useState(1);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const transition = (fn: () => void) => {
    setIsExiting(true);
    setTimeout(() => { fn(); setIsExiting(false); }, 220);
  };

  const goNext = () => transition(() => setStep(s => s + 1));
  const goBack = () => transition(() => setStep(s => s - 1));

  const canAdvanceQ1 = !!(origin?.lat && origin.lat !== 0 && destination?.lat && destination.lat !== 0);
  const canAdvanceQ2 = !!departureDate;

  const handleComplete = () => {
    const locations: Partial<Location>[] = [
      { ...origin, type: 'origin' as const },
      ...(stop?.lat ? [{ ...stop, type: 'waypoint' as const }] : []),
      { ...destination, type: 'destination' as const },
    ];
    onComplete({
      locations,
      settingsPartial: { departureDate, returnDate, departureTime, numTravelers, numDrivers },
    });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    color: '#f5f0e8',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const stepperRow = (label: string, value: number, onDec: () => void, onInc: () => void) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ color: 'rgba(245,240,232,0.7)', fontSize: '15px' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={onDec} style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#f5f0e8', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}>−</button>
        <span style={{ color: '#f5f0e8', fontSize: '17px', fontWeight: 600, minWidth: 24, textAlign: 'center' }}>{value}</span>
        <button onClick={onInc} style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#f5f0e8', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}>+</button>
      </div>
    </div>
  );

  return (
    <>
      {step === 1 && (
        <IcebreakerQuestion
          key={1}
          question="Where is your MEE time?"
          isExiting={isExiting}
          onEscape={() => onEscape()}
        >
          <LocationSearchInput
            value={origin?.name ?? ''}
            onSelect={(loc) => setOrigin(loc)}
            placeholder="Starting from…"
          />
          {origin?.lat && origin.lat !== 0 && (
            <LocationSearchInput
              value={destination?.name ?? ''}
              onSelect={(loc) => setDestination(loc)}
              placeholder="Headed to…"
            />
          )}
          {canAdvanceQ1 && !showAddStop && (
            <button
              onClick={() => setShowAddStop(true)}
              style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'rgba(245,240,232,0.45)', fontSize: '13px', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
            >
              + Add a stop along the way
            </button>
          )}
          {showAddStop && (
            <LocationSearchInput
              value={stop?.name ?? ''}
              onSelect={(loc) => setStop(loc)}
              placeholder="Stop along the way (optional)"
            />
          )}
          {canAdvanceQ1 && (
            <button
              onClick={goNext}
              style={{ alignSelf: 'flex-start', padding: '12px 28px', background: 'rgba(234,88,12,0.85)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}
            >
              Continue →
            </button>
          )}
        </IcebreakerQuestion>
      )}

      {step === 2 && (
        <IcebreakerQuestion
          key={2}
          question="When is your MEE time?"
          isExiting={isExiting}
          onBack={goBack}
          onEscape={() => onEscape()}
        >
          <DateRangePicker
            startDate={departureDate}
            endDate={returnDate}
            onChange={(start, end) => { setDepartureDate(start); setReturnDate(end); }}
            minDate={today}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ color: 'rgba(245,240,232,0.5)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Departure time</label>
            <input
              type="time"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              style={inputStyle}
            />
          </div>
          {canAdvanceQ2 && (
            <button
              onClick={goNext}
              style={{ alignSelf: 'flex-start', padding: '12px 28px', background: 'rgba(234,88,12,0.85)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}
            >
              Continue →
            </button>
          )}
        </IcebreakerQuestion>
      )}

      {step === 3 && (
        <IcebreakerQuestion
          key={3}
          question="Who's coming?"
          isExiting={isExiting}
          onBack={goBack}
          onEscape={() => onEscape()}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {stepperRow('Travellers', numTravelers,
              () => setNumTravelers(v => clamp(v - 1, MIN_TRAVELERS, MAX_TRAVELERS)),
              () => setNumTravelers(v => clamp(v + 1, MIN_TRAVELERS, MAX_TRAVELERS))
            )}
            {stepperRow('Drivers', numDrivers,
              () => setNumDrivers(v => clamp(v - 1, 1, numTravelers)),
              () => setNumDrivers(v => clamp(v + 1, 1, numTravelers))
            )}
          </div>
          <button
            onClick={handleComplete}
            style={{ alignSelf: 'flex-start', padding: '12px 28px', background: 'rgba(234,88,12,0.85)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}
          >
            Let's build this →
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
