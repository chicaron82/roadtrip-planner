import { useState } from 'react';
import { Clock, Fuel, Coffee, Utensils, UtensilsCrossed, Hotel, TrendingUp, TrendingDown } from 'lucide-react';
import { STOP_DURATIONS, STOP_LABELS } from '../../lib/calculations';
import type { StopType } from '../../types';

interface StopDurationPickerProps {
  value: StopType;
  onChange: (type: StopType) => void;
  showLabel?: boolean;
  compact?: boolean;
  showImpactPreview?: boolean;
}

const STOP_ICONS: Record<StopType, React.ComponentType<{ className?: string }>> = {
  drive: Clock,
  fuel: Fuel,
  break: Coffee,
  quickMeal: Utensils,
  meal: UtensilsCrossed,
  overnight: Hotel,
};

const STOP_COLORS: Record<StopType, string> = {
  drive: 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100',
  fuel: 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100',
  break: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
  quickMeal: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100',
  meal: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
  overnight: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100',
};

export function StopDurationPicker({
  value,
  onChange,
  showLabel = true,
  compact = false,
  showImpactPreview = true
}: StopDurationPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredType, setHoveredType] = useState<StopType | null>(null);

  const Icon = STOP_ICONS[value];
  const duration = STOP_DURATIONS[value];
  const label = STOP_LABELS[value];

  const availableOptions: StopType[] = ['fuel', 'break', 'quickMeal', 'meal', 'overnight'];

  const formatDuration = (minutes: number): string => {
    if (minutes >= 60) {
      const hours = minutes / 60;
      return hours >= 2 ? `${hours} hrs` : `${hours} hr`;
    }
    return `${minutes} min`;
  };

  const calculateImpact = (newType: StopType): { delta: number; isIncrease: boolean } => {
    const currentDuration = STOP_DURATIONS[value];
    const newDuration = STOP_DURATIONS[newType];
    const delta = newDuration - currentDuration;
    return { delta: Math.abs(delta), isIncrease: delta > 0 };
  };

  return (
    <div className="relative">
      {/* Current Selection Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all
          ${STOP_COLORS[value]}
          ${compact ? 'text-xs' : 'text-sm'}
          font-medium
        `}
      >
        <Icon className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
        {showLabel && <span>{label}</span>}
        <span className="opacity-70">• {formatDuration(duration)}</span>
        <Clock className={`${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} ml-auto opacity-50`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Options List */}
          <div className="absolute left-0 top-full mt-2 z-20 bg-white rounded-lg shadow-xl border-2 border-gray-100 min-w-[240px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-2 space-y-1">
              {availableOptions.map((type) => {
                const OptionIcon = STOP_ICONS[type];
                const optionDuration = STOP_DURATIONS[type];
                const optionLabel = STOP_LABELS[type];
                const isSelected = type === value;

                const impact = calculateImpact(type);
                const showImpact = showImpactPreview && !isSelected && impact.delta > 0;

                return (
                  <button
                    key={type}
                    onClick={() => {
                      onChange(type);
                      setIsOpen(false);
                      setHoveredType(null);
                    }}
                    onMouseEnter={() => setHoveredType(type)}
                    onMouseLeave={() => setHoveredType(null)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-left
                      ${isSelected
                        ? 'bg-blue-50 border-2 border-blue-200 text-blue-700 font-medium'
                        : 'bg-white border-2 border-transparent hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                      ${STOP_COLORS[type].split(' ')[0]}
                    `}>
                      <OptionIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{optionLabel}</div>
                      <div className="text-xs opacity-70 flex items-center gap-1.5">
                        <span>{formatDuration(optionDuration)} stop</span>
                        {showImpact && hoveredType === type && (
                          <span className={`inline-flex items-center gap-0.5 font-semibold ${
                            impact.isIncrease ? 'text-orange-600' : 'text-green-600'
                          }`}>
                            {impact.isIncrease ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {impact.isIncrease ? '+' : '-'}{formatDuration(impact.delta)}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Info Footer */}
            <div className="bg-gray-50 border-t border-gray-100 px-3 py-2">
              <div className="flex items-center gap-2 text-[10px] text-gray-600">
                <Clock className="h-3 w-3" />
                <span>Changing this will update arrival times</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
