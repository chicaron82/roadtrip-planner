/**
 * TripSnapshotPanel — Tier B grouped surface.
 *
 * The lighter trip facts that don't need their own fullscreen.
 * Pace, longest day, fuel stops, rooms, avg daily drive, drive style.
 *
 * 💚 My Experience Engine — Voilà Tier B
 */

import type { TripSummary, TripSettings, TripDay } from '../../types';
import { formatHoursFromMinutes } from '../../lib/utils';

interface TripSnapshotPanelProps {
  summary: TripSummary;
  settings: TripSettings;
  onBack: () => void;
}

interface SnapshotRowProps {
  label: string;
  value: string;
}

function SnapshotRow({ label, value }: SnapshotRowProps) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      padding: '14px 20px',
      borderBottom: '1px solid rgba(245, 240, 232, 0.05)',
    }}>
      <p style={{
        fontFamily: '"DM Sans", system-ui, sans-serif',
        fontSize: 14,
        color: 'rgba(245, 240, 232, 0.45)',
        margin: 0,
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: '"Cormorant Garamond", Georgia, serif',
        fontSize: 18,
        fontWeight: 500,
        color: '#f5f0e8',
        margin: 0,
      }}>
        {value}
      </p>
    </div>
  );
}

export function TripSnapshotPanel({ summary, settings, onBack }: TripSnapshotPanelProps) {
  const avgDailyKm = summary.drivingDays > 0
    ? Math.round(summary.totalDistanceKm / summary.drivingDays)
    : 0;

  const longestDayMinutes = summary.days?.reduce((max: number, d: TripDay) => {
    const mins = d.totals?.driveTimeMinutes ?? 0;
    return mins > max ? mins : max;
  }, 0) ?? 0;

  const fuelStops = summary.gasStops ?? 0;

  const numRooms = settings.numRooms ?? Math.ceil((settings.numTravelers ?? 1) / 2);
  const numDrivers = settings.numDrivers ?? 1;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 10,
      background: 'rgba(14, 11, 7, 0.96)',
      backdropFilter: 'blur(28px)',
      WebkitBackdropFilter: 'blur(28px)',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 20px 16px',
        borderBottom: '1px solid rgba(245, 240, 232, 0.07)',
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(245, 240, 232, 0.55)',
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSize: 14,
            cursor: 'pointer',
            padding: '4px 0',
          }}
        >
          ← Back
        </button>
        <p style={{
          fontFamily: '"DM Sans", system-ui, sans-serif',
          fontSize: 13,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'rgba(245, 240, 232, 0.4)',
          margin: 0,
        }}>
          Trip Snapshot
        </p>
        <div style={{ width: 48 }} />
      </div>

      {/* Stats */}
      <div style={{ flex: 1 }}>
        <SnapshotRow label="Pace" value={settings.maxDriveHours <= 6 ? 'Relaxed' : settings.maxDriveHours <= 8 ? 'Balanced' : 'Ambitious'} />
        {longestDayMinutes > 0 && (
          <SnapshotRow label="Longest driving day" value={formatHoursFromMinutes(Math.round(longestDayMinutes))} />
        )}
        <SnapshotRow label="Fuel stops" value={fuelStops > 0 ? String(fuelStops) : 'None planned'} />
        <SnapshotRow label="Rooms" value={`${numRooms} room${numRooms !== 1 ? 's' : ''}`} />
        {avgDailyKm > 0 && (
          <SnapshotRow label="Avg daily drive" value={`${avgDailyKm.toLocaleString()} km`} />
        )}
        <SnapshotRow
          label="Drive style"
          value={numDrivers > 1 ? `${numDrivers} shared drivers` : 'Solo driver'}
        />
      </div>
    </div>
  );
}
