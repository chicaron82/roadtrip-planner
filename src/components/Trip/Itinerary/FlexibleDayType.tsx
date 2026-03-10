import { cn } from '../../../lib/utils';
import type { DayType } from '../../../types';

interface DayTypeToggleProps {
  dayType: DayType;
  onChange: (type: DayType) => void;
  className?: string;
}

export function DayTypeToggle({ dayType, onChange, className }: DayTypeToggleProps) {
  const types: { value: DayType; label: string; emoji: string; description: string }[] = [
    { value: 'planned', label: 'Planned', emoji: '📋', description: 'Fixed itinerary' },
    { value: 'flexible', label: 'Flexible', emoji: '🔀', description: 'Multiple options' },
    { value: 'free', label: 'Free', emoji: '☕', description: 'No fixed plans' },
  ];

  return (
    <div className={cn('flex gap-1 p-1 bg-gray-100 rounded-lg', className)}>
      {types.map((type) => (
        <button
          key={type.value}
          type="button"
          onClick={() => onChange(type.value)}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
            dayType === type.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          )}
          title={type.description}
        >
          <span>{type.emoji}</span>
          <span className="hidden sm:inline">{type.label}</span>
        </button>
      ))}
    </div>
  );
}

interface DayTypeBadgeProps {
  dayType: DayType;
  className?: string;
}

export function DayTypeBadge({ dayType, className }: DayTypeBadgeProps) {
  const config = {
    planned: { emoji: '📋', label: 'Planned', color: 'bg-blue-100 text-blue-700' },
    flexible: { emoji: '🔀', label: 'Flexible', color: 'bg-purple-100 text-purple-700' },
    free: { emoji: '☕', label: 'Free', color: 'bg-gray-100 text-gray-600' },
  };

  const { emoji, label, color } = config[dayType];

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', color, className)}>
      <span>{emoji}</span>
      <span>{label}</span>
    </span>
  );
}