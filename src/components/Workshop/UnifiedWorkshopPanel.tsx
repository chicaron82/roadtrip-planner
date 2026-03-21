/**
 * UnifiedWorkshopPanel — Beat 3: "Let MEE make this personal"
 *
 * The personalization surface for both icebreaker and classic wizard paths.
 * Built with protection gates enforced from day one.
 *
 * ─── Protection Gates ────────────────────────────────────────────────────────
 * A control earns PRIMARY visibility only if it passes ALL THREE:
 *   1. Does it affect the live estimate?
 *   2. Is it changed frequently enough for primary visibility?
 *   3. Does adding it push the estimate bar off screen on mobile?
 *
 * PRIMARY  (always visible): Travelers · Rooms · Vehicle · Hotel
 * SECONDARY (behind toggle): Pace · Budget
 * TITLE    (bottom, special): naming moment, immediately before Calculate
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 💚 My Experience Engine — Unified Beat 3
 */

import type { CSSProperties } from 'react';
import type { Vehicle, TripSettings } from '../../types';
import {
  useWorkshopPresets,
  VEHICLE_TYPES, HOTEL_OPTIONS, PACE_OPTIONS,
} from '../Icebreaker/useWorkshopPresets';
import { WorkshopLiveBar } from './WorkshopLiveBar';
import { WorkshopTitleInput } from './WorkshopTitleInput';

interface UnifiedWorkshopPanelProps {
  sketchDistanceKm: number;
  sketchDurationMinutes: number;
  vehicle: Vehicle;
  settings: TripSettings;
  customTitle: string | null;
  seededTitle: string;
  onCommit: (overrides: { settings: Partial<TripSettings>; vehicle?: Vehicle }) => void;
  onTitleChange: (title: string | null) => void;
  onEscape: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const chip = (active: boolean): CSSProperties => ({
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

interface StepperProps {
  value: number;
  min: number;
  max: number;
  label: (n: number) => string;
  onChange: (n: number) => void;
}

function Stepper({ value, min, max, label, onChange }: StepperProps) {
  const btnStyle = (disabled: boolean, active: boolean): CSSProperties => ({
    width: 36, height: 36, borderRadius: '50%', fontSize: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 150ms ease', flexShrink: 0,
    cursor: disabled ? 'default' : 'pointer',
    border: disabled ? '1px solid rgba(255,255,255,0.08)' : active
      ? '1.5px solid rgba(234,88,12,0.6)' : '1.5px solid rgba(234,88,12,0.5)',
    background: disabled ? 'rgba(255,255,255,0.03)' : active
      ? 'rgba(234,88,12,0.2)' : 'rgba(234,88,12,0.12)',
    color: disabled ? 'rgba(245,240,232,0.2)' : active ? '#f5f0e8' : 'rgba(234,88,12,0.9)',
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
      <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        style={btnStyle(value <= min, false)}>−</button>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: '#f5f0e8', lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: 13, color: 'rgba(245,240,232,0.45)', marginLeft: 6 }}>{label(value)}</span>
      </div>
      <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
        style={btnStyle(value >= max, true)}>+</button>
    </div>
  );
}

const label = (singular: string, plural: string) => (n: number) => n === 1 ? singular : plural;

// ── Component ─────────────────────────────────────────────────────────────────

export function UnifiedWorkshopPanel({
  sketchDistanceKm, sketchDurationMinutes,
  vehicle, settings,
  customTitle, seededTitle, onCommit, onTitleChange, onEscape,
}: UnifiedWorkshopPanelProps) {
  const {
    travelers, setTravelers,
    numRooms, setNumRooms,
    vehicleType, setVehicleType,
    hotelTier, setHotelTier,
    pace, setPace,
    showMore, setShowMore,
    budgetEnabled, setBudgetEnabled,
    budgetAmount, setBudgetAmount,
    estimate, driveLabel, percents,
    handleCommit,
  } = useWorkshopPresets({ sketchDistanceKm, sketchDurationMinutes, vehicle, settings, onCommit });

  const multiPerson = travelers > 1;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      {/* Full-screen dark wash — same treatment as wizard and icebreaker */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(14, 11, 7, 0.72)', pointerEvents: 'none' }} />

      <div
        className="workshop-panel"
        style={{
          pointerEvents: 'auto',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90dvh',
          overflowY: 'auto',
          animation: 'workshopIn 350ms ease forwards',
          position: 'relative',
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
              bottom: 0 !important; left: 0 !important; right: 0 !important;
              max-width: 100% !important;
              border-radius: 20px 20px 0 0 !important;
              max-height: 85dvh !important;
              background: rgba(13, 13, 16, 0.95) !important;
              border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
            }
          }
        `}</style>

        {/* Live estimate bar — pinned, always visible — protected by gate */}
        <WorkshopLiveBar
          estimate={estimate}
          driveLabel={driveLabel}
          percents={percents}
          multiPerson={multiPerson}
        />

        {/* Controls */}
        <div style={{ padding: '20px 20px 16px' }}>
          <p style={{
            color: 'rgba(245, 240, 232, 0.45)',
            fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: 20,
          }}>
            Let MEE make this personal
          </p>

          {/* PRIMARY: Travelers — affects estimate, changed frequently, fits on mobile */}
          <p style={{ color: 'rgba(245,240,232,0.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Who's coming?
          </p>
          <Stepper value={travelers} min={1} max={8} label={label('person', 'people')} onChange={setTravelers} />

          {/* PRIMARY: Rooms — affects estimate, changed frequently, fits on mobile */}
          <p style={{ color: 'rgba(245,240,232,0.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Rooms needed?
          </p>
          <Stepper value={numRooms} min={1} max={4} label={label('room', 'rooms')} onChange={setNumRooms} />

          {/* PRIMARY: Vehicle — affects estimate, changed frequently, fits on mobile */}
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

          {/* PRIMARY: Hotel — affects estimate, changed frequently, fits on mobile */}
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

          {/* SECONDARY gate — Pace + Budget hidden until "More options ↓" */}
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

          {showMore && (
            <>
              {/* SECONDARY: Pace — affects estimate, but not changed as often */}
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

              {/* SECONDARY: Budget — affects estimate, but optional / power-user */}
              <p style={{ color: 'rgba(245,240,232,0.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Budget
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <button onClick={() => setBudgetEnabled(!budgetEnabled)} style={chip(!budgetEnabled)}>
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
                  <button onClick={() => setBudgetEnabled(true)} style={{ ...chip(budgetEnabled), fontSize: 12 }}>
                    Set a budget
                  </button>
                )}
              </div>
            </>
          )}

          {/* Divider before title */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '4px 0 20px' }} />

          {/* TITLE: naming moment — bottom of workshop, before Calculate */}
          <WorkshopTitleInput
            value={customTitle}
            seededTitle={seededTitle}
            onChange={onTitleChange}
          />

          {/* Calculate */}
          <button
            onClick={handleCommit}
            style={{
              width: '100%', padding: '14px 20px',
              background: 'rgba(234, 88, 12, 0.85)',
              border: 'none', borderRadius: '12px',
              color: '#f5f0e8', fontSize: '15px', fontWeight: 600,
              cursor: 'pointer', marginBottom: 10,
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
