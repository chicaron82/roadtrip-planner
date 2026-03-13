import { useState } from 'react';
import { Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { getHistory, clearHistory } from '../../lib/storage';
import { clearUserProfile } from '../../lib/user-profile';

interface PrivacySectionProps {
  includeStartingLocation: boolean;
  onIncludeStartingLocationChange: (value: boolean) => void;
}

export function PrivacySection({ includeStartingLocation, onIncludeStartingLocationChange }: PrivacySectionProps) {
  const [historyCount, setHistoryCount] = useState(() => getHistory().length);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const handleClearHistory = () => {
    clearHistory();
    setHistoryCount(0);
  };

  const handleResetProfile = () => {
    clearUserProfile();
  };

  const handleClearAll = () => {
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      return;
    }
    localStorage.clear();
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      {/* Include starting location toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-200 font-medium">Include starting city in trip</p>
          <p className="text-xs text-zinc-500 mt-0.5">Counts your home city as a stop when saving history</p>
        </div>
        <button
          role="switch"
          aria-checked={includeStartingLocation}
          onClick={() => onIncludeStartingLocationChange(!includeStartingLocation)}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            includeStartingLocation ? 'bg-sky-500' : 'bg-zinc-600'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              includeStartingLocation ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div className="border-t border-zinc-700 pt-4 space-y-3">
        {/* Trip history */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-200 font-medium">Trip history</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {historyCount === 0 ? 'No trips saved' : `${historyCount} trip${historyCount !== 1 ? 's' : ''} saved`}
            </p>
          </div>
          <button
            onClick={handleClearHistory}
            disabled={historyCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-700 text-zinc-300 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 size={12} />
            Clear
          </button>
        </div>

        {/* Adaptive profile */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-200 font-medium">Adaptive profile</p>
            <p className="text-xs text-zinc-500 mt-0.5">Resets learned preferences</p>
          </div>
          <button
            onClick={handleResetProfile}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
          >
            <RefreshCw size={12} />
            Reset
          </button>
        </div>

        {/* Nuclear clear */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-200 font-medium">All app data</p>
            <p className="text-xs text-zinc-500 mt-0.5">Removes everything — favorites, vehicles, settings</p>
          </div>
          <button
            onClick={handleClearAll}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              confirmClearAll
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            }`}
          >
            <AlertTriangle size={12} />
            {confirmClearAll ? 'Confirm?' : 'Clear all'}
          </button>
        </div>
        {confirmClearAll && (
          <button
            onClick={() => setConfirmClearAll(false)}
            className="text-xs text-zinc-400 hover:text-zinc-200 underline"
          >
            Cancel
          </button>
        )}
      </div>

      <p className="text-xs text-zinc-600 italic">All data stays on your device — nothing leaves your browser.</p>
    </div>
  );
}
