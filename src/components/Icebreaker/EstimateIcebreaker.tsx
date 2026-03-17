/**
 * EstimateIcebreaker — Two-question onboarding flow for Estimate Mode.
 *
 * Q1: Where are you headed?   (origin + destination)
 * Q2: What's your ride?       (vehicle quick-select + travelers)
 *
 * On completion, emits a prefill for Plan Mode (locations + vehicle + travelers).
 * Estimate Mode is an on-ramp to Plan Mode — same wizard, faster entry.
 *
 * 💚 My Experience Engine
 */

import { useState } from 'react';
import type { Location, Vehicle } from '../../types';
import type { IcebreakerPrefill } from './IcebreakerGate';
import { IcebreakerQuestion } from './IcebreakerQuestion';
import { LocationSearchInput } from '../Trip/Location/LocationSearchInput';

interface EstimateIcebreakerProps {
  onComplete: (prefill: IcebreakerPrefill) => void;
  onEscape: (saveAsClassic?: boolean) => void;
}

const MIN_TRAVELERS = 1;
const MAX_TRAVELERS = 12;

interface PresetVehicle {
  emoji: string;
  label: string;
  description: string;
  vehicle: Vehicle;
}

const VEHICLE_PRESETS: PresetVehicle[] = [
  {
    emoji: '🚗',
    label: 'Camry',
    description: 'Reliable sedan',
    vehicle: { year: '2024', make: 'Toyota', model: 'Camry', fuelEconomyCity: 8.2, fuelEconomyHwy: 6.0, tankSize: 60 },
  },
  {
    emoji: '🛻',
    label: 'F-150',
    description: 'Powerful truck',
    vehicle: { year: '2024', make: 'Ford', model: 'F-150', fuelEconomyCity: 13.5, fuelEconomyHwy: 10.2, tankSize: 87 },
  },
  {
    emoji: '⚡',
    label: 'Model 3',
    description: 'Electric sedan',
    vehicle: { year: '2024', make: 'Tesla', model: 'Model 3', fuelEconomyCity: 1.6, fuelEconomyHwy: 1.4, tankSize: 57.5 },
  },
];

export function EstimateIcebreaker({ onComplete, onEscape }: EstimateIcebreakerProps) {
  const [step, setStep] = useState(1);
  const [isExiting, setIsExiting] = useState(false);

  // Q1
  const [origin, setOrigin] = useState<Partial<Location> | null>(null);
  const [destination, setDestination] = useState<Partial<Location> | null>(null);

  // Q2
  const [numTravelers, setNumTravelers] = useState(2);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const transition = (fn: () => void) => {
    setIsExiting(true);
    setTimeout(() => { fn(); setIsExiting(false); }, 220);
  };

  const goNext = () => transition(() => setStep(s => s + 1));
  const goBack = () => transition(() => setStep(s => s - 1));

  const canAdvanceQ1 = !!(origin?.lat && origin.lat !== 0 && destination?.lat && destination.lat !== 0);

  const handleComplete = (vehicle: Vehicle | null) => {
    const locations: Partial<Location>[] = [
      { ...origin, type: 'origin' as const },
      { ...destination, type: 'destination' as const },
    ];
    const prefill: IcebreakerPrefill = {
      locations,
      settingsPartial: { numTravelers, numDrivers: numTravelers },
    };
    if (vehicle) prefill.vehiclePrefill = vehicle;
    onComplete(prefill);
  };

  return (
    <>
      {step === 1 && (
        <IcebreakerQuestion
          key={1}
          question="Where are you headed?"
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
          question="What's your ride?"
          isExiting={isExiting}
          onBack={goBack}
          onEscape={() => onEscape()}
        >
          <div style={{ display: 'flex', gap: '10px' }}>
            {VEHICLE_PRESETS.map(preset => (
              <button
                key={preset.label}
                onClick={() => { setSelectedVehicle(preset.vehicle); handleComplete(preset.vehicle); }}
                style={{
                  flex: 1, padding: '14px 8px', borderRadius: '12px', cursor: 'pointer',
                  background: selectedVehicle?.model === preset.vehicle.model
                    ? 'rgba(234,88,12,0.85)'
                    : 'rgba(255,255,255,0.07)',
                  border: `1px solid ${selectedVehicle?.model === preset.vehicle.model
                    ? 'rgba(234,88,12,0.6)'
                    : 'rgba(255,255,255,0.12)'}`,
                  color: '#f5f0e8', textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '24px', marginBottom: 6 }}>{preset.emoji}</div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{preset.label}</div>
                <div style={{ fontSize: '11px', color: 'rgba(245,240,232,0.5)', marginTop: 2 }}>{preset.description}</div>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'rgba(245,240,232,0.7)', fontSize: '15px' }}>Travellers</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button onClick={() => setNumTravelers(v => clamp(v - 1, MIN_TRAVELERS, MAX_TRAVELERS))} style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#f5f0e8', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}>−</button>
              <span style={{ color: '#f5f0e8', fontSize: '17px', fontWeight: 600, minWidth: 24, textAlign: 'center' }}>{numTravelers}</span>
              <button onClick={() => setNumTravelers(v => clamp(v + 1, MIN_TRAVELERS, MAX_TRAVELERS))} style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#f5f0e8', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}>+</button>
            </div>
          </div>

          <button
            onClick={() => handleComplete(null)}
            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'rgba(245,240,232,0.45)', fontSize: '13px', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
          >
            I'll fill in my vehicle later →
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
