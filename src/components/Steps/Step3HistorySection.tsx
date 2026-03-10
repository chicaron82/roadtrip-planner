import type { HistoryTripSnapshot } from '../../types';
import { RecentTrips } from '../Trip/StepHelpers/RecentTrips';

interface Step3HistorySectionProps {
  history: HistoryTripSnapshot[];
  onLoadHistoryTrip?: (trip: HistoryTripSnapshot) => void;
}

export function Step3HistorySection({ history, onLoadHistoryTrip }: Step3HistorySectionProps) {
  return <RecentTrips history={history} onLoadHistoryTrip={onLoadHistoryTrip} />;
}