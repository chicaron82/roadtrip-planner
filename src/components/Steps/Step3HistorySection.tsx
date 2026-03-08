import type { TripSummary } from '../../types';
import { RecentTrips } from '../Trip/StepHelpers/RecentTrips';

interface Step3HistorySectionProps {
  history: TripSummary[];
  onLoadHistoryTrip?: (trip: TripSummary) => void;
}

export function Step3HistorySection({ history, onLoadHistoryTrip }: Step3HistorySectionProps) {
  return <RecentTrips history={history} onLoadHistoryTrip={onLoadHistoryTrip} />;
}