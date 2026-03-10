import { useState } from 'react';
import { Shuffle, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { DayOption, TripDay } from '../../../types';
import { cn } from '../../../lib/utils';
import { Input } from '../../UI/Input';

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
                        {option.highlights.map((highlight, highlightIndex) => (
                          <span
                            key={highlightIndex}
                            className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs"
                          >
                            {highlight}
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