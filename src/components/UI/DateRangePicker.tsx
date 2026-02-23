/**
 * DateRangePicker — two-month side-by-side calendar (single on mobile).
 *
 * UX flow:
 *   1. Click trigger → panel opens
 *   2. Click first day  → departure set, hover shows live range fill
 *   3. Click second day → return set, panel closes
 *   4. Clicked before start while picking end → resets start to that day
 *   5. When both are done, clicking any day resets the whole selection
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Plane, PlaneLanding, X } from 'lucide-react';
import { cn } from '../../lib/utils';

// ==================== HELPERS ====================

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fromYMD(ymd: string): Date {
  return new Date(ymd + 'T00:00:00');
}

function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function formatShort(ymd: string): string {
  return fromYMD(ymd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function nightsCount(start: string, end: string): number {
  return Math.round((fromYMD(end).getTime() - fromYMD(start).getTime()) / 86_400_000);
}

// ==================== MONTH PANEL ====================

interface MonthPanelProps {
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  effectiveEnd: string;
  phase: 'start' | 'end' | 'done';
  today: string;
  minDate: string;
  onDayClick: (ymd: string) => void;
  onDayHover: (ymd: string | null) => void;
}

function MonthPanel({
  year, month,
  startDate, endDate, effectiveEnd,
  phase, today, minDate,
  onDayClick, onDayHover,
}: MonthPanelProps) {
  const days = getDaysInMonth(year, month);
  const firstDow = days[0].getDay();

  return (
    <div className="flex-1 min-w-0">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_OF_WEEK.map(d => (
          <div
            key={d}
            className="h-7 flex items-center justify-center text-[10px] font-semibold tracking-wider text-muted-foreground/70"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {Array.from({ length: firstDow }).map((_, i) => <div key={`b${i}`} />)}
        {days.map(day => {
          const ymd = toYMD(day);
          const disabled = ymd < minDate;
          const isStart  = ymd === startDate;
          const isEnd    = endDate ? ymd === endDate : (phase === 'end' && ymd === effectiveEnd);
          const inRange  = !!(startDate && effectiveEnd && ymd > startDate && ymd < effectiveEnd);
          const isToday  = ymd === today;

          return (
            <div
              key={ymd}
              onClick={() => !disabled && onDayClick(ymd)}
              onMouseEnter={() => !disabled && onDayHover(ymd)}
              onMouseLeave={() => onDayHover(null)}
              className={cn(
                'relative h-8 flex items-center justify-center text-[13px] transition-colors',
                disabled ? 'text-muted-foreground/25 cursor-not-allowed' : 'cursor-pointer',
                inRange && !disabled && 'bg-primary/12',
                isStart && !disabled && 'bg-primary/12 rounded-l-full',
                isEnd && !isStart && !disabled && 'bg-primary/12 rounded-r-full',
                isStart && isEnd && !disabled && 'rounded-full',
              )}
            >
              <span
                className={cn(
                  'z-10 h-7 w-7 flex items-center justify-center rounded-full transition-colors font-medium',
                  isStart && !disabled && 'bg-primary text-primary-foreground shadow-sm',
                  isEnd && !disabled && 'bg-primary text-primary-foreground shadow-sm',
                  !isStart && !isEnd && !disabled && 'hover:bg-muted',
                  isToday && !isStart && !isEnd && 'ring-1 ring-primary/50',
                )}
              >
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  minDate?: string;
  label?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  minDate,
  label = 'Travel Dates',
}: DateRangePickerProps) {
  const today    = toYMD(new Date());
  const minBound = minDate ?? today;

  const [leftMonth, setLeftMonth] = useState<Date>(() =>
    startDate ? fromYMD(startDate) : (minBound ? fromYMD(minBound) : new Date())
  );
  const [isOpen, setIsOpen]       = useState(false);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const panelRef                  = useRef<HTMLDivElement>(null);

  const phase: 'start' | 'end' | 'done' = !startDate ? 'start' : !endDate ? 'end' : 'done';

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const prevMonth = useCallback(() => setLeftMonth(d => addMonths(d, -1)), []);
  const nextMonth = useCallback(() => setLeftMonth(d => addMonths(d,  1)), []);

  const handleDayClick = useCallback((ymd: string) => {
    if (phase === 'done') { onChange(ymd, ''); return; }
    if (phase === 'start') { onChange(ymd, ''); return; }
    // phase === 'end'
    if (ymd < startDate) { onChange(ymd, ''); return; }
    onChange(startDate, ymd);
    setHoverDate(null);
    setIsOpen(false);
  }, [phase, startDate, onChange]);

  const handleDayHover = useCallback((ymd: string | null) => {
    if (phase === 'end') setHoverDate(ymd);
  }, [phase]);

  const handleClear = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    onChange('', '');
    setIsOpen(true);
  }, [onChange]);

  const effectiveEnd = phase === 'end' ? (hoverDate ?? '') : endDate;
  const nights = startDate && endDate ? nightsCount(startDate, endDate) : null;

  const phaseHint = phase === 'start'
    ? 'Select your departure date'
    : phase === 'end'
    ? 'Now select your return date'
    : `${nights} night${nights !== 1 ? 's' : ''} · click any date to change`;

  const sharedPanelProps = {
    startDate, endDate, effectiveEnd, phase, today, minDate: minBound,
    onDayClick: handleDayClick, onDayHover: handleDayHover,
  };

  return (
    <div className="w-full relative" ref={panelRef}>
      {label && <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>}

      {/* ── Trigger ── */}
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        className={cn(
          'w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-sm text-left',
          'bg-background transition-all duration-150',
          isOpen
            ? 'border-primary ring-2 ring-primary/20'
            : 'border-input hover:border-primary/40 hover:shadow-sm',
        )}
      >
        <CalendarDays className={cn('h-4 w-4 shrink-0', startDate ? 'text-primary' : 'text-muted-foreground')} />

        {startDate ? (
          <div className="flex-1 flex items-center gap-2 overflow-hidden">
            <div className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap">
              <Plane className="h-3 w-3" />
              {formatShort(startDate)}
            </div>
            {endDate ? (
              <>
                <span className="text-muted-foreground/50 text-xs">→</span>
                <div className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap">
                  <PlaneLanding className="h-3 w-3" />
                  {formatShort(endDate)}
                </div>
                <span className="text-[11px] text-muted-foreground ml-1 whitespace-nowrap">
                  {nights}n
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground italic">pick return →</span>
            )}
          </div>
        ) : (
          <span className="flex-1 text-muted-foreground">Select dates</span>
        )}

        {(startDate || endDate) && (
          <div
            role="button"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={(e) => e.key === 'Enter' && handleClear(e)}
            className="shrink-0 h-5 w-5 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Clear dates"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </div>
        )}
      </button>

      {/* ── Calendar panel ── */}
      {isOpen && (
        <div className="absolute left-0 z-50 mt-2 border border-border rounded-2xl bg-background shadow-xl overflow-hidden" style={{ width: '300px' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/30">
            <button
              type="button"
              onClick={prevMonth}
              className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="text-sm font-semibold">
              {MONTHS[leftMonth.getMonth()]} {leftMonth.getFullYear()}
            </span>

            <button
              type="button"
              onClick={nextMonth}
              className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Month grid */}
          <div className="px-4 pt-3 pb-2">
            <MonthPanel year={leftMonth.getFullYear()} month={leftMonth.getMonth()} {...sharedPanelProps} />
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2.5 border-t border-border/60 bg-muted/20 flex items-center justify-center">
            <p className="text-[11px] text-muted-foreground">{phaseHint}</p>
          </div>
        </div>
      )}
    </div>
  );
}
