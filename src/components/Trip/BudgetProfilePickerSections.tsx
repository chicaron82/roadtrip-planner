import { Check, Clock, Star, Trash2 } from 'lucide-react';
import type { BudgetProfile, LastTripBudget, SavedBudgetProfile, TripBudget } from '../../types';
import { BUDGET_PROFILES } from '../../lib/budget';
import { cn } from '../../lib/utils';
import { Label } from '../UI/Label';

interface QuickRecallSectionProps {
  lastTripBudget: LastTripBudget;
  onSelect: () => void;
}

export function QuickRecallSection({ lastTripBudget, onSelect }: QuickRecallSectionProps) {
  return (
    <div>
      <Label className="text-xs text-gray-500 mb-2 block">Quick Recall</Label>
      <button
        onClick={onSelect}
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
          <div className="text-sm font-medium text-gray-700 truncate">{lastTripBudget.tripName}</div>
          <div className="text-xs text-gray-500">
            ${lastTripBudget.budget.total} · {lastTripBudget.numTravelers} traveler{lastTripBudget.numTravelers !== 1 ? 's' : ''} · {formatRelativeTime(lastTripBudget.tripDate)}
          </div>
        </div>
        <span className="text-xs text-blue-600 font-medium">Use</span>
      </button>
    </div>
  );
}

interface SavedProfilesSectionProps {
  savedProfiles: SavedBudgetProfile[];
  deleteConfirmId: string | null;
  onSelectProfile: (profile: SavedBudgetProfile) => void;
  onToggleDefault: (id: string, e: React.MouseEvent) => void;
  onDeleteProfile: (id: string, e: React.MouseEvent) => void;
}

export function SavedProfilesSection({
  savedProfiles,
  deleteConfirmId,
  onSelectProfile,
  onToggleDefault,
  onDeleteProfile,
}: SavedProfilesSectionProps) {
  if (savedProfiles.length === 0) return null;

  return (
    <div>
      <Label className="text-xs text-gray-500 mb-2 block">My Profiles</Label>
      <div className="space-y-2">
        {sortSavedProfiles(savedProfiles).map((profile) => (
          <div
            key={profile.id}
            onClick={() => onSelectProfile(profile)}
            className={cn(
              'p-3 rounded-lg border-2 cursor-pointer transition-all',
              'hover:border-green-400 hover:bg-green-50/50',
              profile.isDefault ? 'border-green-300 bg-green-50/30' : 'border-gray-200'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">{profile.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 truncate">{profile.name}</span>
                  {profile.isDefault && <span className="text-xs text-green-600 font-medium">Default</span>}
                </div>
                <div className="text-xs text-gray-500">
                  Based on {BUDGET_PROFILES[profile.baseProfile].label}
                  {profile.stats?.timesUsed && profile.stats.timesUsed > 0 && <> · Used {profile.stats.timesUsed}x</>}
                  {profile.numTravelers && <> · {profile.numTravelers} traveler{profile.numTravelers !== 1 ? 's' : ''}</>}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => onToggleDefault(profile.id, e)}
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
                  onClick={(e) => onDeleteProfile(profile.id, e)}
                  className={cn(
                    'p-1.5 rounded-md transition-colors',
                    deleteConfirmId === profile.id
                      ? 'text-red-600 bg-red-50'
                      : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                  )}
                  title={deleteConfirmId === profile.id ? 'Click again to confirm' : 'Delete profile'}
                >
                  {deleteConfirmId === profile.id ? <Check className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </div>

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
  );
}

interface SystemProfilesSectionProps {
  currentBudget: TripBudget;
  systemProfiles: BudgetProfile[];
  onSelectProfile: (profile: BudgetProfile) => void;
}

export function SystemProfilesSection({
  currentBudget,
  systemProfiles,
  onSelectProfile,
}: SystemProfilesSectionProps) {
  return (
    <div>
      <Label className="text-xs text-gray-500 mb-2 block">Budget Style</Label>
      <div className="grid grid-cols-4 gap-2">
        {systemProfiles.map((profile) => {
          const { emoji, label } = BUDGET_PROFILES[profile];
          const isSelected = currentBudget.profile === profile;
          return (
            <button
              key={profile}
              onClick={() => onSelectProfile(profile)}
              className={cn(
                'p-2 rounded-lg border-2 text-center transition-all',
                isSelected
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              )}
            >
              <div className="text-lg">{emoji}</div>
              <div className={cn('text-[10px] font-medium', isSelected ? 'text-green-700' : 'text-gray-600')}>
                {label}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-500 mt-1.5 text-center">
        {BUDGET_PROFILES[currentBudget.profile].description}
      </p>
    </div>
  );
}

function formatRelativeTime(dateStr?: string): string {
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
}

function sortSavedProfiles(savedProfiles: SavedBudgetProfile[]): SavedBudgetProfile[] {
  return [...savedProfiles].sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    const aTime = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
    const bTime = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
    return bTime - aTime;
  });
}