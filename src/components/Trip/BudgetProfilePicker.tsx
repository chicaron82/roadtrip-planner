import { useState } from 'react';
import { Star, Clock, Trash2, Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { SavedBudgetProfile, BudgetProfile, TripBudget, LastTripBudget } from '../../types';
import { BUDGET_PROFILES } from '../../lib/budget';
import {
  getBudgetProfiles,
  saveBudgetProfile,
  removeBudgetProfile,
  setDefaultBudgetProfile,
  getLastTripBudget,
} from '../../lib/storage';
import { cn } from '../../lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../UI/Dialog';
import { Input } from '../UI/Input';
import { Label } from '../UI/Label';

// Common emojis for budget profiles
const EMOJI_OPTIONS = ['💰', '🎒', '🍜', '🏔️', '✨', '👨‍👩‍👧‍👦', '🏕️', '🍷', '🎯', '🌴', '🚗', '💼'];

interface BudgetProfilePickerProps {
  currentBudget: TripBudget;
  numTravelers: number;
  onSelectProfile: (budget: TripBudget) => void;
  onSelectSavedProfile: (profile: SavedBudgetProfile) => void;
  className?: string;
}

export function BudgetProfilePicker({
  currentBudget,
  numTravelers: _numTravelers,
  onSelectProfile,
  onSelectSavedProfile,
  className,
}: BudgetProfilePickerProps) {
  const [savedProfiles, setSavedProfiles] = useState<SavedBudgetProfile[]>(getBudgetProfiles());
  const [lastTripBudget] = useState<LastTripBudget | null>(getLastTripBudget());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showAllProfiles, setShowAllProfiles] = useState(false);

  // Format relative time
  const formatRelativeTime = (dateStr?: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  // Handle selecting a system profile
  const handleSelectSystemProfile = (profile: BudgetProfile) => {
    const profileData = BUDGET_PROFILES[profile];
    onSelectProfile({
      ...currentBudget,
      profile,
      weights: profileData.weights,
    });
  };

  // Handle selecting a saved profile
  const handleSelectSavedProfile = (profile: SavedBudgetProfile) => {
    onSelectSavedProfile(profile);
  };

  // Handle selecting last trip budget
  const handleSelectLastTrip = () => {
    if (lastTripBudget) {
      onSelectProfile(lastTripBudget.budget);
    }
  };

  // Toggle default profile
  const handleToggleDefault = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDefaultBudgetProfile(id);
    setSavedProfiles(getBudgetProfiles());
  };

  // Delete profile
  const handleDeleteProfile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteConfirmId === id) {
      removeBudgetProfile(id);
      setSavedProfiles(getBudgetProfiles());
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
    }
  };

  const systemProfiles = Object.keys(BUDGET_PROFILES) as BudgetProfile[];

  return (
    <div className={cn('space-y-4', className)}>
      {/* Last Trip Recall (Ghost Profile) */}
      {lastTripBudget && (
        <div>
          <Label className="text-xs text-gray-500 mb-2 block">Quick Recall</Label>
          <button
            onClick={handleSelectLastTrip}
            className={cn(
              'w-full p-3 rounded-lg border-2 border-dashed text-left transition-all',
              'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50',
              'flex items-center gap-3'
            )}
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100">
              <Clock className="h-5 w-5 text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-700 truncate">
                {lastTripBudget.tripName}
              </div>
              <div className="text-xs text-gray-500">
                ${lastTripBudget.budget.total} · {lastTripBudget.numTravelers} traveler{lastTripBudget.numTravelers !== 1 ? 's' : ''} · {formatRelativeTime(lastTripBudget.tripDate)}
              </div>
            </div>
            <span className="text-xs text-blue-600 font-medium">Use</span>
          </button>
        </div>
      )}

      {/* Saved Profiles */}
      {savedProfiles.length > 0 && (
        <div>
          <Label className="text-xs text-gray-500 mb-2 block">My Profiles</Label>
          <div className="space-y-2">
            {savedProfiles
              .sort((a, b) => {
                // Default first, then by recency
                if (a.isDefault && !b.isDefault) return -1;
                if (!a.isDefault && b.isDefault) return 1;
                const aTime = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
                const bTime = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
                return bTime - aTime;
              })
              .map((profile) => (
                <div
                  key={profile.id}
                  onClick={() => handleSelectSavedProfile(profile)}
                  className={cn(
                    'p-3 rounded-lg border-2 cursor-pointer transition-all',
                    'hover:border-green-400 hover:bg-green-50/50',
                    profile.isDefault
                      ? 'border-green-300 bg-green-50/30'
                      : 'border-gray-200'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{profile.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700 truncate">
                          {profile.name}
                        </span>
                        {profile.isDefault && (
                          <span className="text-xs text-green-600 font-medium">Default</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        Based on {BUDGET_PROFILES[profile.baseProfile].label}
                        {profile.stats?.timesUsed && profile.stats.timesUsed > 0 && (
                          <> · Used {profile.stats.timesUsed}x</>
                        )}
                        {profile.numTravelers && (
                          <> · {profile.numTravelers} traveler{profile.numTravelers !== 1 ? 's' : ''}</>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleToggleDefault(profile.id, e)}
                        className={cn(
                          'p-1.5 rounded-md transition-colors',
                          profile.isDefault
                            ? 'text-yellow-500'
                            : 'text-gray-300 hover:text-yellow-500 hover:bg-yellow-50'
                        )}
                        title={profile.isDefault ? 'Default profile' : 'Set as default'}
                      >
                        <Star className="h-4 w-4" fill={profile.isDefault ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteProfile(profile.id, e)}
                        className={cn(
                          'p-1.5 rounded-md transition-colors',
                          deleteConfirmId === profile.id
                            ? 'text-red-600 bg-red-50'
                            : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                        )}
                        title={deleteConfirmId === profile.id ? 'Click again to confirm' : 'Delete profile'}
                      >
                        {deleteConfirmId === profile.id ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Weight bar preview */}
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden flex bg-gray-200">
                    <div className="bg-orange-400" style={{ width: `${profile.weights.gas}%` }} />
                    <div className="bg-blue-400" style={{ width: `${profile.weights.hotel}%` }} />
                    <div className="bg-green-400" style={{ width: `${profile.weights.food}%` }} />
                    <div className="bg-purple-400" style={{ width: `${profile.weights.misc}%` }} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* System Profiles */}
      <div>
        <Label className="text-xs text-gray-500 mb-2 block">Budget Style</Label>
        {(() => {
          // Core profiles: Backpacker (budget) → Balanced (mid) → Comfort (splurge)
          const coreProfiles: BudgetProfile[] = ['backpacker', 'balanced', 'comfort'];
          const extraProfiles: BudgetProfile[] = ['foodie', 'scenic', 'custom'];

          // If current selection is in extras and not expanded, show it
          const currentIsExtra = extraProfiles.includes(currentBudget.profile) && currentBudget.profile !== 'custom';
          const visibleProfiles = showAllProfiles
            ? systemProfiles
            : currentIsExtra
              ? [...coreProfiles, currentBudget.profile]
              : coreProfiles;

          return (
            <>
              <div className={cn(
                'grid gap-2',
                showAllProfiles ? 'grid-cols-3 md:grid-cols-6' : 'grid-cols-3'
              )}>
                {visibleProfiles.map((profile) => {
                  const { emoji, label } = BUDGET_PROFILES[profile];
                  const isSelected = currentBudget.profile === profile;
                  return (
                    <button
                      key={profile}
                      onClick={() => handleSelectSystemProfile(profile)}
                      className={cn(
                        'p-2 rounded-lg border-2 text-center transition-all',
                        isSelected
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      )}
                    >
                      <div className="text-lg">{emoji}</div>
                      <div
                        className={cn(
                          'text-[10px] font-medium',
                          isSelected ? 'text-green-700' : 'text-gray-600'
                        )}
                      >
                        {label}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Expand/Collapse button */}
              {!showAllProfiles && (
                <button
                  onClick={() => setShowAllProfiles(true)}
                  className="w-full mt-2 flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors py-1"
                >
                  <ChevronDown className="h-3 w-3" />
                  More styles (Foodie, Scenic, Custom)
                </button>
              )}
              {showAllProfiles && (
                <button
                  onClick={() => setShowAllProfiles(false)}
                  className="w-full mt-2 flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors py-1"
                >
                  <ChevronUp className="h-3 w-3" />
                  Show less
                </button>
              )}
            </>
          );
        })()}
        <p className="text-[10px] text-gray-500 mt-1.5 text-center">
          {BUDGET_PROFILES[currentBudget.profile].description}
        </p>
      </div>
    </div>
  );
}

// Save Profile Dialog
interface SaveProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: TripBudget;
  numTravelers: number;
  tripName?: string;
  onSave: (profile: SavedBudgetProfile) => void;
}

export function SaveProfileDialog({
  open,
  onOpenChange,
  budget,
  numTravelers,
  tripName,
  onSave,
}: SaveProfileDialogProps) {
  const [name, setName] = useState(tripName || '');
  const [emoji, setEmoji] = useState(BUDGET_PROFILES[budget.profile].emoji);
  const [miscLabel, setMiscLabel] = useState('');

  const handleSave = () => {
    if (!name.trim()) return;

    const profile: SavedBudgetProfile = {
      id: `profile_${Date.now()}`,
      name: name.trim(),
      emoji,
      baseProfile: budget.profile === 'custom' ? 'balanced' : budget.profile,
      weights: budget.weights,
      allocation: budget.allocation,
      defaultTotal: budget.total > 0 ? budget.total : undefined,
      numTravelers,
      categoryLabels: miscLabel ? { misc: miscLabel } : undefined,
      stats: {
        timesUsed: 1,
        lastTripName: tripName,
        lastTripDate: new Date().toISOString(),
      },
      createdFrom: tripName
        ? { tripName, tripDate: new Date().toISOString().split('T')[0] }
        : undefined,
    };

    saveBudgetProfile(profile);
    onSave(profile);
    onOpenChange(false);

    // Reset form
    setName('');
    setEmoji(BUDGET_PROFILES[budget.profile].emoji);
    setMiscLabel('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Save Budget Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="profile-name">Profile Name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Solo Foodie Adventure"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>

          {/* Emoji Picker */}
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={cn(
                    'w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all',
                    emoji === e
                      ? 'bg-green-100 border-2 border-green-500'
                      : 'bg-gray-50 border border-gray-200 hover:border-gray-300'
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Misc Label */}
          <div className="space-y-2">
            <Label htmlFor="misc-label">Rename "Misc" category (optional)</Label>
            <Input
              id="misc-label"
              value={miscLabel}
              onChange={(e) => setMiscLabel(e.target.value)}
              placeholder="Activities, Experiences, etc."
            />
          </div>

          {/* Preview */}
          <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{emoji}</span>
              <span className="font-medium text-gray-700">{name || 'Profile Name'}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden flex bg-gray-200">
              <div className="bg-orange-400" style={{ width: `${budget.weights.gas}%` }} />
              <div className="bg-blue-400" style={{ width: `${budget.weights.hotel}%` }} />
              <div className="bg-green-400" style={{ width: `${budget.weights.food}%` }} />
              <div className="bg-purple-400" style={{ width: `${budget.weights.misc}%` }} />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-gray-500">
              <span>Gas {budget.weights.gas}%</span>
              <span>Hotel {budget.weights.hotel}%</span>
              <span>Food {budget.weights.food}%</span>
              <span>{miscLabel || 'Misc'} {budget.weights.misc}%</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => onOpenChange(false)}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className={cn(
                'flex-1 px-4 py-2 rounded-lg font-medium transition-colors',
                name.trim()
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              )}
            >
              Save Profile
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
