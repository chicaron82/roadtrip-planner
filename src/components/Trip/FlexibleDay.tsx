import { useState } from 'react';
import { Shuffle, Coffee, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { DayType, DayOption, TripDay } from '../../types';
import { cn } from '../../lib/utils';
import { Input } from '../UI/Input';

// Day type selector (planned / flexible / free)
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

// Free day card with notes
interface FreeDayCardProps {
  day: TripDay;
  onNotesChange: (notes: string) => void;
  onTitleChange: (title: string) => void;
  className?: string;
}

export function FreeDayCard({ day, onNotesChange, onTitleChange, className }: FreeDayCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div
      className={cn(
        'rounded-xl border-2 border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-white p-6 text-center',
        className
      )}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
          <Coffee className="h-8 w-8 text-gray-400" />
        </div>

        <div>
          {isEditing ? (
            <Input
              value={day.title || ''}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
              placeholder="Day title..."
              className="text-center font-semibold"
              autoFocus
            />
          ) : (
            <h3
              className="text-lg font-semibold text-gray-700 cursor-pointer hover:text-gray-900"
              onClick={() => setIsEditing(true)}
            >
              {day.title || 'Free Day'}
            </h3>
          )}
          <p className="text-sm text-gray-500">{day.dateFormatted}</p>
        </div>

        <p className="text-sm text-gray-600 italic">No fixed plans - enjoy the flexibility!</p>

        <textarea
          value={day.notes || ''}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Add notes... (weather-dependent plans, maybe-dos, etc.)"
          rows={3}
          className="w-full max-w-sm px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />

        <div className="flex gap-2 text-xs text-gray-500">
          <span className="px-2 py-1 bg-gray-100 rounded-full">💰 $0 budgeted</span>
          <span className="px-2 py-1 bg-gray-100 rounded-full">🚗 0 km</span>
        </div>
      </div>
    </div>
  );
}

// Flexible day with multiple options
interface FlexibleDayCardProps {
  day: TripDay;
  onSelectOption: (index: number) => void;
  onAddOption: (option: DayOption) => void;
  onRemoveOption: (index: number) => void;
  onNotesChange: (notes: string) => void;
  className?: string;
}

export function FlexibleDayCard({
  day,
  onSelectOption,
  onAddOption,
  onRemoveOption,
  onNotesChange,
  className,
}: FlexibleDayCardProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionDescription, setNewOptionDescription] = useState('');
  const [expanded, setExpanded] = useState(true);

  const options = day.options || [];
  const selectedIndex = day.selectedOption ?? 0;

  const handleAddOption = () => {
    if (!newOptionName.trim()) return;

    const newOption: DayOption = {
      id: `option-${Date.now()}`,
      name: newOptionName.trim(),
      description: newOptionDescription.trim() || undefined,
      segments: [],
      estimatedCost: 0,
      estimatedDuration: 0,
    };

    onAddOption(newOption);
    setNewOptionName('');
    setNewOptionDescription('');
    setShowAddForm(false);
  };

  return (
    <div className={cn('rounded-xl border-2 border-purple-200 bg-purple-50/50 overflow-hidden', className)}>
      {/* Header */}
      <div className="px-4 py-3 bg-purple-100/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shuffle className="h-4 w-4 text-purple-600" />
          <span className="font-medium text-purple-800">Flexible Day</span>
          <span className="text-sm text-purple-600">{day.dateFormatted}</span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="p-1 hover:bg-purple-200 rounded transition-colors"
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-purple-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-purple-600" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Options list */}
          <div className="space-y-2">
            {options.map((option, index) => (
              <div
                key={option.id}
                className={cn(
                  'p-3 rounded-lg border-2 cursor-pointer transition-all',
                  selectedIndex === index
                    ? 'border-purple-500 bg-white shadow-sm'
                    : 'border-gray-200 bg-white hover:border-purple-300'
                )}
                onClick={() => onSelectOption(index)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                          selectedIndex === index
                            ? 'border-purple-500 bg-purple-500'
                            : 'border-gray-300'
                        )}
                      >
                        {selectedIndex === index && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <span className="font-medium text-gray-800">{option.name}</span>
                    </div>
                    {option.description && (
                      <p className="text-sm text-gray-600 mt-1 ml-7">{option.description}</p>
                    )}
                    {option.highlights && option.highlights.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-2 ml-7">
                        {option.highlights.map((h, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs"
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveOption(index);
                    }}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Option stats */}
                <div className="flex gap-3 mt-2 ml-7 text-xs text-gray-500">
                  {option.estimatedCost !== undefined && option.estimatedCost > 0 && (
                    <span>💰 ${option.estimatedCost}</span>
                  )}
                  {option.estimatedDuration !== undefined && option.estimatedDuration > 0 && (
                    <span>⏱️ {Math.round(option.estimatedDuration / 60)}h</span>
                  )}
                </div>
              </div>
            ))}

            {/* Add option button/form */}
            {showAddForm ? (
              <div className="p-3 rounded-lg border-2 border-dashed border-purple-300 bg-white space-y-2">
                <Input
                  value={newOptionName}
                  onChange={(e) => setNewOptionName(e.target.value)}
                  placeholder="Option name (e.g., Gros Morne Day Trip)"
                  autoFocus
                />
                <Input
                  value={newOptionDescription}
                  onChange={(e) => setNewOptionDescription(e.target.value)}
                  placeholder="Description (optional)"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddOption}
                    disabled={!newOptionName.trim()}
                    className={cn(
                      'flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                      newOptionName.trim()
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    Add Option
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="w-full p-3 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Option
              </button>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Decision Notes</label>
            <textarea
              value={day.notes || ''}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="What factors will decide? (weather, energy level, etc.)"
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Day type badge for compact display
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
