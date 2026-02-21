/**
 * MobileStepSheet — Draggable bottom sheet for Steps 1 & 2 on mobile.
 *
 * Simpler than MobileBottomSheet (no summary stats, no POI bar).
 * Shows a mode-colored top accent, step context in the peek row,
 * and step-nav buttons in the footer.
 *
 * Snap points:
 *   peek  —  88px visible: handle + step title
 *   half  —  50vh visible: shows top of step content   ← default
 *   full  —  85vh visible: full step content scrollable
 */

import { useRef, useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../UI/Button';
import type { TripMode } from '../../types';

// ==================== SNAP POINTS ====================

type SnapPoint = 'peek' | 'half' | 'full';

const PEEK_HEIGHT_PX = 88;
const SHEET_HEIGHT_VH = 85;

function getTranslateY(snap: SnapPoint): string {
  switch (snap) {
    case 'full': return 'translateY(0)';
    case 'half': return `translateY(calc(${SHEET_HEIGHT_VH}vh - 50vh))`;
    case 'peek': return `translateY(calc(${SHEET_HEIGHT_VH}vh - ${PEEK_HEIGHT_PX}px))`;
  }
}

// ==================== MODE COLORS ====================

const MODE_ACCENT: Record<TripMode, string> = {
  plan:      '#22C55E',
  estimate:  '#3B82F6',
  adventure: '#F59E0B',
};

// ==================== PROPS ====================

interface MobileStepSheetProps {
  children: React.ReactNode;
  stepNumber: 1 | 2;
  stepTitle: string;
  tripMode: TripMode;
  canProceed: boolean;
  isLoading?: boolean;
  onNext: () => void;
  nextLabel: string;
  onBack?: () => void;
  hasPreview?: boolean;
}

// ==================== COMPONENT ====================

export function MobileStepSheet({
  children,
  stepNumber,
  stepTitle,
  tripMode,
  canProceed,
  isLoading,
  onNext,
  nextLabel,
  onBack,
  hasPreview,
}: MobileStepSheetProps) {
  const [snap, setSnap] = useState<SnapPoint>('half');
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const dragStartTranslate = useRef<number>(0);

  const accent = MODE_ACCENT[tripMode];

  const getSheetHeightPx = () => (SHEET_HEIGHT_VH / 100) * window.innerHeight;

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

    let target: SnapPoint;
    if (delta < -60) {
      target = snap === 'peek' ? 'half' : 'full';
    } else if (delta > 60) {
      target = snap === 'full' ? 'half' : 'peek';
    } else {
      target = snap;
    }

    // Clamp: don't go below peek
    const peekTranslate = sheetH - PEEK_HEIGHT_PX;
    const currentTranslate = dragStartTranslate.current + delta;
    if (currentTranslate >= peekTranslate * 0.95) target = 'peek';

    sheetRef.current.style.transition = '';
    sheetRef.current.style.transform = '';
    setSnap(target);
  }, [isDragging, snap]);

  const isOpen = snap !== 'peek';

  return (
    <div
      ref={sheetRef}
      className="fixed bottom-0 left-0 right-0 z-[1000] flex flex-col rounded-t-2xl shadow-2xl bg-white dark:bg-gray-900"
      style={{
        height: `${SHEET_HEIGHT_VH}vh`,
        transform: getTranslateY(snap),
        transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
        willChange: 'transform',
        borderTop: `3px solid ${accent}`,
      }}
    >
      {/* ── Drag handle + peek row ── */}
      <div
        className="flex flex-col items-center pt-2 pb-2 cursor-grab active:cursor-grabbing select-none shrink-0"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={() => !isDragging && setSnap(prev =>
          prev === 'peek' ? 'half' : prev === 'half' ? 'full' : 'peek'
        )}
        role="slider"
        aria-valuenow={snap === 'peek' ? 0 : snap === 'half' ? 1 : 2}
        aria-valuemin={0}
        aria-valuemax={2}
        aria-label="Drag to resize sheet"
      >
        <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />

        <div className="flex items-center justify-between w-full px-4">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${accent}22`, color: accent }}
            >
              Step {stepNumber}
            </span>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {stepTitle}
            </span>
            {hasPreview && snap === 'peek' && (
              <span className="text-[10px] text-gray-400">Route ready ↑</span>
            )}
          </div>
          <ChevronDown
            className="w-4 h-4 text-gray-400 transition-transform duration-300"
            style={{ transform: snap === 'full' ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </div>
      </div>

      {/* ── Sheet body ── */}
      <div
        className={cn(
          'flex-1 overflow-y-auto px-4 pb-4',
          !isOpen && 'overflow-hidden pointer-events-none',
        )}
        style={{ overscrollBehavior: 'contain' }}
      >
        {isOpen && children}
      </div>

      {/* ── Footer nav ── */}
      {isOpen && (
        <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 p-3 flex gap-2">
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack} className="gap-1">
              <ChevronLeft className="h-3 w-3" /> Back
            </Button>
          )}
          <Button
            size="sm"
            onClick={onNext}
            disabled={!canProceed || !!isLoading}
            className="flex-1 gap-1 text-white"
            style={{ background: canProceed ? accent : undefined, borderColor: accent }}
          >
            {isLoading ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Calculating…</>
            ) : (
              <>{nextLabel} <ChevronRight className="h-3 w-3" /></>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
