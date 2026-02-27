/**
 * CompactMap — Expandable map wrapper for unified stacked layout.
 *
 * Default: Compact view (~40vh) with click-to-expand overlay.
 * Expanded: Full-screen map with back button to collapse.
 *
 * The Map component is always rendered; we just adjust container sizing.
 * Leaflet's invalidateSize() is called after resize to fix tile rendering.
 */

import { useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, Maximize2 } from 'lucide-react';
import { Map } from './Map/Map';
import type { ComponentProps } from 'react';

type MapProps = ComponentProps<typeof Map>;

interface CompactMapProps extends MapProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function CompactMap({
  isExpanded,
  onToggleExpand,
  ...mapProps
}: CompactMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Trigger Leaflet resize when expanded state changes
  useEffect(() => {
    // Give CSS transition time to complete
    const timer = setTimeout(() => {
      // Fire a window resize event to make Leaflet recalculate
      window.dispatchEvent(new Event('resize'));
    }, 350);
    return () => clearTimeout(timer);
  }, [isExpanded]);

  const handleExpandClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand();
  }, [onToggleExpand]);

  return (
    <div
      ref={containerRef}
      className={`
        relative w-full transition-all duration-300 ease-out
        ${isExpanded
          ? 'fixed inset-0 z-50'
          : 'h-[40vh] min-h-[200px] max-h-[400px]'
        }
      `}
    >
      {/* Map container */}
      <div className="absolute inset-0">
        <Map {...mapProps} />
      </div>

      {/* Expand/Collapse overlay */}
      {!isExpanded ? (
        /* Compact mode: click anywhere to expand */
        <button
          onClick={handleExpandClick}
          className="absolute inset-0 z-10 flex items-end justify-center pb-3 bg-gradient-to-t from-black/30 to-transparent cursor-pointer group"
          aria-label="Expand map"
        >
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-medium backdrop-blur-sm transition-all group-hover:bg-black/80">
            <Maximize2 className="h-3.5 w-3.5" />
            <span>Tap to expand map</span>
          </div>
        </button>
      ) : (
        /* Expanded mode: back button header */
        <div className="absolute top-0 left-0 right-0 z-[1001] p-3 bg-gradient-to-b from-black/50 to-transparent">
          <button
            onClick={handleExpandClick}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black/60 text-white text-sm font-medium backdrop-blur-sm transition-all hover:bg-black/80"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Back to trip</span>
          </button>
        </div>
      )}
    </div>
  );
}
