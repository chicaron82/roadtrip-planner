import type { DriverStats } from '../../../lib/driver-rotation';
import { formatDriveTime, getDriverName } from '../../../lib/driver-rotation';

// ==================== TYPES ====================

interface DriverStatsPanelProps {
  stats: DriverStats[];
  driverNames?: string[];
}

// ==================== DRIVER COLORS ====================

const DRIVER_COLORS = [
  { accent: 'border-l-indigo-500', text: 'text-white/60', badge: 'bg-indigo-500', emoji: '🚗' },
  { accent: 'border-l-emerald-500', text: 'text-white/60', badge: 'bg-emerald-500', emoji: '🚙' },
  { accent: 'border-l-amber-500', text: 'text-white/60', badge: 'bg-amber-500', emoji: '🏎️' },
  { accent: 'border-l-rose-500', text: 'text-white/60', badge: 'bg-rose-500', emoji: '🚐' },
];

function getDriverColor(driverNum: number) {
  return DRIVER_COLORS[(driverNum - 1) % DRIVER_COLORS.length];
}

// ==================== COMPONENT ====================

export function DriverStatsPanel({ stats, driverNames }: DriverStatsPanelProps) {
  const totalMinutes = stats.reduce((sum, s) => sum + s.totalMinutes, 0);
  const totalKm = stats.reduce((sum, s) => sum + s.totalKm, 0);

  return (
    <div className="mt-6">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2 mb-3">
        <span>🔁</span> Driver Rotation
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {stats.map((stat) => {
          const c = getDriverColor(stat.driver);
          const timePercent = totalMinutes > 0 ? Math.round((stat.totalMinutes / totalMinutes) * 100) : 0;
          const kmPercent = totalKm > 0 ? Math.round((stat.totalKm / totalKm) * 100) : 0;

          return (
            <div
              key={stat.driver}
              className={`border border-white/10 border-l-4 ${c.accent} rounded-xl p-3 shadow-sm`}
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`${c.badge} text-white text-xs font-bold px-2 py-0.5 rounded-full`}>
                    {c.emoji} {getDriverName(stat.driver, driverNames)}
                  </span>
                </div>
                <span className={`text-xs font-medium ${c.text}`}>
                  {stat.segmentCount} segment{stat.segmentCount !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-white/10 rounded-full mb-2 overflow-hidden">
                <div
                  className={`h-full ${c.badge} rounded-full transition-all duration-500`}
                  style={{ width: `${timePercent}%` }}
                />
              </div>

              <div className="flex justify-between text-xs">
                <span className={c.text}>
                  {formatDriveTime(stat.totalMinutes)} ({timePercent}%)
                </span>
                <span className="text-white/40">
                  {stat.totalKm.toFixed(0)} km ({kmPercent}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
