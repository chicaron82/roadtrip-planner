import { useState } from 'react';
import { Star, Trash2 } from 'lucide-react';
import {
  getBudgetProfiles,
  removeBudgetProfile,
  setDefaultBudgetProfile,
} from '../../lib/storage';
import type { SavedBudgetProfile } from '../../types/core';

// isDefault is written by setDefaultBudgetProfile into each profile's stored JSON
type ProfileWithDefault = SavedBudgetProfile & { isDefault?: boolean };

export function BudgetProfilesSection() {
  const [profiles, setProfiles] = useState<ProfileWithDefault[]>(
    () => getBudgetProfiles() as ProfileWithDefault[],
  );
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleSetDefault = (id: string) => {
    setDefaultBudgetProfile(id);
    setProfiles(getBudgetProfiles() as ProfileWithDefault[]);
  };

  const handleDelete = (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    removeBudgetProfile(id);
    setProfiles(getBudgetProfiles() as ProfileWithDefault[]);
    setConfirmDelete(null);
  };

  if (profiles.length === 0) {
    return (
      <p className="text-xs text-zinc-500 italic">
        No saved profiles yet — save one from Step 3.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {profiles.map((profile) => (
        <div key={profile.id} className="flex items-center justify-between gap-2">
          {/* Profile info */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base">{profile.emoji}</span>
            <div className="min-w-0">
              <p className="text-sm text-zinc-200 font-medium truncate">{profile.name}</p>
              <p className="text-xs text-zinc-500 capitalize">{profile.baseProfile}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Star — set as default */}
            <button
              onClick={() => handleSetDefault(profile.id)}
              aria-label={profile.isDefault ? 'Default profile' : 'Set as default'}
              title={profile.isDefault ? 'Default profile' : 'Set as default'}
              className={`p-1.5 rounded-lg transition-colors ${
                profile.isDefault
                  ? 'text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Star size={13} fill={profile.isDefault ? 'currentColor' : 'none'} />
            </button>

            {/* Delete — two-tap confirmation */}
            {confirmDelete === profile.id ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDelete(profile.id)}
                  className="px-2 py-1 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  Confirm?
                </button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="text-xs text-zinc-400 hover:text-zinc-200 underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleDelete(profile.id)}
                aria-label="Delete profile"
                className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      ))}
      <p className="text-xs text-zinc-600 italic pt-1">
        Save profiles from Step 3 during trip planning.
      </p>
    </div>
  );
}
