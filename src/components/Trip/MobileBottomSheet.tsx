/**
 * MobileBottomSheet — Google Maps-style draggable sheet for Step 3 on mobile.
 *
 * Three snap points:
 *   peek  — 130px visible: drag handle + summary stats
 *   half  — 50vh visible: shows top of itinerary
 *   full  — 85vh visible: full itinerary scrollable
 *
 * Auto-advances from peek → half after 1.5s so the route animation is
 * visible before content takes over. Drag handle or tap cycles snaps.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { GripHorizontal, Car, Fuel, Users, Clock, RefreshCw, ChevronLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatDistance, formatDuration, formatCurrency } from '../../lib/calculations';
import type { TripSummary, TripSettings } from '../../types';
import { Button } from '../UI/Button';

// ==================== SNAP POINTS ====================

type SnapPoint = 'peek' | 'half' | 'full';

const PEEK_HEIGHT_PX = 130;
const SHEET_HEIGHT_VH = 85;

/** Translate Y from fully-up position. Larger = more hidden. */
function getTranslateY(snap: SnapPoint): string {
  switch (snap) {
    case 'full': return 'translateY(0)';
    case 'half': return `translateY(calc(${SHEET_HEIGHT_VH}vh - 50vh))`;
    case 'peek': return `translateY(calc(${SHEET_HEIGHT_VH}vh - ${PEEK_HEIGHT_PX}px))`;
  }
}

function nextSnap(current: SnapPoint): SnapPoint {
  if (current === 'peek') return 'half';
  if (current === 'half') return 'full';
  return 'peek';
}

// ==================== PROPS ====================

interface MobileBottomSheetProps {
  summary: TripSummary | null;
  settings: TripSettings;
  onReset: () => void;
  onGoBack: () => void;
  children: React.ReactNode;
  poiBar?: React.ReactNode;
  className?: string;
}

// ==================== COMPONENT ====================

export function MobileBottomSheet({
  summary,
  settings,
  onReset,
  onGoBack,
  children,
  poiBar,
  className,
}: MobileBottomSheetProps) {
  const [snap, setSnap] = useState<SnapPoint>('peek');
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const dragStartTranslate = useRef<number>(0);

  // Auto-advance peek → half after 1.5s so route animation is visible first
  useEffect(() => {
    const timer = setTimeout(() => setSnap('half'), 1500);
    return () => clearTimeout(timer);
  }, []);

  // ── Drag handling ──────────────────────────────────────────────────────────

  const getSheetHeightPx = () => {
    return (SHEET_HEIGHT_VH / 100) * window.innerHeight;
  };

  const getSnapTranslatePx = useCallback((s: SnapPoint): number => {
    const sheetH = getSheetHeightPx();
    switch (s) {
      case 'full': return 0;
      case 'half': return sheetH - window.innerHeight * 0.5;
      case 'peek': return sheetH - PEEK_HEIGHT_PX;
    }
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartTranslate.current = getSnapTranslatePx(snap);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [snap, getSnapTranslatePx]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !sheetRef.current) return;
    const delta = e.clientY - dragStartY.current;
    const newTranslate = Math.max(0, dragStartTranslate.current + delta);
    sheetRef.current.style.transition = 'none';
    sheetRef.current.style.transform = `translateY(${newTranslate}px)`;
  }, [isDragging]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !sheetRef.current) return;
    setIsDragging(false);

    const delta = e.clientY - dragStartY.current;
    const sheetH = getSheetHeightPx();

    // Snap thresholds: flick up → full, flick down → peek, small drag → half
    let target: SnapPoint;
    if (delta < -60) {
      // Dragged up
      target = snap === 'peek' ? 'half' : 'full';
    } else if (delta > 60) {
      // Dragged down
      target = snap === 'full' ? 'half' : 'peek';
    } else {
      target = snap;
    }

    // Clamp: can't go below peek
    const peekTranslate = sheetH - PEEK_HEIGHT_PX;
    const currentTranslate = dragStartTranslate.current + delta;
    if (currentTranslate >= peekTranslate * 0.95) target = 'peek';

    sheetRef.current.style.transition = '';
    sheetRef.current.style.transform = '';
    setSnap(target);
  }, [isDragging, snap]);

  // ==================== RENDER ====================

  const isOpen = snap !== 'peek';

  return (
    <div
      ref={sheetRef}
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[1000] flex flex-col',
        'rounded-t-2xl shadow-2xl',
        'bg-white dark:bg-gray-900',
        'border-t border-gray-200 dark:border-gray-700',
        className,
      )}
      style={{
        height: `${SHEET_HEIGHT_VH}vh`,
        transform: getTranslateY(snap),
        transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
        willChange: 'transform',
      }}
    >
      {/* ── Drag handle area ── */}
      <div
        className="flex flex-col items-center pt-2 pb-1 cursor-grab active:cursor-grabbing select-none shrink-0"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={() => !isDragging && setSnap(prev => nextSnap(prev))}
        aria-label="Drag to resize sheet"
        role="slider"
        aria-valuenow={snap === 'peek' ? 0 : snap === 'half' ? 1 : 2}
        aria-valuemin={0}
        aria-valuemax={2}
      >
        <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-2" />

        {/* ── Peek row: summary stats ── */}
        {summary ? (
          <div className="flex items-center gap-3 px-4 pb-1 w-full justify-between">
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
              <StatChip icon={<Car className="w-3 h-3" />} label={formatDistance(summary.totalDistanceKm, settings.units)} />
              <StatChip icon={<Clock className="w-3 h-3" />} label={formatDuration(summary.totalDurationMinutes)} />
              <StatChip icon={<Fuel className="w-3 h-3" />} label={formatCurrency(summary.totalFuelCost, settings.currency)} />
              {settings.numTravelers > 1 && (
                <StatChip
                  icon={<Users className="w-3 h-3" />}
                  label={`${formatCurrency(summary.costPerPerson, settings.currency)}/ea`}
                />
              )}
            </div>
            <GripHorizontal className="w-4 h-4 text-gray-400 shrink-0" />
          </div>
        ) : (
          <div className="text-xs text-muted-foreground pb-1">Calculating route…</div>
        )}
      </div>

      {/* ── POI controls bar (shown when open) ── */}
      {isOpen && poiBar && (
        <div className="shrink-0 px-4 pb-2">
          {poiBar}
        </div>
      )}

      {/* ── Sheet body ── */}
      <div
        className={cn(
          'flex-1 min-h-0 overflow-y-auto px-4 pb-4 mt-2',
          !isOpen && 'overflow-hidden pointer-events-none'
        )}
        style={{ overscrollBehavior: 'contain', touchAction: 'pan-y' }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {isOpen && children}
      </div>

      {/* ── Footer nav ── */}
      {isOpen && (
        <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 p-3 flex gap-2">
          <Button variant="outline" size="sm" onClick={onGoBack} className="gap-1">
            <ChevronLeft className="h-3 w-3" />
            Back
          </Button>
          <Button variant="outline" size="sm" onClick={onReset} className="flex-1 gap-1">
            <RefreshCw className="h-3 w-3" />
            Plan New Trip
          </Button>
        </div>
      )}
    </div>
  );
}

// ==================== STAT CHIP ====================

function StatChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
      <span className="text-gray-500 dark:text-gray-400">{icon}</span>
      {label}
    </div>
  );
}
