import { Check, CheckCircle2, BookOpen, Pencil, Sparkles } from 'lucide-react';

interface ConfirmTripCardProps {
  confirmed: boolean;
  addedStopCount: number;
  totalDays: number;
  onConfirm: () => void;
  onUnconfirm: () => void;
  onGoToJournal?: () => void;
}

export function ConfirmTripCard({
  confirmed,
  addedStopCount,
  totalDays,
  onConfirm,
  onUnconfirm,
  onGoToJournal,
}: ConfirmTripCardProps) {
  if (confirmed) {
    return (
      <div className="rounded-xl border-2 border-green-200 bg-green-50/60 p-5 text-center">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        </div>
        <h3 className="font-bold text-green-900 mb-1">Trip Confirmed</h3>
        <p className="text-xs text-green-700 mb-3">
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
            className="inline-flex items-center gap-1.5 text-xs text-green-600 hover:text-green-800 font-medium transition-colors"
          >
            <Pencil className="h-3 w-3" />
            Modify Plan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-5 text-center">
      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
        <Sparkles className="h-5 w-5 text-blue-600" />
      </div>
      <h3 className="font-bold text-blue-900 mb-1">Ready to go?</h3>
      <p className="text-xs text-blue-700 mb-1">
        {totalDays} day{totalDays !== 1 ? 's' : ''}
        {addedStopCount > 0 && ` · ${addedStopCount} stop${addedStopCount !== 1 ? 's' : ''} added`}
      </p>
      <p className="text-[11px] text-blue-500 mb-4">
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
