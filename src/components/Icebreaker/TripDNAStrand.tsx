/**
 * TripDNAStrand — The trip assembling itself as the Plan Icebreaker is answered.
 *
 * Phase 1: Line draws in (Plan Mode selected)
 * Phase 2: Origin + destination nodes appear (Where answered)
 * Phase 3: Day split markers appear (When answered)
 * Phase 4: Fuel stop nodes populate (Who answered)
 *
 * Pure SVG. Zero API calls. Zero Leaflet involvement.
 * Vertical when side-by-side with the card (desktop).
 * Horizontal when stacked below the card (portrait mobile).
 *
 * 💚 My Experience Engine
 */

import { useState, useEffect } from 'react';

interface TripDNAStrandProps {
  phase: 1 | 2 | 3 | 4;
  originName?: string;
  destinationName?: string;
  numDays?: number;
  vehicleRangeKm?: number;
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
  orientation: 'horizontal' | 'vertical';
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fade(visible: boolean, delay = 0): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transition: `opacity 0.25s ease-out ${delay}ms`,
  };
}

export function TripDNAStrand({
  phase,
  originName,
  destinationName,
  numDays,
  vehicleRangeKm = 500,
  originLat,
  originLng,
  destLat,
  destLng,
  orientation,
}: TripDNAStrandProps) {
  const [lineDrawn, setLineDrawn] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLineDrawn(true), 200);
    return () => clearTimeout(t);
  }, []);

  const distKm =
    originLat != null && originLng != null && destLat != null && destLng != null && phase >= 2
      ? haversineKm(originLat, originLng, destLat, destLng) * 1.2
      : null;

  const fuelStopCount = distKm ? Math.max(0, Math.floor(distKm / (vehicleRangeKm * 0.85)) - 1) : 0;

  // ── Vertical — desktop side-by-side ─────────────────────────────────────
  if (orientation === 'vertical') {
    const CX = 24;
    const Y_START = 16;
    const Y_END = 284;
    const lineLength = Y_END - Y_START;
    const LABEL_X = 36;

    const splits =
      numDays && numDays > 1
        ? Array.from({ length: numDays - 1 }, (_, i) =>
            Y_START + (lineLength / numDays) * (i + 1),
          )
        : [];

    const fuelYs: number[] = [];
    if (fuelStopCount > 0) {
      const seg = lineLength / (fuelStopCount + 1);
      for (let i = 1; i <= fuelStopCount; i++) fuelYs.push(Y_START + seg * i);
    }

    return (
      <svg
        width={130}
        height={300}
        viewBox="0 0 130 300"
        style={{ flexShrink: 0, overflow: 'visible' }}
      >
        <defs>
          {/* gradientUnits="userSpaceOnUse" — required for gradients on zero-width lines */}
          <linearGradient id="dnaGradV" x1={CX} y1={Y_START} x2={CX} y2={Y_END} gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="rgba(251,191,36,0.8)" />
            <stop offset="50%"  stopColor="rgba(245,240,232,0.35)" />
            <stop offset="100%" stopColor="rgba(251,191,36,0.8)" />
          </linearGradient>
        </defs>

        {/* Line */}
        <line
          x1={CX} y1={Y_START} x2={CX} y2={Y_END}
          stroke="url(#dnaGradV)"
          strokeWidth="2.5"
          strokeDasharray={lineLength}
          strokeDashoffset={lineDrawn ? 0 : lineLength}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />

        {/* Origin node + label */}
        <circle cx={CX} cy={Y_START} r={6} fill="#fbbf24" style={fade(phase >= 2)} />
        {originName && (
          <text x={LABEL_X} y={Y_START + 4} fill="rgba(245,240,232,0.65)" fontSize="10" style={fade(phase >= 2)}>
            {originName.length > 14 ? originName.slice(0, 13) + '…' : originName}
          </text>
        )}

        {/* Destination node + label */}
        <circle cx={CX} cy={Y_END} r={6} fill="#fbbf24" style={fade(phase >= 2, 80)} />
        {destinationName && (
          <text x={LABEL_X} y={Y_END + 4} fill="rgba(245,240,232,0.65)" fontSize="10" style={fade(phase >= 2, 80)}>
            {destinationName.length > 14 ? destinationName.slice(0, 13) + '…' : destinationName}
          </text>
        )}

        {/* Day splits */}
        {splits.map((y, i) => (
          <g key={i} style={fade(phase >= 3, i * 80)}>
            <line
              x1={CX - 10} y1={y} x2={CX + 10} y2={y}
              stroke="rgba(245,240,232,0.3)"
              strokeWidth="1.5"
            />
          </g>
        ))}

        {/* Fuel stops */}
        {fuelYs.map((y, i) => (
          <circle
            key={i}
            cx={CX} cy={y} r={3.5}
            fill="rgba(245,240,232,0.5)"
            style={fade(phase >= 4, i * 60)}
          />
        ))}
      </svg>
    );
  }

  // ── Horizontal — portrait mobile stacked below ───────────────────────────
  const VW = 400;
  const Y = 44;
  const X_START = 16;
  const X_END = VW - 16;
  const lineLength = X_END - X_START;

  const splits =
    numDays && numDays > 1
      ? Array.from({ length: numDays - 1 }, (_, i) =>
          X_START + (lineLength / numDays) * (i + 1),
        )
      : [];

  const fuelXs: number[] = [];
  if (fuelStopCount > 0) {
    const seg = lineLength / (fuelStopCount + 1);
    for (let i = 1; i <= fuelStopCount; i++) fuelXs.push(X_START + seg * i);
  }

  function truncate(name: string, max: number) {
    return name.length > max ? name.slice(0, max - 1) + '…' : name;
  }

  return (
    <svg
      width="100%"
      height={72}
      viewBox={`0 0 ${VW} 72`}
      style={{ marginTop: 28 }}
    >
      <defs>
        {/* gradientUnits="userSpaceOnUse" — required for gradients on zero-height lines */}
        <linearGradient id="dnaGradH" x1={X_START} y1={Y} x2={X_END} y2={Y} gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(251,191,36,0.8)" />
          <stop offset="50%"  stopColor="rgba(245,240,232,0.35)" />
          <stop offset="100%" stopColor="rgba(251,191,36,0.8)" />
        </linearGradient>
      </defs>

      {/* Line */}
      <line
        x1={X_START} y1={Y} x2={X_END} y2={Y}
        stroke="url(#dnaGradH)"
        strokeWidth="2.5"
        strokeDasharray={lineLength}
        strokeDashoffset={lineDrawn ? 0 : lineLength}
        style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
      />

      {/* Origin node */}
      <circle cx={X_START} cy={Y} r={6} fill="#fbbf24" style={fade(phase >= 2)} />
      {originName && (
        <text
          x={X_START} y={Y - 13}
          fill="rgba(245,240,232,0.65)" fontSize="10" textAnchor="start"
          style={fade(phase >= 2)}
        >
          {truncate(originName, 16)}
        </text>
      )}

      {/* Destination node */}
      <circle cx={X_END} cy={Y} r={6} fill="#fbbf24" style={fade(phase >= 2, 80)} />
      {destinationName && (
        <text
          x={X_END} y={Y - 13}
          fill="rgba(245,240,232,0.65)" fontSize="10" textAnchor="end"
          style={fade(phase >= 2, 80)}
        >
          {truncate(destinationName, 16)}
        </text>
      )}

      {/* Day splits */}
      {splits.map((x, i) => (
        <g key={i} style={fade(phase >= 3, i * 80)}>
          <line
            x1={x} y1={Y - 8} x2={x} y2={Y + 8}
            stroke="rgba(245,240,232,0.3)"
            strokeWidth="1.5"
          />
          <text
            x={x} y={Y + 20}
            fill="rgba(245,240,232,0.35)" fontSize="9" textAnchor="middle"
          >
            Day {i + 2}
          </text>
        </g>
      ))}

      {/* Fuel stops */}
      {fuelXs.map((x, i) => (
        <circle
          key={i}
          cx={x} cy={Y} r={3.5}
          fill="rgba(245,240,232,0.5)"
          style={fade(phase >= 4, i * 60)}
        />
      ))}
    </svg>
  );
}
