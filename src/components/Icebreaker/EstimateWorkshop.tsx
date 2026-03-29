/**
 * EstimateWorkshop — "Price Your MEE Time"
 *
 * The surface between the Estimate Icebreaker and Plan Mode.
 * Shows a live LOW/MID/HIGH cost table. User tunes hotel tier,
 * travelers, and gas price. When numbers look right: "Build this trip →"
 *
 * Renders in the same glass overlay as the Icebreaker — map behind, world visible.
 *
 * 💚 My Experience Engine
 */

import { useState, useMemo } from 'react';
import type { Vehicle, TripSettings, TripSummary } from '../../types';
import { generateEstimate } from '../../lib/estimate-service';

interface EstimateWorkshopProps {
  summary: TripSummary | null;
  vehicle: Vehicle;
  settings: TripSettings;
  isCalculating: boolean;
  onCommit: (settingsOverride: Partial<TripSettings>) => void;
  onEscape: () => void;
  onSettingsChange?: (override: Partial<TripSettings>) => void;
}

type HotelTier = 'budget' | 'regular' | 'premium';

const HOTEL_NIGHTLY: Record<HotelTier, number> = { budget: 90, regular: 140, premium: 220 };
const MIN_TRAVELERS = 1;
const MAX_TRAVELERS = 12;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const row = (s: React.CSSProperties = {}) => ({
  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
  gap: 0, alignItems: 'center', ...s,
});
const cell = (bold = false, muted = false): React.CSSProperties => ({
  padding: '8px 4px', fontSize: '13px', textAlign: 'center' as const,
  color: muted ? 'rgba(245,240,232,0.4)' : '#f5f0e8',
  fontWeight: bold ? 700 : 400,
});

export function EstimateWorkshop({
  summary,
  vehicle,
  settings,
  isCalculating,
  onCommit,
  onEscape,
  onSettingsChange,
}: EstimateWorkshopProps) {
  const [hotelTier, setHotelTier] = useState<HotelTier>('regular');
  const [travelers, setTravelers] = useState(settings.numTravelers || 2);
  const [gasPrice, setGasPrice] = useState(settings.gasPrice || 1.55);

  // Base estimate from route + vehicle (responds to travelers + gasPrice)
  const baseEstimate = useMemo(() => {
    if (!summary) return null;
    return generateEstimate(summary, vehicle, { ...settings, numTravelers: travelers, gasPrice });
  }, [summary, vehicle, settings, travelers, gasPrice]);

  // Hotel row overridden by tier selection
  const computedRows = useMemo(() => {
    if (!baseEstimate) return null;
    const rate = HOTEL_NIGHTLY[hotelTier];
    const rooms = Math.ceil(travelers / 2);
    const nights = baseEstimate.nights;
    const hotel = {
      low: Math.round(nights * rooms * rate * 0.65),
      mid: Math.round(nights * rooms * rate),
      high: Math.round(nights * rooms * rate * 1.57),
    };
    const fuelRow = baseEstimate.breakdown.find(b => b.category === 'Fuel')!;
    const foodRow = baseEstimate.breakdown.find(b => b.category === 'Food')!;
    const miscRow = baseEstimate.breakdown.find(b => b.category === 'Activities & Misc')!;

    const totalLow = fuelRow.low + hotel.low + foodRow.low + miscRow.low;
    const totalMid = fuelRow.mid + hotel.mid + foodRow.mid + miscRow.mid;
    const totalHigh = fuelRow.high + hotel.high + foodRow.high + miscRow.high;

    return { fuelRow, hotel, foodRow, miscRow, totalLow, totalMid, totalHigh, nights };
  }, [baseEstimate, hotelTier, travelers]);

  const inputStyle: React.CSSProperties = {
    width: '70px', padding: '6px 8px', background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px',
    color: '#f5f0e8', fontSize: '14px', outline: 'none', textAlign: 'center',
  };

  return (
    <div
      className="landing-screen"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div className="landing-bg-overlay" />
      <div className="landing-aurora" style={{ animation: 'landing-aurora 12s ease-in-out infinite' }} />

      <div style={{
        position: 'relative', zIndex: 10, width: '100%',
        maxWidth: '520px',
        padding: 'clamp(24px, 5vw, 48px) clamp(16px, 4vw, 40px)',
        overflowY: 'auto', maxHeight: '100dvh',
      }}>
        {/* Header */}
        <p style={{ color: 'rgba(245,240,232,0.45)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
          Estimate Mode
        </p>
        <h1 style={{ color: '#f5f0e8', fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 700, marginBottom: 6, lineHeight: 1.2 }}>
          Here's what your MEE time is worth.
        </h1>

        {isCalculating && !summary && (
          <div style={{ marginTop: 40, textAlign: 'center' }}>
            <div style={{ color: 'rgba(245,240,232,0.5)', fontSize: '15px', marginBottom: 8 }}>Calculating your route…</div>
            <div style={{ width: 40, height: 40, border: '3px solid rgba(234,88,12,0.3)', borderTopColor: 'rgba(234,88,12,0.85)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {computedRows && (
          <>
            {/* Cost table */}
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', marginTop: 20 }}>
              {/* Column headers */}
              <div style={{ ...row(), background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ ...cell(false, true), textAlign: 'left' as const, paddingLeft: 14 }} />
                <div style={{ ...cell(true), fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'rgba(245,240,232,0.4)' }}>LOW</div>
                <div style={{ ...cell(true), fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'rgba(245,240,232,0.6)' }}>MID</div>
                <div style={{ ...cell(true), fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'rgba(245,240,232,0.4)' }}>HIGH</div>
              </div>

              {/* Fuel row */}
              <div style={{ ...row(), borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ ...cell(), textAlign: 'left' as const, paddingLeft: 14 }}>⛽ Fuel</div>
                <div style={cell()}>${computedRows.fuelRow.low}</div>
                <div style={{ ...cell(true), color: 'rgba(245,240,232,0.9)' }}>${computedRows.fuelRow.mid}</div>
                <div style={cell()}>${computedRows.fuelRow.high}</div>
              </div>

              {/* Hotel row */}
              <div style={{ ...row(), borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ ...cell(), textAlign: 'left' as const, paddingLeft: 14 }}>🏨 Hotels</div>
                <div style={cell()}>${computedRows.hotel.low}</div>
                <div style={{ ...cell(true), color: 'rgba(245,240,232,0.9)' }}>${computedRows.hotel.mid}</div>
                <div style={cell()}>${computedRows.hotel.high}</div>
              </div>

              {/* Food row */}
              <div style={{ ...row(), borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ ...cell(), textAlign: 'left' as const, paddingLeft: 14 }}>🍽️ Food</div>
                <div style={cell()}>${computedRows.foodRow.low}</div>
                <div style={{ ...cell(true), color: 'rgba(245,240,232,0.9)' }}>${computedRows.foodRow.mid}</div>
                <div style={cell()}>${computedRows.foodRow.high}</div>
              </div>

              {/* Misc row */}
              <div style={{ ...row(), borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ ...cell(), textAlign: 'left' as const, paddingLeft: 14 }}>🎯 Activities</div>
                <div style={cell()}>${computedRows.miscRow.low}</div>
                <div style={{ ...cell(true), color: 'rgba(245,240,232,0.9)' }}>${computedRows.miscRow.mid}</div>
                <div style={cell()}>${computedRows.miscRow.high}</div>
              </div>

              {/* Total row */}
              <div style={{ ...row(), background: 'rgba(234,88,12,0.08)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ ...cell(true), textAlign: 'left' as const, paddingLeft: 14, color: '#f5f0e8' }}>Total</div>
                <div style={{ ...cell(true), color: 'rgba(245,240,232,0.6)' }}>${computedRows.totalLow}</div>
                <div style={{ ...cell(true), color: 'rgba(234,88,12,0.95)', fontSize: '15px' }}>${computedRows.totalMid}</div>
                <div style={{ ...cell(true), color: 'rgba(245,240,232,0.6)' }}>${computedRows.totalHigh}</div>
              </div>

              {/* Per person row */}
              <div style={row()}>
                <div style={{ ...cell(false, true), textAlign: 'left' as const, paddingLeft: 14, fontSize: '11px' }}>Per person</div>
                <div style={{ ...cell(false, true), fontSize: '11px' }}>${Math.round(computedRows.totalLow / travelers)}</div>
                <div style={{ ...cell(false, true), fontSize: '11px', color: 'rgba(245,240,232,0.5)' }}>${Math.round(computedRows.totalMid / travelers)}</div>
                <div style={{ ...cell(false, true), fontSize: '11px' }}>${Math.round(computedRows.totalHigh / travelers)}</div>
              </div>
            </div>

            {/* Tuning controls */}
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Stay in Canada */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(245,240,232,0.7)', fontSize: '14px' }}>Stay in Canada</span>
                <button
                  onClick={() => onSettingsChange?.({ avoidBorders: !settings.avoidBorders })}
                  style={{
                    width: 44, height: 24, borderRadius: 12, position: 'relative', cursor: 'pointer',
                    background: settings.avoidBorders ? 'rgba(234,88,12,0.85)' : 'rgba(255,255,255,0.08)',
                    border: `1px solid ${settings.avoidBorders ? 'rgba(234,88,12,0.5)' : 'rgba(255,255,255,0.12)'}`,
                    transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 2, left: settings.avoidBorders ? 21 : 3, width: 18, height: 18,
                    borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                  }} />
                </button>
              </div>

              {/* Hotel tier */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(245,240,232,0.7)', fontSize: '14px' }}>Hotel tier</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['budget', 'regular', 'premium'] as HotelTier[]).map(tier => (
                    <button
                      key={tier}
                      onClick={() => setHotelTier(tier)}
                      style={{
                        padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                        background: hotelTier === tier ? 'rgba(234,88,12,0.85)' : 'rgba(255,255,255,0.08)',
                        border: `1px solid ${hotelTier === tier ? 'rgba(234,88,12,0.5)' : 'rgba(255,255,255,0.1)'}`,
                        color: hotelTier === tier ? '#fff' : 'rgba(245,240,232,0.6)',
                      }}
                    >
                      {tier.charAt(0).toUpperCase() + tier.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Travelers */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(245,240,232,0.7)', fontSize: '14px' }}>Travellers</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button onClick={() => setTravelers(v => clamp(v - 1, MIN_TRAVELERS, MAX_TRAVELERS))} style={{ width: 30, height: 30, borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#f5f0e8', fontSize: '16px', cursor: 'pointer' }}>−</button>
                  <span style={{ color: '#f5f0e8', fontSize: '15px', fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{travelers}</span>
                  <button onClick={() => setTravelers(v => clamp(v + 1, MIN_TRAVELERS, MAX_TRAVELERS))} style={{ width: 30, height: 30, borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#f5f0e8', fontSize: '16px', cursor: 'pointer' }}>+</button>
                </div>
              </div>

              {/* Gas price */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(245,240,232,0.7)', fontSize: '14px' }}>Gas price <span style={{ color: 'rgba(245,240,232,0.35)', fontSize: '12px' }}>/L</span></span>
                <input
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="4.0"
                  value={gasPrice}
                  onChange={(e) => setGasPrice(parseFloat(e.target.value) || settings.gasPrice || 1.55)}
                  style={inputStyle}
                />
              </div>

              <div style={{ color: 'rgba(245,240,232,0.3)', fontSize: '11px' }}>
                {computedRows.nights} night{computedRows.nights !== 1 ? 's' : ''} · {baseEstimate?.distanceKm} km route
              </div>
            </div>

            {/* CTA */}
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => onCommit({
                  numTravelers: travelers,
                  gasPrice,
                  hotelPricePerNight: HOTEL_NIGHTLY[hotelTier],
                  hotelTier: hotelTier as 'budget' | 'regular' | 'premium',
                })}
                style={{ padding: '14px 28px', background: 'rgba(234,88,12,0.85)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.02em' }}
              >
                Numbers look good. Build this trip →
              </button>
              <button
                onClick={onEscape}
                style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.35)', fontSize: '12px', cursor: 'pointer', padding: 0, textAlign: 'left' }}
              >
                Skip to full planner →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
