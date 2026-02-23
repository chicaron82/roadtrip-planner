import type { RouteStrategy, UnitSystem } from '../../types';
import { formatDistance, formatDuration } from '../../lib/calculations';

interface RouteStrategyPickerProps {
  strategies: RouteStrategy[];
  activeIndex: number;
  onSelect: (index: number) => void;
  units: UnitSystem;
  isRoundTrip: boolean;
}

export function RouteStrategyPicker({
  strategies,
  activeIndex,
  onSelect,
  units,
  isRoundTrip,
}: RouteStrategyPickerProps) {
  if (strategies.length < 2) return null;

  const fastest = strategies.find(s => s.id === 'fastest');

  return (
    <div className="absolute bottom-[calc(var(--summary-card-h,320px)+12px)] left-4 right-4 z-[1001] flex gap-2 justify-center flex-wrap pointer-events-none">
      {strategies.map((s, i) => {
        const isActive = i === activeIndex;
        const distKm = isRoundTrip ? s.distanceKm * 2 : s.distanceKm;
        const durationMin = isRoundTrip ? s.durationMinutes * 2 : s.durationMinutes;
        const deltaKm = fastest && s.id !== 'fastest'
          ? Math.round(s.distanceKm - fastest.distanceKm)
          : 0;

        return (
          <button
            key={s.id}
            onClick={() => onSelect(i)}
            className={`pointer-events-auto flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold border transition-all shadow-lg ${
              isActive
                ? 'bg-white text-gray-900 border-white/80 shadow-xl scale-105'
                : 'bg-black/60 text-white border-white/20 hover:bg-black/75 hover:scale-102 backdrop-blur-sm'
            }`}
          >
            <span>{s.emoji}</span>
            <span>{s.label}</span>
            <span className={`font-normal ${isActive ? 'text-gray-500' : 'text-gray-300'}`}>
              · {formatDistance(distKm, units)} · {formatDuration(durationMin)}
              {s.id !== 'fastest' && deltaKm > 0 && (
                <span className={isActive ? 'text-amber-600' : 'text-amber-300'}>
                  {' '}(+{deltaKm} km)
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
