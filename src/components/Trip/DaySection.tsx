import type { TripDay, DayType, DayOption, BudgetMode } from '../../types';
import { DayHeader } from './DayHeader';
import { DailyBudgetCard } from './DailyBudgetCard';
import { FreeDayCard, FlexibleDayCard } from './FlexibleDay';

// ==================== TYPES ====================

interface DaySectionProps {
  day: TripDay;
  isFirst: boolean;
  editable: boolean;
  budgetMode: BudgetMode;
  // Day type handlers
  onDayTypeChange?: (dayNumber: number, type: DayType) => void;
  onTitleChange?: (dayNumber: number, title: string) => void;
  onNotesChange?: (dayNumber: number, notes: string) => void;
  // Flexible day handlers
  onAddDayOption?: (dayNumber: number, option: DayOption) => void;
  onRemoveDayOption?: (dayNumber: number, optionIndex: number) => void;
  onSelectDayOption?: (dayNumber: number, optionIndex: number) => void;
  // Overnight hotel editing
  onEditOvernight?: (dayNumber: number) => void;
  // Number of nights at the overnight stop (derived from next driving day's date)
  overnightNights?: number;
  // Add an activity directly to this day (for Free Days)
  onAddDayActivity?: (dayNumber: number) => void;
}

// ==================== COMPONENT ====================

export function DaySection({
  day,
  isFirst,
  editable,
  budgetMode,
  onDayTypeChange,
  onTitleChange,
  onNotesChange,
  onAddDayOption,
  onRemoveDayOption,
  onSelectDayOption,
  onEditOvernight,
  overnightNights,
  onAddDayActivity,
}: DaySectionProps) {
  const dayType = day.dayType || 'planned';

  return (
    <div>
      {/* Day Header (always shown) */}
      <DayHeader
        day={day}
        isFirst={isFirst}
        editable={editable}
        overnightNights={overnightNights}
        onDayTypeChange={onDayTypeChange}
        onTitleChange={onTitleChange}
        onEditOvernight={onEditOvernight}
      />

      {/* Per-day notes (all day types when editable) */}
      {editable && onNotesChange && dayType === 'planned' && (
        <NotesSection
          notes={day.notes}
          onChange={(notes) => onNotesChange(day.dayNumber, notes)}
        />
      )}

      {/* Day-type-specific content */}
      {dayType === 'free' && onNotesChange && onTitleChange && (
        <FreeDayCard
          day={day}
          onNotesChange={(notes) => onNotesChange(day.dayNumber, notes)}
          onTitleChange={(title) => onTitleChange(day.dayNumber, title)}
        />
      )}

      {dayType === 'flexible' && onAddDayOption && onRemoveDayOption && onSelectDayOption && onNotesChange && (
        <FlexibleDayCard
          day={day}
          onSelectOption={(idx) => onSelectDayOption(day.dayNumber, idx)}
          onAddOption={(opt) => onAddDayOption(day.dayNumber, opt)}
          onRemoveOption={(idx) => onRemoveDayOption(day.dayNumber, idx)}
          onNotesChange={(notes) => onNotesChange(day.dayNumber, notes)}
        />
      )}

      {/* Add Activity Button for Free/Flexible Days */}
      {(dayType === 'free' || dayType === 'flexible') && onAddDayActivity && (
        <div className="mb-4 flex justify-center">
          <button
            type="button"
            onClick={() => onAddDayActivity(day.dayNumber)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-colors"
          >
            <span>➕</span> Add Activity
          </button>
        </div>
      )}

      {/* Daily Budget */}
      <DailyBudgetCard
        budget={day.budget}
        dayNumber={day.dayNumber}
        budgetMode={budgetMode}
      />
    </div>
  );
}

// ==================== NOTES SECTION (planned days) ====================

interface NotesSectionProps {
  notes?: string;
  onChange: (notes: string) => void;
}

function NotesSection({ notes, onChange }: NotesSectionProps) {
  const hasNotes = notes && notes.trim().length > 0;

  if (!hasNotes) {
    return (
      <button
        type="button"
        onClick={() => onChange(' ')}
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
      >
        📝 Add Notes
      </button>
    );
  }

  return (
    <div className="mb-4">
      <textarea
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Day notes..."
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 bg-white/80"
        rows={2}
      />
    </div>
  );
}
