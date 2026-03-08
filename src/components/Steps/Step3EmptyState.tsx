import type { PlanningStep } from '../../hooks';
import { Button } from '../UI/Button';

interface Step3EmptyStateProps {
  onGoToStep: (step: PlanningStep) => void;
}

export function Step3EmptyState({ onGoToStep }: Step3EmptyStateProps) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <div className="mb-2">🗺️</div>
      <p>No route calculated yet.</p>
      <Button variant="link" onClick={() => onGoToStep(1)} className="mt-2">
        Start Planning
      </Button>
    </div>
  );
}