/**
 * WorkshopPanel — Beat 3: "Let MEE make this personal"
 *
 * Floating glass panel over the map with live-updating controls.
 * Progressive disclosure: vehicle + hotel always visible,
 * pace + budget behind "More options ↓" expand.
 *
 * LiveReflectionBar at top updates instantly on every control tap —
 * powered by generateEstimate() (pure math, no API).
 *
 * 💚 My Experience Engine — Beat 3 of the Four-Beat Arc
 */

import { useState, useMemo } from 'react';
import type { Vehicle, TripSettings, TripSummary } from '../../types';
import { generateEstimate } from '../../lib/estimate-service';
import { formatHoursFromMinutes } from '../../lib/utils';

interface WorkshopPanelProps {
  sketchDistanceKm: number;
  sketchDurationMinutes: number;
  vehicle: Vehicle;
  settings: TripSettings;
  onCommit: (overrides: { settings: Partial<TripSettings>; vehicle?: Vehicle }) => void;
  onEscape: () => void;
}

// ── Vehicle presets (simplified for workshop) ────────────────────────────────

type VehicleType = 'sedan' | 'suv' | 'truck' | 'van' | 'hybrid';

const VEHICLE_TYPES: { type: VehicleType; emoji: string; label: string; vehicle: Vehicle }[] = [
  { type: 'sedan', emoji: '🚗', label: 'Sedan', vehicle: { year: '2024', make: 'Toyota', model: 'Camry', fuelEconomyCity: 8.2, fuelEconomyHwy: 6.0, tankSize: 60 } },
  { type: 'suv', emoji: '🚙', label: 'SUV', vehicle: { year: '2024', make: 'Toyota', model: 'RAV4', fuelEconomyCity: 9.4, fuelEconomyHwy: 7.2, tankSize: 55 } },
  { type: 'truck', emoji: '🛻', label: 'Truck', vehicle: { year: '2024', make: 'Ford', model: 'F-150', fuelEconomyCity: 13.5, fuelEconomyHwy: 10.2, tankSize: 87 } },
  { type: 'van', emoji: '🚐', label: 'Van', vehicle: { year: '2024', make: 'Chrysler', model: 'Pacifica', fuelEconomyCity: 10.8, fuelEconomyHwy: 8.0, tankSize: 68 } },
  { type: 'hybrid', emoji: '⚡', label: 'Hybrid', vehicle: { year: '2024', make: 'Toyota', model: 'Prius', fuelEconomyCity: 4.3, fuelEconomyHwy: 4.0, tankSize: 43 } },
];

type HotelTier = 'budget' | 'regular' | 'premium';
const HOTEL_OPTIONS: { tier: HotelTier; emoji: string; label: string; price: number }[] = [
  { tier: 'budget', emoji: '🏕', label: 'Budget', price: 90 },
  { tier: 'regular', emoji: '🏨', label: 'Regular', price: 140 },
  { tier: 'premium', emoji: '✨', label: 'Premium', price: 220 },
];

type Pace = 'relaxed' | 'balanced' | 'push';
const PACE_OPTIONS: { pace: Pace; emoji: string; label: string; hours: number }[] = [
  { pace: 'relaxed', emoji: '🐢', label: 'Relaxed', hours: 6 },
  { pace: 'balanced', emoji: '⚖️', label: 'Balanced', hours: 8 },
  { pace: 'push', emoji: '🚀', label: 'Push it', hours: 10 },
];

const CATEGORY_COLORS = ['#ea580c', '#7c3aed', '#16a34a', '#0891b2'] as const;

export function WorkshopPanel({
  sketchDistanceKm,
  sketchDurationMinutes,
  vehicle: initialVehicle,
  settings: initialSettings,
  onCommit,
  onEscape,
}: WorkshopPanelProps) {
  // ── Local overrides ──────────────────────────────────────────────────────
  const initialType = VEHICLE_TYPES.find(v =>
    v.vehicle.fuelEconomyHwy === initialVehicle.fuelEconomyHwy
  )?.type ?? 'sedan';

  const [vehicleType, setVehicleType] = useState<VehicleType>(initialType);
  const [hotelTier, setHotelTier] = useState<HotelTier>(
    (initialSettings.hotelTier as HotelTier) || 'regular'
  );
  const [pace, setPace] = useState<Pace>('balanced');
  const [showMore, setShowMore] = useState(false);
  const [budgetEnabled, setBudgetEnabled] = useState(initialSettings.budgetMode === 'plan-to-budget');
  const [budgetAmount, setBudgetAmount] = useState(
    initialSettings.budget?.total ?? 2000
  );

  const selectedVehicle = VEHICLE_TYPES.find(v => v.type === vehicleType)!;
  const selectedHotel = HOTEL_OPTIONS.find(h => h.tier === hotelTier)!;
  const selectedPace = PACE_OPTIONS.find(p => p.pace === pace)!;

  // ── Live estimate ────────────────────────────────────────────────────────
  const mergedSettings: TripSettings = useMemo(() => ({
    ...initialSettings,
    hotelTier,
    hotelPricePerNight: selectedHotel.price,
    maxDriveHours: selectedPace.hours,
    budgetMode: budgetEnabled ? 'plan-to-budget' as const : 'open' as const,
    budget: budgetEnabled
      ? { ...initialSettings.budget, total: budgetAmount }
      : initialSettings.budget,
  }), [initialSettings, hotelTier, selectedHotel.price, selectedPace.hours, budgetEnabled, budgetAmount]);

  const sketchSummary: TripSummary = useMemo(() => ({
    totalDistanceKm: sketchDistanceKm,
    totalDurationMinutes: sketchDurationMinutes,
    totalFuelLitres: 0,
    totalFuelCost: 0,
    gasStops: 0,
    costPerPerson: 0,
    drivingDays: Math.max(1, Math.ceil(sketchDurationMinutes / (selectedPace.hours * 60))),
    segments: [],
    fullGeometry: [],
  }), [sketchDistanceKm, sketchDurationMinutes, selectedPace.hours]);

  const estimate = useMemo(
    () => generateEstimate(sketchSummary, selectedVehicle.vehicle, mergedSettings),
    [sketchSummary, selectedVehicle.vehicle, mergedSettings],
  );

  const driveLabel = formatHoursFromMinutes(Math.round(sketchDurationMinutes));
  const totals = [estimate.breakdown[0].mid, estimate.breakdown[1].mid, estimate.breakdown[2].mid, estimate.breakdown[3].mid];
  const total = totals.reduce((a, b) => a + b, 0);
  const percents = totals.map(v => total > 0 ? (v / total) * 100 : 25);

  // ── Commit ───────────────────────────────────────────────────────────────
  const handleCommit = () => {
    onCommit({
      settings: {
        hotelTier,
        hotelPricePerNight: selectedHotel.price,
        maxDriveHours: selectedPace.hours,
        budgetMode: budgetEnabled ? 'plan-to-budget' : 'open',
        budget: budgetEnabled ? { ...initialSettings.budget, total: budgetAmount } : initialSettings.budget,
      },
      vehicle: selectedVehicle.vehicle,
    });
  };

  // ── Chip button style ────────────────────────────────────────────────────
  const chip = (active: boolean): React.CSSProperties => ({
    padding: '8px 14px',
    borderRadius: '10px',
    border: active ? '1.5px solid rgba(234, 88, 12, 0.6)' : '1px solid rgba(255, 255, 255, 0.1)',
    background: active ? 'rgba(234, 88, 12, 0.15)' : 'rgba(255, 255, 255, 0.04)',
    color: active ? '#f5f0e8' : 'rgba(245, 240, 232, 0.55)',
    fontSize: '13px',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    transition: 'all 150ms ease',
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <div
        className="workshop-panel"
        style={{
          pointerEvents: 'auto',
          width: '100%',
          maxWidth: '460px',
          maxHeight: '90dvh',
          overflowY: 'auto',
          background: 'rgba(13, 13, 16, 0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          animation: 'workshopIn 350ms ease forwards',
        }}
      >
        <style>{`
          @keyframes workshopIn {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @media (max-width: 640px) {
            .workshop-panel {
              position: fixed !important;
              bottom: 0 !important;
              left: 0 !important;
              right: 0 !important;
              max-width: 100% !important;
              border-radius: 20px 20px 0 0 !important;
              max-height: 85dvh !important;
            }
          }
        `}</style>

        {/* Live Reflection Bar */}
        <div style={{
          padding: '12px 20px 10px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '20px 20px 0 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ color: '#f5f0e8', fontSize: 14, fontWeight: 700 }}>
              ~{estimate.currency}{estimate.totalMid.toLocaleString()} est.
            </span>
            <span style={{ color: 'rgba(245,240,232,0.3)', fontSize: 13 }}>·</span>
            <span style={{ color: 'rgba(245,240,232,0.55)', fontSize: 13 }}>
              {estimate.days} day{estimate.days !== 1 ? 's' : ''}
            </span>
            <span style={{ color: 'rgba(245,240,232,0.3)', fontSize: 13 }}>·</span>
            <span style={{ color: 'rgba(245,240,232,0.55)', fontSize: 13 }}>
              {driveLabel} driving
            </span>
          </div>
          <div style={{ display: 'flex', height: 4, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
            {percents.map((pct, i) => (
              <div key={i} style={{ flex: pct, background: CATEGORY_COLORS[i], opacity: 0.75, minWidth: 4 }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 5 }}>
            {['⛽', '🏨', '🍽️', '🎯'].map((emoji, i) => (
              <span key={i} style={{ color: 'rgba(245,240,232,0.4)', fontSize: 11 }}>
                {emoji} {Math.round(percents[i])}%
              </span>
            ))}
            <span style={{ marginLeft: 'auto', color: 'rgba(245,240,232,0.25)', fontSize: 10 }}>
              per person ~{estimate.currency}{estimate.perPersonMid}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div style={{ padding: '20px 20px 16px' }}>
          <p style={{
            color: 'rgba(245, 240, 232, 0.45)',
            fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: 20,
          }}>
            Let MEE make this personal
          </p>

          {/* Primary: Vehicle */}
          <p style={{ color: 'rgba(245,240,232,0.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Your ride
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
            {VEHICLE_TYPES.map(v => (
              <button key={v.type} onClick={() => setVehicleType(v.type)} style={chip(vehicleType === v.type)}>
                {v.emoji} {v.label}
              </button>
            ))}
          </div>

          {/* Primary: Hotel */}
          <p style={{ color: 'rgba(245,240,232,0.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Hotel vibe
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
            {HOTEL_OPTIONS.map(h => (
              <button key={h.tier} onClick={() => setHotelTier(h.tier)} style={chip(hotelTier === h.tier)}>
                {h.emoji} {h.label} ~${h.price}
              </button>
            ))}
          </div>

          {/* Progressive disclosure toggle */}
          {!showMore && (
            <button
              onClick={() => setShowMore(true)}
              style={{
                width: '100%', padding: '10px', marginBottom: 18,
                background: 'none', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
                color: 'rgba(245,240,232,0.4)', fontSize: 12, cursor: 'pointer',
              }}
            >
              More options ↓
            </button>
          )}

          {/* Secondary: Pace */}
          {showMore && (
            <>
              <p style={{ color: 'rgba(245,240,232,0.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Pace
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
                {PACE_OPTIONS.map(p => (
                  <button key={p.pace} onClick={() => setPace(p.pace)} style={chip(pace === p.pace)}>
                    {p.emoji} {p.label}
                  </button>
                ))}
              </div>

              {/* Secondary: Budget */}
              <p style={{ color: 'rgba(245,240,232,0.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Budget
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <button
                  onClick={() => setBudgetEnabled(!budgetEnabled)}
                  style={chip(!budgetEnabled)}
                >
                  No budget set
                </button>
                {budgetEnabled && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: 'rgba(245,240,232,0.5)', fontSize: 14 }}>{estimate.currency}</span>
                    <input
                      type="number"
                      value={budgetAmount}
                      onChange={e => setBudgetAmount(Math.max(100, Number(e.target.value) || 0))}
                      style={{
                        width: 80, padding: '6px 8px',
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
                        color: '#f5f0e8', fontSize: 14, outline: 'none', textAlign: 'center',
                      }}
                    />
                  </div>
                )}
                {!budgetEnabled && (
                  <button
                    onClick={() => setBudgetEnabled(true)}
                    style={{ ...chip(budgetEnabled), fontSize: 12 }}
                  >
                    Set a budget
                  </button>
                )}
              </div>
            </>
          )}

          {/* Commit */}
          <button
            onClick={handleCommit}
            style={{
              width: '100%',
              padding: '14px 20px',
              background: 'rgba(234, 88, 12, 0.85)',
              border: 'none',
              borderRadius: '12px',
              color: '#f5f0e8',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: 10,
            }}
          >
            Calculate my MEE time →
          </button>

          {/* Escape hatch */}
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={onEscape}
              style={{
                background: 'none', border: 'none',
                color: 'rgba(245, 240, 232, 0.3)', fontSize: 12,
                cursor: 'pointer', padding: '4px 0',
              }}
            >
              See all settings →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
