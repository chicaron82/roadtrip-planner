import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { Activity, DayOption, DayType, OvernightStop, StopType } from '../../../types';

/**
 * ItineraryEditContext — carries the 12 itinerary mutation callbacks down the
 * component tree without prop drilling through ItineraryTimelineContent/Body.
 *
 * Provided by: ItineraryTimeline (wrapper), TripTimelineView
 * Consumed by: ItineraryTimelineBody, TimelineDialogs
 *
 * All callbacks are optional — context degrades gracefully for read-only views.
 */
export interface ItineraryEditCallbacks {
  onUpdateStopType?: (segmentIndex: number, newStopType: StopType) => void;
  onUpdateActivity?: (segmentIndex: number, activity: Activity | undefined) => void;
  onUpdateDayType?: (dayNumber: number, dayType: DayType) => void;
  onUpdateDayNotes?: (dayNumber: number, notes: string) => void;
  onUpdateDayTitle?: (dayNumber: number, title: string) => void;
  onAddDayActivity?: (dayNumber: number, activity: Activity) => void;
  onUpdateDayActivity?: (dayNumber: number, activityIndex: number, activity: Activity) => void;
  onRemoveDayActivity?: (dayNumber: number, activityIndex: number) => void;
  onUpdateOvernight?: (dayNumber: number, overnight: OvernightStop) => void;
  onAddDayOption?: (dayNumber: number, option: DayOption) => void;
  onRemoveDayOption?: (dayNumber: number, optionIndex: number) => void;
  onSelectDayOption?: (dayNumber: number, optionIndex: number) => void;
}

const ItineraryEditContext = createContext<ItineraryEditCallbacks>({});

export function ItineraryEditProvider({
  callbacks,
  children,
}: {
  callbacks: ItineraryEditCallbacks;
  children: ReactNode;
}) {
  return (
    <ItineraryEditContext.Provider value={callbacks}>
      {children}
    </ItineraryEditContext.Provider>
  );
}

export function useItineraryEditContext(): ItineraryEditCallbacks {
  return useContext(ItineraryEditContext);
}
