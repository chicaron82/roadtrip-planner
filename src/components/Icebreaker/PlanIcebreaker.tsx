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

import { useState, useEffect } from 'react';
import type { Location } from '../../types';
import type { IcebreakerPrefill } from './IcebreakerGate';
import { IcebreakerQuestion } from './IcebreakerQuestion';
import { LocationSearchInput } from '../Trip/Location/LocationSearchInput';
import { DateRangePicker } from '../UI/DateRangePicker';
import { ClockPicker } from '../UI/ClockPicker';
import { TripDNAStrand } from './TripDNAStrand';
import { getLastOrigin } from '../../lib/storage';

interface PlanIcebreakerProps {
  onComplete: (prefill: IcebreakerPrefill) => void;
  onEscape: (saveAsClassic?: boolean, prefillLocations?: Location[]) => void;
}

const MIN_TRAVELERS = 1;
const MAX_TRAVELERS = 12;

export function PlanIcebreaker({ onComplete, onEscape }: PlanIcebreakerProps) {
  const [step, setStep] = useState(1);
  const [isExiting, setIsExiting] = useState(false);

  // Q1
  const lastOrigin = getLastOrigin();
  const [origin, setOrigin] = useState<Partial<Location> | null>(lastOrigin);
  const [originFromMemory, setOriginFromMemory] = useState(!!lastOrigin);
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

  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, []);

  const transition = (fn: () => void) => {
    setIsExiting(true);
    setTimeout(() => { fn(); setIsExiting(false); }, 220);
  };

  const goNext = () => transition(() => setStep(s => s + 1));
  const goBack = () => transition(() => setStep(s => s - 1));

  const canAdvanceQ1 = !!(origin?.lat && origin.lat !== 0 && destination?.lat && destination.lat !== 0);
  const canAdvanceQ2 = !!departureDate;

  const strandPhase = ((): 1 | 2 | 3 | 4 => {
    if (step === 3) return 4;
    if (departureDate) return 3;
    if (canAdvanceQ1) return 2;
    return 1;
  })();

  const numDays = departureDate
    ? returnDate
      ? Math.max(1, Math.ceil((new Date(returnDate).getTime() - new Date(departureDate).getTime()) / 86_400_000))
      : 1
    : undefined;

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

  // Snapshot any entered origin/destination and pass them through the escape path
  // so the classic wizard can prefill them instead of opening blank.
  const handleEscape = (saveAsClassic?: boolean) => {
    const snapshot: Location[] = [
      ...(origin?.lat && origin.lat !== 0 ? [{ ...origin, type: 'origin' as const } as Location] : []),
      ...(stop?.lat ? [{ ...stop, type: 'waypoint' as const } as Location] : []),
      ...(destination?.lat && destination.lat !== 0 ? [{ ...destination, type: 'destination' as const } as Location] : []),
    ];
    onEscape(saveAsClassic, snapshot.length > 0 ? snapshot : undefined);
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
    <div style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: 'flex-start',
      width: '100%',
      gap: isMobile ? 0 : 28,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
      {step === 1 && (
        <IcebreakerQuestion
          key={1}
          question="Where is your MEE time?"
          isExiting={isExiting}
          onEscape={handleEscape}
        >
          {originFromMemory && origin ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', background: 'rgba(234,88,12,0.08)', border: '1px solid rgba(234,88,12,0.2)', borderRadius: '10px' }}>
              <span style={{ fontSize: '13px' }}>📍</span>
              <span style={{ color: 'rgba(245,240,232,0.85)', fontSize: '13px', fontFamily: 'DM Mono, monospace', flex: 1 }}>
                Departing from {origin.name?.split(',')[0]}
              </span>
              <button
                onClick={() => { setOrigin(null); setOriginFromMemory(false); }}
                style={{ background: 'none', border: 'none', color: 'rgba(234,88,12,0.7)', fontSize: '12px', fontFamily: 'DM Mono, monospace', cursor: 'pointer', padding: 0, whiteSpace: 'nowrap' }}
              >
                not you? change →
              </button>
            </div>
          ) : (
            <LocationSearchInput
              value={origin?.name ?? ''}
              onSelect={(loc) => setOrigin(loc)}
              placeholder="Starting from…"
            />
          )}
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
          onEscape={handleEscape}
        >
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <DateRangePicker
              alwaysOpen
              startDate={departureDate}
              endDate={returnDate}
              onChange={(start, end) => { setDepartureDate(start); setReturnDate(end); }}
              minDate={today}
            />
            <ClockPicker
              alwaysOpen
              value={departureTime}
              onChange={setDepartureTime}
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
          onEscape={handleEscape}
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
            onClick={() => handleEscape(true)}
            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'rgba(245,240,232,0.35)', fontSize: '12px', cursor: 'pointer', padding: 0 }}
          >
            Always use classic planner →
          </button>
        </IcebreakerQuestion>
      )}
      </div>

      <TripDNAStrand
        phase={strandPhase}
        orientation={isMobile ? 'horizontal' : 'vertical'}
        originName={origin?.name}
        destinationName={destination?.name}
        numDays={numDays}
        originLat={origin?.lat}
        originLng={origin?.lng}
        destLat={destination?.lat}
        destLng={destination?.lng}
      />
    </div>
  );
}
