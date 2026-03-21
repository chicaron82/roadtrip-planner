/**
 * useStep1Controller.ts — Derived state and handlers for Step 1.
 *
 * Extracts from Step1Content:
 *  - isOpenEnded: geo distance check for "your trip ends far from origin" nudge
 *  - isSingleDay: departure === return date
 *  - targetArrivalLabel: formatted display string for the HH:MM chips
 *  - smartPreview: the date range summary banner content
 *  - handleImportFile: file reader + JSON parse + toast
 *
 * Step1Content becomes a layout-only component after this — it receives
 * these derived values and emits user intents upward via callbacks.
 *
 * 💚 My Experience Engine
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import type { Location, TripSettings } from '../../types';
import { parseSharedTemplate, type TemplateImportResult } from '../../lib/url';
import { showToast } from '../../lib/toast';

interface UseStep1ControllerOptions {
  locations: Location[];
  settings: TripSettings;
  onImportTemplate?: (result: TemplateImportResult) => void;
}

export interface SmartPreviewData {
  depFormatted: string;
  retFormatted: string;
  tripDays: number;
  daysUntilTrip: number;
  hasDateRange: boolean;
  hasDepartureOnly: boolean;
}

export interface UseStep1ControllerReturn {
  // Local UI state
  openEndedDismissed: boolean;
  setOpenEndedDismissed: (v: boolean) => void;
  // Derived state
  isOpenEnded: boolean;
  isSingleDay: boolean;
  origin: Location | undefined;
  lastDest: Location | undefined;
  targetArrivalLabel: string;
  smartPreview: SmartPreviewData;
  // Actions
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function parseLocal(d: string) {
  // Append T00:00:00 so the date is parsed in local time, not UTC midnight
  // (bare 'YYYY-MM-DD' rolls back a day in western timezones).
  return new Date(d + 'T00:00:00');
}

function formatArrivalHour(hour: number): string {
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return '12:00 PM';
  return `${hour - 12}:00 PM`;
}

export function useStep1Controller({
  locations,
  settings,
  onImportTemplate,
}: UseStep1ControllerOptions): UseStep1ControllerReturn {
  const [openEndedDismissed, setOpenEndedDismissed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Derived state ──────────────────────────────────────────────────────────

  const origin = useMemo(
    () => locations.find(l => l.type === 'origin'),
    [locations],
  );

  const lastDest = useMemo(
    () => locations.filter(l => l.type === 'destination').at(-1),
    [locations],
  );

  const isOpenEnded = useMemo(() => {
    if (settings.isRoundTrip || !origin || !lastDest) return false;
    if (origin.lat === 0 || lastDest.lat === 0) return false;
    const dLat = Math.abs(lastDest.lat - origin.lat);
    const dLng = Math.abs(lastDest.lng - origin.lng);
    return Math.sqrt(dLat * dLat + dLng * dLng) * 111 > 50;
  }, [settings.isRoundTrip, origin, lastDest]);

  const isSingleDay = useMemo(
    () => !!(settings.departureDate && settings.returnDate && settings.departureDate === settings.returnDate),
    [settings.departureDate, settings.returnDate],
  );

  const targetArrivalLabel = useMemo(
    () => formatArrivalHour(settings.targetArrivalHour),
    [settings.targetArrivalHour],
  );

  const smartPreview = useMemo<SmartPreviewData>(() => {
    const { departureDate: depDate, returnDate: retDate } = settings;
    const tripDays = depDate && retDate
      ? Math.max(1, Math.ceil((parseLocal(retDate).getTime() - parseLocal(depDate).getTime()) / (1000 * 60 * 60 * 24)))
      : 0;
    const daysUntilTrip = depDate && parseLocal(depDate) > new Date()
      ? Math.ceil((parseLocal(depDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const depFormatted = depDate
      ? parseLocal(depDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : '';
    const retFormatted = retDate
      ? parseLocal(retDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : '';
    return {
      depFormatted,
      retFormatted,
      tripDays,
      daysUntilTrip,
      hasDateRange: !!(depDate && retDate),
      hasDepartureOnly: !!(depDate && !retDate),
    };
  }, [settings]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = parseSharedTemplate(reader.result as string);
        onImportTemplate?.(result);
        showToast({
          message: `MEE time loaded — "${result.meta.title}" by ${result.meta.author}!`,
          type: 'success',
          duration: 4000,
        });
      } catch {
        showToast({
          message: 'Not a valid MEE time template. Make sure it was exported from My Experience Engine.',
          type: 'error',
          duration: 5000,
        });
      }
    };
    reader.readAsText(file);
    // Reset so same file can be re-imported
    e.target.value = '';
  }, [onImportTemplate]);

  return {
    openEndedDismissed,
    setOpenEndedDismissed,
    isOpenEnded,
    isSingleDay,
    origin,
    lastDest,
    targetArrivalLabel,
    smartPreview,
    fileInputRef,
    handleImportFile,
  };
}
