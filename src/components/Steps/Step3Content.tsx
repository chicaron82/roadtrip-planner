import { useState, useMemo } from 'react';
import { Share2, Printer, Maximize2, Minimize2, ArrowLeft, PenLine } from 'lucide-react';
import type { Location, Vehicle, TripSettings, TripSummary, POISuggestion, TripJournal, StopType, DayType, OvernightStop, TripMode, TripChallenge } from '../../types';
import { Button } from '../UI/Button';
import { OvernightStopPrompt } from '../Trip/OvernightStopPrompt';
import { JournalModeToggle, StartJournalCTA, type ViewMode } from '../Trip/JournalModeToggle';
import { JournalTimeline } from '../Trip/JournalTimeline';
import { ItineraryTimeline } from '../Trip/ItineraryTimeline';
import { SmartTimeline } from '../Trip/SmartTimeline';
import { ConfirmTripCard } from '../Trip/ConfirmTripCard';
import { printTrip } from '../Trip/TripPrintView';
import { generateEstimate } from '../../lib/estimate-service';
import type { SuggestedStop } from '../../lib/stop-suggestions';
import type { PlanningStep } from '../../hooks';

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
  onAddPOI: (poiId: string) => void;
  onDismissPOI: (poiId: string) => void;
  onGoToStep: (step: PlanningStep) => void;
  externalStops?: SuggestedStop[];
  tripConfirmed: boolean;
  addedStopCount: number;
  onConfirmTrip: () => void;
  onUnconfirmTrip: () => void;
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
}: Step3ContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isJournalFullscreen, setIsJournalFullscreen] = useState(false);

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
        {viewMode === 'plan' && (
          <SmartTimeline
            summary={summary}
            settings={settings}
            vehicle={vehicle}
            poiSuggestions={poiSuggestions}
          />
        )}
        {viewMode === 'journal' ? (
          activeJournal ? (
            <JournalTimeline
              summary={summary}
              settings={settings}
              journal={activeJournal}
              onUpdateJournal={onUpdateJournal}
            />
          ) : (
            <StartJournalCTA
              onStart={onStartJournal}
              defaultName={activeChallenge?.title}
              tripMode={tripMode}
            />
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
            poiSuggestions={poiSuggestions}
            isLoadingPOIs={isLoadingPOIs}
            onAddPOI={onAddPOI}
            onDismissPOI={onDismissPOI}
            externalStops={externalStops}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Estimate Breakdown — shown in estimate mode */}
      {estimate && (
        <div className="rounded-xl border border-blue-500/30 p-5 space-y-4" style={{ background: 'linear-gradient(135deg, hsla(220, 60%, 20%, 0.5), hsla(240, 40%, 15%, 0.5))' }}>
          <div className="text-center">
            <p className="text-xs font-mono tracking-widest text-blue-400 uppercase mb-1">Estimated Trip Cost</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-sm text-muted-foreground">{estimate.currency}</span>
              <span className="text-4xl font-extrabold text-blue-300">{estimate.totalMid.toLocaleString()}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Range: {estimate.currency}{estimate.totalLow.toLocaleString()} – {estimate.currency}{estimate.totalHigh.toLocaleString()}
            </p>
            {estimate.numTravelers > 1 && (
              <p className="text-xs text-blue-400 font-medium mt-1">
                ~{estimate.currency}{estimate.perPersonMid.toLocaleString()} per person
              </p>
            )}
          </div>

          <div className="space-y-2">
            {estimate.breakdown.map((item) => (
              <div key={item.category} className="flex items-center justify-between p-2.5 rounded-lg border border-blue-500/20" style={{ background: 'hsla(225, 22%, 15%, 0.7)' }}>
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{item.emoji}</span>
                  <div>
                    <div className="text-sm font-medium">{item.category}</div>
                    {item.note && <div className="text-[10px] text-muted-foreground">{item.note}</div>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">
                    {estimate.currency}{item.mid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {estimate.currency}{item.low.toLocaleString(undefined, { maximumFractionDigits: 0 })} – {estimate.currency}{item.high.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-center text-muted-foreground/60 leading-relaxed">
            Estimates based on regional averages. Actual costs depend on season, location, and personal spending habits.
          </p>
        </div>
      )}

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
          {/* Smart Timeline — time-first view with combo stop optimization */}
          {viewMode === 'plan' && (
            <SmartTimeline
              summary={summary}
              settings={settings}
              vehicle={vehicle}
              poiSuggestions={poiSuggestions}
            />
          )}

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
          {viewMode === 'journal' ? (
            activeJournal ? (
              <JournalTimeline
                summary={summary}
                settings={settings}
                journal={activeJournal}
                onUpdateJournal={onUpdateJournal}
              />
            ) : (
              <StartJournalCTA
                onStart={onStartJournal}
                defaultName={activeChallenge?.title}
                tripMode={tripMode}
              />
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
              poiSuggestions={poiSuggestions}
              isLoadingPOIs={isLoadingPOIs}
              onAddPOI={onAddPOI}
              onDismissPOI={onDismissPOI}
              externalStops={externalStops}
            />
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
