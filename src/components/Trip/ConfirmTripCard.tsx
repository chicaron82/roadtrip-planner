import { useState, useEffect, useRef } from 'react';
import { Check, CheckCircle2, BookOpen, Pencil, Sparkles } from 'lucide-react';

interface ConfirmTripCardProps {
  confirmed: boolean;
  addedStopCount: number;
  totalDays: number;
  onConfirm: () => void;
  onUnconfirm: () => void;
  onGoToJournal?: () => void;
}

// ── tiny CSS-only confetti explosion ─────────────────────────────────────────
const CONFETTI_COLORS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16'];

function ConfettiBurst() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl" aria-hidden>
      {CONFETTI_COLORS.map((color, i) => (
        <span
          key={i}
          className="confetti-particle"
          style={{
            '--confetti-x': `${10 + i * 11}%`,
            '--confetti-color': color,
            '--confetti-delay': `${i * 70}ms`,
            '--confetti-rot': `${(i % 2 === 0 ? 1 : -1) * (200 + i * 40)}deg`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export function ConfirmTripCard({
  confirmed,
  addedStopCount,
  totalDays,
  onConfirm,
  onUnconfirm,
  onGoToJournal,
}: ConfirmTripCardProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const prevConfirmed = useRef(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (confirmed && !prevConfirmed.current) {
      t = setTimeout(() => {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1200);
      }, 0);
    }
    prevConfirmed.current = confirmed;
    return () => {
      if (t) clearTimeout(t);
    };
  }, [confirmed]);

  if (confirmed) {
    return (
      <div className="relative rounded-xl border-2 border-green-500/25 bg-green-500/10 p-5 text-center">
        {showConfetti && <ConfettiBurst />}
        <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-2">
          <CheckCircle2 className="h-5 w-5 text-green-400" />
        </div>
        <h3 className="font-bold text-green-400 mb-1">Trip Confirmed</h3>
        <p className="text-xs text-green-400/70 mb-3">
          Your plan is locked in. Ready to start capturing your trip?
        </p>
        <div className="flex items-center justify-center gap-3">
          {onGoToJournal && (
            <button
              onClick={onGoToJournal}
              className="inline-flex items-center gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
            >
              <BookOpen className="h-3 w-3" />
              Open Journal
            </button>
          )}
          <button
            onClick={onUnconfirm}
            className="inline-flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 font-medium transition-colors"
          >
            <Pencil className="h-3 w-3" />
            Modify Plan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-blue-500/25 bg-blue-500/8 p-5 text-center">
      <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center mx-auto mb-2">
        <Sparkles className="h-5 w-5 text-blue-400" />
      </div>
      <h3 className="font-bold text-blue-300 mb-1">Ready to go?</h3>
      <p className="text-xs text-blue-400 mb-1">
        {totalDays} day{totalDays !== 1 ? 's' : ''}
        {addedStopCount > 0 && ` · ${addedStopCount} stop${addedStopCount !== 1 ? 's' : ''} added`}
      </p>
      <p className="text-[11px] text-blue-400/60 mb-4">
        Confirm your plan to unlock the trip journal.
      </p>
      <button
        onClick={onConfirm}
        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm"
      >
        <Check className="h-4 w-4" />
        Confirm Trip
      </button>
    </div>
  );
}
