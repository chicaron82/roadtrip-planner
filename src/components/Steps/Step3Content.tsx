import { useState, useMemo } from 'react';
import { Share2, Printer, Maximize2, Minimize2, ArrowLeft, PenLine } from 'lucide-react';
import type { Location, Vehicle, TripSettings, TripSummary, POISuggestion, TripJournal, StopType, DayType, OvernightStop, TripMode, TripChallenge } from '../../types';
import { Button } from '../UI/Button';
import { OvernightStopPrompt } from '../Trip/OvernightStopPrompt';
import { JournalModeToggle, type ViewMode } from '../Trip/JournalModeToggle';
import { TripTimelineView } from '../Trip/TripTimelineView';
import { JournalTimeline } from '../Trip/JournalTimeline';
import { FeasibilityBanner } from '../Trip/FeasibilityBanner';
import { analyzeFeasibility } from '../../lib/feasibility';
import { ConfirmTripCard } from '../Trip/ConfirmTripCard';
import { EstimateBreakdown } from '../Trip/EstimateBreakdown';
import { printTrip } from '../Trip/TripPrintView';
import { generateEstimate } from '../../lib/estimate-service';
import type { SuggestedStop } from '../../lib/stop-suggestions';
import type { PlanningStep } from '../../hooks';
import { useTripContext } from '../../contexts/TripContext';

interface Step3ContentProps {
  summary: TripSummary | null;
  settings: TripSettings;
  vehicle: Vehicle;
  tripMode: TripMode;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  activeJournal: TripJournal | null;
  activeChallenge?: TripChallenge | null;
  showOvernightPrompt: boolean;
  suggestedOvernightStop: Location | null;
  poiSuggestions: POISuggestion[];
  isLoadingPOIs: boolean;
  poiPartialResults?: boolean;
  history: TripSummary[];
  shareUrl: string | null;
  onOpenGoogleMaps: () => void;
  onCopyShareLink: () => void;
  onStartJournal: (title?: string) => void;
  onUpdateJournal: (journal: TripJournal) => void;
  onUpdateStopType: (segmentIndex: number, stopType: StopType) => void;
  onUpdateDayNotes?: (dayNumber: number, notes: string) => void;
  onUpdateDayTitle?: (dayNumber: number, title: string) => void;
  onUpdateDayType?: (dayNumber: number, dayType: DayType) => void;
  onUpdateOvernight?: (dayNumber: number, overnight: OvernightStop) => void;
  onDismissOvernight: () => void;
  onAddPOI: (poiId: string, segmentIndex?: number) => void;
  onDismissPOI: (poiId: string) => void;
  onGoToStep: (step: PlanningStep) => void;
  externalStops?: SuggestedStop[];
  tripConfirmed: boolean;
  addedStopCount: number;
  onConfirmTrip: () => void;
  onUnconfirmTrip: () => void;
  onLoadHistoryTrip?: (trip: TripSummary) => void;
}

export function Step3Content({
  summary,
  settings,
  vehicle,
  tripMode,
  viewMode,
  setViewMode,
  activeJournal,
  activeChallenge,
  showOvernightPrompt,
  suggestedOvernightStop,
  poiSuggestions,
  isLoadingPOIs,
  poiPartialResults,
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
  externalStops,
  tripConfirmed,
  addedStopCount,
  onConfirmTrip,
  onUnconfirmTrip,
  onLoadHistoryTrip,
}: Step3ContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isJournalFullscreen, setIsJournalFullscreen] = useState(false);
  const { addDayActivity, updateDayActivity, removeDayActivity } = useTripContext();

  const feasibility = useMemo(
    () => summary ? analyzeFeasibility(summary, settings) : null,
    [summary, settings],
  );

  // Generate estimate when in estimate mode
  const estimate = useMemo(() => {
    if (tripMode !== 'estimate' || !summary) return null;
    return generateEstimate(summary, vehicle, settings);
  }, [tripMode, summary, vehicle, settings]);

  // Expanded itinerary mode — show only the itinerary with full space
  if (isExpanded && summary) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Itinerary</h2>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setIsExpanded(false)}
          >
            <Minimize2 className="h-3 w-3" /> Collapse
          </Button>
        </div>
        <TripTimelineView
          summary={summary}
          settings={settings}
          vehicle={vehicle}
          viewMode={viewMode}
          activeJournal={activeJournal}
          activeChallenge={activeChallenge}
          tripMode={tripMode}
          onStartJournal={onStartJournal}
          onUpdateJournal={onUpdateJournal}
          onUpdateStopType={onUpdateStopType}
          onUpdateDayNotes={onUpdateDayNotes}
          onUpdateDayTitle={onUpdateDayTitle}
          onUpdateDayType={onUpdateDayType}
          onAddDayActivity={addDayActivity}
          onUpdateDayActivity={updateDayActivity}
          onRemoveDayActivity={removeDayActivity}
          onUpdateOvernight={onUpdateOvernight}
          poiSuggestions={poiSuggestions}
          isLoadingPOIs={isLoadingPOIs}
          poiPartialResults={poiPartialResults}
          onAddPOI={onAddPOI}
          onDismissPOI={onDismissPOI}
          externalStops={externalStops}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Estimate Breakdown — shown in estimate mode */}
      {estimate && <EstimateBreakdown estimate={estimate} />}

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
              <Button size="sm" variant="outline" className="gap-1" onClick={() => printTrip({ summary, settings, vehicle })}>
                <Printer className="h-3 w-3" /> Print
              </Button>
            )}
          </div>
        </div>

        {/* Trip Health — plan mode only, above the mode toggle */}
        {summary && viewMode !== 'journal' && feasibility && (
          <FeasibilityBanner
            result={feasibility}
            numTravelers={settings.numTravelers}
            defaultCollapsed
          />
        )}

        {/* Journal Mode Toggle */}
        {summary && (
          <JournalModeToggle
            mode={viewMode}
            onChange={setViewMode}
            hasActiveJournal={!!activeJournal}
            disabled={!tripConfirmed}
            tripMode={tripMode}
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

      {summary ? (
        <>
          <TripTimelineView
            summary={summary}
            settings={settings}
            vehicle={vehicle}
            viewMode={viewMode}
            activeJournal={activeJournal}
            activeChallenge={activeChallenge}
            tripMode={tripMode}
            onStartJournal={onStartJournal}
            onUpdateJournal={onUpdateJournal}
            onUpdateStopType={onUpdateStopType}
            onUpdateDayNotes={onUpdateDayNotes}
            onUpdateDayTitle={onUpdateDayTitle}
            onUpdateDayType={onUpdateDayType}
            onAddDayActivity={addDayActivity}
            onUpdateDayActivity={updateDayActivity}
            onRemoveDayActivity={removeDayActivity}
            onUpdateOvernight={onUpdateOvernight}
            poiSuggestions={poiSuggestions}
            isLoadingPOIs={isLoadingPOIs}
            poiPartialResults={poiPartialResults}
            onAddPOI={onAddPOI}
            onDismissPOI={onDismissPOI}
            externalStops={externalStops}
          />

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {viewMode === 'journal' ? 'Journal' : 'Itinerary'}
            </h3>
            {viewMode === 'journal' && activeJournal ? (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setIsJournalFullscreen(true)}
              >
                <PenLine className="h-3 w-3" /> Write
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setIsExpanded(true)}
              >
                <Maximize2 className="h-3 w-3" /> Expand
              </Button>
            )}
          </div>

          {/* Journal fullscreen overlay — covers full viewport on mobile for writing */}
          {isJournalFullscreen && activeJournal && (
            <div className="fixed inset-0 z-50 flex flex-col bg-background">
              {/* Header */}
              <div className="flex items-center gap-3 px-4 border-b shrink-0" style={{ height: '52px', minHeight: '52px' }}>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsJournalFullscreen(false)}
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <span className="text-sm font-semibold truncate flex-1">
                  {activeJournal.metadata.title || 'Journal'}
                </span>
              </div>
              {/* Scrollable journal body */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-4 py-4">
                  <JournalTimeline
                    summary={summary}
                    settings={settings}
                    journal={activeJournal}
                    onUpdateJournal={onUpdateJournal}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Confirm Trip Card — shown in plan view */}
          {viewMode === 'plan' && (
            <ConfirmTripCard
              confirmed={tripConfirmed}
              addedStopCount={addedStopCount}
              totalDays={summary.days?.length ?? 1}
              onConfirm={onConfirmTrip}
              onUnconfirm={onUnconfirmTrip}
              onGoToJournal={() => setViewMode('journal')}
            />
          )}
        </>
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
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {history.slice(0, 5).map((trip, i) => {
              const origin = trip.segments[0]?.from.name ?? 'Unknown';
              const dest = trip.segments[trip.segments.length - 1]?.to.name ?? 'Unknown';
              const date = trip.displayDate
                ? new Date(trip.displayDate).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
                : null;
              const clickable = !!onLoadHistoryTrip;
              return (
                <div
                  key={i}
                  onClick={() => onLoadHistoryTrip?.(trip)}
                  className="p-2 border rounded text-xs bg-muted/20"
                  style={{
                    cursor: clickable ? 'pointer' : 'default',
                    transition: 'background 0.15s ease, border-color 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    if (clickable) {
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(245,158,11,0.08)';
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(245,158,11,0.4)';
                    }
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.background = '';
                    (e.currentTarget as HTMLDivElement).style.borderColor = '';
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-foreground truncate mr-2">
                      {origin} → {dest}
                    </span>
                    {date && <span className="text-muted-foreground shrink-0">{date}</span>}
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{trip.totalDistanceKm.toFixed(0)} km</span>
                    <span className="text-green-600">${trip.totalFuelCost.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
