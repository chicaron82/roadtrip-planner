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

import type { CSSProperties } from 'react';
import type { Vehicle, TripSettings } from '../../types';
import {
  useWorkshopPresets,
  VEHICLE_TYPES, HOTEL_OPTIONS, PACE_OPTIONS, CATEGORY_COLORS,
} from './useWorkshopPresets';

interface WorkshopPanelProps {
  sketchDistanceKm: number;
  sketchDurationMinutes: number;
  vehicle: Vehicle;
  settings: TripSettings;
  onCommit: (overrides: { settings: Partial<TripSettings>; vehicle?: Vehicle }) => void;
  onEscape: () => void;
}

export function WorkshopPanel({
  sketchDistanceKm,
  sketchDurationMinutes,
  vehicle,
  settings,
  onCommit,
  onEscape,
}: WorkshopPanelProps) {
  const {
    travelers, setTravelers,
    numRooms, setNumRooms,
    isDayTrip,
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
              {multiPerson
                ? `~${estimate.currency}${estimate.perPersonMid.toLocaleString()}/person`
                : `~${estimate.currency}${estimate.totalMid.toLocaleString()} est.`
              }
            </span>
            {multiPerson && (
              <>
                <span style={{ color: 'rgba(245,240,232,0.3)', fontSize: 13 }}>·</span>
                <span style={{ color: 'rgba(245,240,232,0.45)', fontSize: 13 }}>
                  {estimate.currency}{estimate.totalMid.toLocaleString()} total
                </span>
              </>
            )}
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
            {!multiPerson && (
              <span style={{ marginLeft: 'auto', color: 'rgba(245,240,232,0.25)', fontSize: 10 }}>
                per person ~{estimate.currency}{estimate.perPersonMid}
              </span>
            )}
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

          {/* Primary: Who's coming */}
          <p style={{ color: 'rgba(245,240,232,0.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Who's coming?
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
            <button
              onClick={() => setTravelers(Math.max(1, travelers - 1))}
              disabled={travelers <= 1}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                border: travelers <= 1 ? '1px solid rgba(255,255,255,0.08)' : '1.5px solid rgba(234,88,12,0.5)',
                background: travelers <= 1 ? 'rgba(255,255,255,0.03)' : 'rgba(234,88,12,0.12)',
                color: travelers <= 1 ? 'rgba(245,240,232,0.2)' : 'rgba(234,88,12,0.9)',
                fontSize: 20, cursor: travelers <= 1 ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 150ms ease', flexShrink: 0,
              }}
            >−</button>

            <div style={{ flex: 1, textAlign: 'center' }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#f5f0e8', lineHeight: 1 }}>
                {travelers}
              </span>
              <span style={{ fontSize: 13, color: 'rgba(245,240,232,0.45)', marginLeft: 6 }}>
                {travelers === 1 ? 'person' : 'people'}
              </span>
            </div>

            <button
              onClick={() => setTravelers(Math.min(8, travelers + 1))}
              disabled={travelers >= 8}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                border: travelers >= 8 ? '1px solid rgba(255,255,255,0.08)' : '1.5px solid rgba(234,88,12,0.6)',
                background: travelers >= 8 ? 'rgba(255,255,255,0.03)' : 'rgba(234,88,12,0.2)',
                color: travelers >= 8 ? 'rgba(245,240,232,0.2)' : '#f5f0e8',
                fontSize: 20, cursor: travelers >= 8 ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 150ms ease', flexShrink: 0,
              }}
            >+</button>
          </div>

          {/* Rooms needed — hidden for day trips (0 nights) */}
          {!isDayTrip && (
            <>
              <p style={{ color: 'rgba(245,240,232,0.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Rooms needed?
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
                <button
                  onClick={() => setNumRooms(Math.max(1, numRooms - 1))}
                  disabled={numRooms <= 1}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: numRooms <= 1 ? '1px solid rgba(255,255,255,0.08)' : '1.5px solid rgba(234,88,12,0.5)',
                    background: numRooms <= 1 ? 'rgba(255,255,255,0.03)' : 'rgba(234,88,12,0.12)',
                    color: numRooms <= 1 ? 'rgba(245,240,232,0.2)' : 'rgba(234,88,12,0.9)',
                    fontSize: 20, cursor: numRooms <= 1 ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 150ms ease', flexShrink: 0,
                  }}
                >−</button>

                <div style={{ flex: 1, textAlign: 'center' }}>
                  <span style={{ fontSize: 28, fontWeight: 700, color: '#f5f0e8', lineHeight: 1 }}>
                    {numRooms}
                  </span>
                  <span style={{ fontSize: 13, color: 'rgba(245,240,232,0.45)', marginLeft: 6 }}>
                    {numRooms === 1 ? 'room' : 'rooms'}
                  </span>
                </div>

                <button
                  onClick={() => setNumRooms(Math.min(4, numRooms + 1))}
                  disabled={numRooms >= 4}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: numRooms >= 4 ? '1px solid rgba(255,255,255,0.08)' : '1.5px solid rgba(234,88,12,0.6)',
                    background: numRooms >= 4 ? 'rgba(255,255,255,0.03)' : 'rgba(234,88,12,0.2)',
                    color: numRooms >= 4 ? 'rgba(245,240,232,0.2)' : '#f5f0e8',
                    fontSize: 20, cursor: numRooms >= 4 ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 150ms ease', flexShrink: 0,
                  }}
                >+</button>
              </div>
            </>
          )}

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
