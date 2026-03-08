import type { TripJournal, TripSettings, TripSummary, TripMode } from '../../types';
import type { ViewMode } from '../Trip/JournalModeToggle';
import type { Step3ArrivalInfo } from './step3-types';
import { FeasibilityBanner } from '../Trip/FeasibilityBanner';
import { JournalModeToggle } from '../Trip/JournalModeToggle';
import { BudgetBar } from '../Trip/BudgetBar';
import { TripBudgetHealth } from '../Trip/TripBudgetHealth';
import { TripArrivalHero } from '../Trip/TripArrivalHero';
import { PlannerRationaleCard } from '../Trip/PlannerRationaleCard';

interface Step3HealthSectionProps {
  summary: TripSummary;
  settings: TripSettings;
  viewMode: ViewMode;
  tripMode: TripMode;
  activeJournal: TripJournal | null;
  tripConfirmed: boolean;
  arrivalInfo: Step3ArrivalInfo | null;
  feasibility: ReturnType<typeof import('../../lib/feasibility').analyzeFeasibility> | null;
  setViewMode: (mode: ViewMode) => void;
}

export function Step3HealthSection({
  summary,
  settings,
  viewMode,
  tripMode,
  activeJournal,
  tripConfirmed,
  arrivalInfo,
  feasibility,
  setViewMode,
}: Step3HealthSectionProps) {
  return (
    <>
      {viewMode !== 'journal' && feasibility && (
        <FeasibilityBanner
          result={feasibility}
          numTravelers={settings.numTravelers}
          defaultCollapsed
        />
      )}

      <JournalModeToggle
        mode={viewMode}
        onChange={setViewMode}
        hasActiveJournal={!!activeJournal}
        disabled={!tripConfirmed}
        tripMode={tripMode}
      />

      {viewMode !== 'journal' && arrivalInfo && <TripArrivalHero arrivalInfo={arrivalInfo} />}

      {viewMode !== 'journal' && (
        <PlannerRationaleCard
          summary={summary}
          settings={settings}
          feasibility={feasibility}
        />
      )}

      {viewMode !== 'journal' && summary.costBreakdown && (
        <BudgetBar breakdown={summary.costBreakdown} settings={settings} />
      )}

      {viewMode !== 'journal' && settings.budgetMode === 'plan-to-budget' && summary.costBreakdown && (
        <TripBudgetHealth
          budget={settings.budget}
          breakdown={summary.costBreakdown}
          currency={settings.currency}
        />
      )}
    </>
  );
}