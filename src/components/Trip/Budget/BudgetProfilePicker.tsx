import { useState } from 'react';
import type { SavedBudgetProfile, BudgetProfile, TripBudget, LastTripBudget } from '../../../types';
import { BUDGET_PROFILES } from '../../../lib/budget';
import {
  getBudgetProfiles,
  removeBudgetProfile,
  setDefaultBudgetProfile,
  getLastTripBudget,
} from '../../../lib/storage';
import { cn } from '../../../lib/utils';
import {
  QuickRecallSection,
  SavedProfilesSection,
  SystemProfilesSection,
} from './BudgetProfilePickerSections';
export { SaveProfileDialog } from './SaveProfileDialog';

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
  const handleSelectSystemProfile = (profile: BudgetProfile) => {
    const profileData = BUDGET_PROFILES[profile];
    onSelectProfile({
      ...currentBudget,
      profile,
      weights: profileData.weights,
    });
  };
  const handleSelectSavedProfile = (profile: SavedBudgetProfile) => {
    onSelectSavedProfile(profile);
  };
  const handleSelectLastTrip = () => {
    if (lastTripBudget) {
      onSelectProfile(lastTripBudget.budget);
    }
  };
  const handleToggleDefault = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDefaultBudgetProfile(id);
    setSavedProfiles(getBudgetProfiles());
  };
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
      {lastTripBudget && (
        <QuickRecallSection lastTripBudget={lastTripBudget} onSelect={handleSelectLastTrip} />
      )}

      <SavedProfilesSection
        savedProfiles={savedProfiles}
        deleteConfirmId={deleteConfirmId}
        onSelectProfile={handleSelectSavedProfile}
        onToggleDefault={handleToggleDefault}
        onDeleteProfile={handleDeleteProfile}
      />

      <SystemProfilesSection
        currentBudget={currentBudget}
        systemProfiles={systemProfiles}
        onSelectProfile={handleSelectSystemProfile}
      />
    </div>
  );
}
