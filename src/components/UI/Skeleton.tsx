/**
 * Skeleton — Shimmer placeholder for loading states.
 *
 * Renders an animated pulse with a traveling shimmer highlight.
 * Use `className` to set width/height/border-radius for each shape.
 *
 * 💚 My Experience Engine
 */

import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-slate-200/60',
        className,
      )}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
    </div>
  );
}
