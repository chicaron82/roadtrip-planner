import { Share2, Printer } from 'lucide-react';
import type { Location, Vehicle, TripSettings, TripSummary, POISuggestion, TripJournal, StopType, DayType, OvernightStop } from '../../types';
import { Button } from '../UI/Button';
import { OvernightStopPrompt } from '../Trip/OvernightStopPrompt';
import { POISuggestionsPanel } from '../Trip/POISuggestionsPanel';
import { JournalModeToggle, StartJournalCTA, type ViewMode } from '../Trip/JournalModeToggle';
import { JournalTimeline } from '../Trip/JournalTimeline';
import { ItineraryTimeline } from '../Trip/ItineraryTimeline';
import { printTrip } from '../Trip/TripPrintView';
import type { PlanningStep } from '../../hooks';

interface Step3ContentProps {
  summary: TripSummary | null;
  settings: TripSettings;
  vehicle: Vehicle;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  activeJournal: TripJournal | null;
  showOvernightPrompt: boolean;
  suggestedOvernightStop: Location | null;
  poiSuggestions: POISuggestion[];
  isLoadingPOIs: boolean;
  history: TripSummary[];
  shareUrl: string | null;
  onOpenGoogleMaps: () => void;
  onCopyShareLink: () => void;
  onStartJournal: () => void;
  onUpdateJournal: (journal: TripJournal) => void;
  onUpdateStopType: (segmentIndex: number, stopType: StopType) => void;
  onUpdateDayNotes?: (dayNumber: number, notes: string) => void;
  onUpdateDayTitle?: (dayNumber: number, title: string) => void;
  onUpdateDayType?: (dayNumber: number, dayType: DayType) => void;
  onUpdateOvernight?: (dayNumber: number, overnight: OvernightStop) => void;
  onDismissOvernight: () => void;
  onAddPOI: (poiId: string) => void;
  onDismissPOI: (poiId: string) => void;
  onGoToStep: (step: PlanningStep) => void;
}

export function Step3Content({
  summary,
  settings,
  vehicle,
  viewMode,
  setViewMode,
  activeJournal,
  showOvernightPrompt,
  suggestedOvernightStop,
  poiSuggestions,
  isLoadingPOIs,
  history,
  shareUrl,
  onOpenGoogleMaps,
  onCopyShareLink,
  onStartJournal,
  onUpdateJournal,
  onUpdateStopType,
  onUpdateDayNotes,
  onUpdateDayTitle,
  onUpdateDayType,
  onUpdateOvernight,
  onDismissOvernight,
  onAddPOI,
  onDismissPOI,
  onGoToStep,
}: Step3ContentProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold">Your Trip</h2>
            <p className="text-sm text-muted-foreground">Review your route and itinerary.</p>
          </div>
          <div className="flex gap-2">
            {summary && (
              <Button size="sm" variant="outline" className="gap-1" onClick={onOpenGoogleMaps}>
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                Google Maps
              </Button>
            )}
            {shareUrl && (
              <Button size="sm" variant="outline" className="gap-1" onClick={onCopyShareLink}>
                <Share2 className="h-3 w-3" /> Share
              </Button>
            )}
            {summary && (
              <Button size="sm" variant="outline" className="gap-1" onClick={() => printTrip({ summary, settings })}>
                <Printer className="h-3 w-3" /> Print
              </Button>
            )}
          </div>
        </div>

        {/* Journal Mode Toggle */}
        {summary && (
          <JournalModeToggle
            mode={viewMode}
            onChange={setViewMode}
            hasActiveJournal={!!activeJournal}
          />
        )}
      </div>

      {/* Overnight Stop Prompt */}
      {showOvernightPrompt && suggestedOvernightStop && summary && (
        <OvernightStopPrompt
          suggestedLocation={suggestedOvernightStop}
          hoursBeforeStop={(summary.totalDurationMinutes / 60) * 0.5}
          distanceBeforeStop={summary.totalDistanceKm * 0.5}
          numTravelers={settings.numTravelers}
          arrivalTime="5:00 PM"
          departureTime="8:00 AM"
          onAccept={() => {
            if (!summary) return;
            const segmentIndex = summary.segments.findIndex(
              (seg) => seg.to.name === suggestedOvernightStop.name
            );
            if (segmentIndex >= 0) {
              onUpdateStopType(segmentIndex, 'overnight');
            }
            onDismissOvernight();
          }}
          onDecline={onDismissOvernight}
        />
      )}

      {/* POI Suggestions */}
      <POISuggestionsPanel
        suggestions={poiSuggestions}
        isLoading={isLoadingPOIs}
        onAdd={onAddPOI}
        onDismiss={onDismissPOI}
      />

      {summary ? (
        viewMode === 'journal' ? (
          activeJournal ? (
            <JournalTimeline
              summary={summary}
              settings={settings}
              journal={activeJournal}
              onUpdateJournal={onUpdateJournal}
            />
          ) : (
            <StartJournalCTA onStart={onStartJournal} />
          )
        ) : (
          <ItineraryTimeline
            summary={summary}
            settings={settings}
            vehicle={vehicle}
            days={summary.days}
            onUpdateStopType={onUpdateStopType}
            onUpdateDayNotes={onUpdateDayNotes}
            onUpdateDayTitle={onUpdateDayTitle}
            onUpdateDayType={onUpdateDayType}
            onUpdateOvernight={onUpdateOvernight}
          />
        )
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <div className="mb-2">🗺️</div>
          <p>No route calculated yet.</p>
          <Button variant="link" onClick={() => onGoToStep(1)} className="mt-2">
            Start Planning
          </Button>
        </div>
      )}

      {/* Recent Trips */}
      {history.length > 0 && (
        <div className="border-t pt-4 mt-4">
          <h3 className="text-sm font-semibold mb-2">Recent Trips</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {history.slice(0, 3).map((trip, i) => (
              <div key={i} className="p-2 border rounded text-xs bg-muted/20">
                <div className="flex justify-between">
                  <span>{trip.totalDistanceKm.toFixed(0)} km</span>
                  <span className="text-green-600">${trip.totalFuelCost.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
