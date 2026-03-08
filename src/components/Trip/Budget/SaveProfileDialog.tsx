import { useState } from 'react';
import type { SavedBudgetProfile, TripBudget } from '../../../types';
import { BUDGET_PROFILES } from '../../../lib/budget';
import { saveBudgetProfile } from '../../../lib/storage';
import { cn, formatLocalYMD } from '../../../lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../UI/Dialog';
import { Input } from '../../UI/Input';
import { Label } from '../../UI/Label';

const EMOJI_OPTIONS = ['💰', '🎒', '🍜', '🏔️', '✨', '👨‍👩‍👧‍👦', '🏕️', '🍷', '🎯', '🌴', '🚗', '💼'];

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
      createdFrom: tripName ? { tripName, tripDate: formatLocalYMD() } : undefined,
    };

    saveBudgetProfile(profile);
    onSave(profile);
    onOpenChange(false);

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

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => setEmoji(option)}
                  className={cn(
                    'w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all',
                    emoji === option
                      ? 'bg-green-100 border-2 border-green-500'
                      : 'bg-gray-50 border border-gray-200 hover:border-gray-300'
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="misc-label">Rename "Misc" category (optional)</Label>
            <Input
              id="misc-label"
              value={miscLabel}
              onChange={(e) => setMiscLabel(e.target.value)}
              placeholder="Activities, Experiences, etc."
            />
          </div>

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