import type { DriverStats } from '../../lib/driver-rotation';
import { formatDriveTime } from '../../lib/driver-rotation';

// ==================== TYPES ====================

interface DriverStatsPanelProps {
  stats: DriverStats[];
}

// ==================== DRIVER COLORS ====================

const DRIVER_COLORS = [
  { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', badge: 'bg-indigo-500', emoji: '🚗' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-500', emoji: '🚙' },
  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-500', emoji: '🏎️' },
  { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-500', emoji: '🚐' },
];

function getDriverColor(driverNum: number) {
  return DRIVER_COLORS[(driverNum - 1) % DRIVER_COLORS.length];
}

// ==================== COMPONENT ====================

export function DriverStatsPanel({ stats }: DriverStatsPanelProps) {
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
              className={`${c.bg} ${c.border} border rounded-xl p-3 shadow-sm`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`${c.badge} text-white text-xs font-bold px-2 py-0.5 rounded-full`}>
                    {c.emoji} Driver {stat.driver}
                  </span>
                </div>
                <span className={`text-xs font-medium ${c.text}`}>
                  {stat.segmentCount} segment{stat.segmentCount !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-gray-100 rounded-full mb-2 overflow-hidden">
                <div
                  className={`h-full ${c.badge} rounded-full transition-all duration-500`}
                  style={{ width: `${timePercent}%` }}
                />
              </div>

              <div className="flex justify-between text-xs">
                <span className={c.text}>
                  {formatDriveTime(stat.totalMinutes)} ({timePercent}%)
                </span>
                <span className="text-gray-500">
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
