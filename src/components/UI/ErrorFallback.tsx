import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './Button';
import type { FallbackProps } from 'react-error-boundary';

export interface ErrorFallbackProps extends FallbackProps {
  title?: string;
}

/**
 * A reusable fallback UI for React Error Boundaries.
 * Displays the error message inline, preventing a full crash while allowing retry.
 */
export function ErrorFallback({ error, resetErrorBoundary, title }: ErrorFallbackProps) {
  // Safe cast for error object which is typed as `any` in FallbackProps
  const errorMessage = error instanceof Error ? error.message : String(error || 'An unexpected rendering error occurred.');
  
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center h-full w-full min-h-[250px] border border-red-500/20 bg-red-500/5 rounded-[16px]">
      <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
        <AlertTriangle className="h-6 w-6 text-red-500" />
      </div>
      <h3 className="font-semibold text-foreground mb-2 text-base">{title || 'Component Crashed'}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-[280px] break-words line-clamp-3">
        {errorMessage}
      </p>
      <Button variant="outline" size="sm" onClick={resetErrorBoundary} className="gap-2 shrink-0">
        <RotateCcw className="h-4 w-4" /> Try Again
      </Button>
    </div>
  );
}
