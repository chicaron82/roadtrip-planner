import { Check, MapPin, Car, Map } from 'lucide-react';

interface Step {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const steps: Step[] = [
  { number: 1, title: 'Route', description: 'Where & When', icon: <MapPin className="h-4 w-4" /> },
  { number: 2, title: 'Vehicle', description: 'Who & How', icon: <Car className="h-4 w-4" /> },
  { number: 3, title: 'Results', description: 'Your Trip', icon: <Map className="h-4 w-4" /> },
];

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
  onStepClick?: (step: 1 | 2 | 3) => void;
  completedSteps?: number[];
}

export function StepIndicator({ currentStep, onStepClick, completedSteps = [] }: StepIndicatorProps) {
  const canNavigateTo = (stepNumber: number) => {
    // Can always go back, or go forward if previous step completed
    return stepNumber <= currentStep || completedSteps.includes(stepNumber - 1);
  };

  return (
    <div className="flex items-center justify-between w-full px-2">
      {steps.map((step, index) => {
        const isActive = step.number === currentStep;
        const isCompleted = completedSteps.includes(step.number);
        const isClickable = onStepClick && canNavigateTo(step.number);

        return (
          <div key={step.number} className="flex items-center flex-1">
            {/* Step Circle + Content */}
            <button
              onClick={() => isClickable && onStepClick(step.number as 1 | 2 | 3)}
              disabled={!isClickable}
              className={`
                flex items-center gap-2 group transition-all
                ${isClickable ? 'cursor-pointer' : 'cursor-default'}
              `}
            >
              {/* Circle */}
              <div
                className={`
                  relative flex items-center justify-center w-10 h-10 rounded-full
                  border-2 transition-all duration-300
                  ${isCompleted
                    ? 'bg-green-500 border-green-500 text-white'
                    : isActive
                      ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/30 scale-110'
                      : 'bg-muted border-border text-muted-foreground'
                  }
                  ${isClickable && !isActive ? 'group-hover:border-primary group-hover:text-primary' : ''}
                `}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  step.icon
                )}

                {/* Pulse animation for active step */}
                {isActive && (
                  <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-20" />
                )}
              </div>

              {/* Text */}
              <div className="hidden sm:block text-left">
                <div
                  className={`
                    text-sm font-semibold transition-colors
                    ${isActive ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-muted-foreground'}
                  `}
                >
                  {step.title}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {step.description}
                </div>
              </div>
            </button>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className="flex-1 mx-2 sm:mx-4">
                <div
                  className={`
                    h-0.5 rounded-full transition-all duration-500
                    ${completedSteps.includes(step.number)
                      ? 'bg-green-500'
                      : isActive
                        ? 'bg-gradient-to-r from-primary to-muted'
                        : 'bg-border'
                    }
                  `}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
