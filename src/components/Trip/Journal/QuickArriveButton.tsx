import { Check } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface QuickArriveButtonProps {
  stopName: string;
  onArrive: () => void;
  className?: string;
}

export function QuickArriveButton({ stopName, onArrive, className }: QuickArriveButtonProps) {
  return (
    <button
      onClick={onArrive}
      className={cn(
        'w-full p-4 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white',
        'flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all',
        'active:scale-[0.98]',
        className
      )}
    >
      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
        <Check className="h-6 w-6" />
      </div>
      <div className="text-left">
        <div className="text-sm font-medium opacity-90">Tap when you arrive at</div>
        <div className="text-lg font-bold">{stopName}</div>
      </div>
    </button>
  );
}
