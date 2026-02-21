import { useMemo, useState } from 'react';
import { MapPin, Trophy, Clock, Camera, Star, BookOpen, Plus } from 'lucide-react';
import type { TripSummary, TripSettings, TripJournal, JournalEntry, JournalPhoto, QuickCapture, TripDay } from '../../types';
import { JournalStopCard, QuickArriveButton } from './JournalStopCard';
import { DayHeader } from './DayHeader';
import { QuickCaptureDialog } from './QuickCaptureDialog';
import { cn } from '../../lib/utils';
import { showToast } from '../../lib/toast';

interface JournalTimelineProps {
  summary: TripSummary;
  settings: TripSettings;
  journal: TripJournal;
  onUpdateJournal: (journal: TripJournal) => void;
  className?: string;
}

export function JournalTimeline({
  summary,
  settings,
  journal,
  onUpdateJournal,
  className,
}: JournalTimelineProps) {
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [quickCaptureContext, setQuickCaptureContext] = useState<{
    segmentIndex?: number;
    locationName?: string;
  }>({});

  const startTime = useMemo(
    () => new Date(`${settings.departureDate}T${settings.departureTime}`),
    [settings.departureDate, settings.departureTime]
  );

  // Build map: segmentIndex → TripDay for the first segment of each driving day
  const dayStartMap = useMemo(() => {
    const map = new Map<number, TripDay>();
    if (summary.days) {
      for (const day of summary.days) {
        if (day.segmentIndices.length > 0) {
          map.set(day.segmentIndices[0], day);
        }
      }
    }
    return map;
  }, [summary.days]);

  // Build map: last-segment-index-of-driving-day → free TripDay[]
  // Used to render free day headers after the last real stop of a driving day
  const freeDaysAfterSegment = useMemo(() => {
    const map = new Map<number, TripDay[]>();
    if (!summary.days) return map;
    const drivingDays = summary.days.filter(d => d.segmentIndices.length > 0);
    const freeDays = summary.days.filter(d => d.dayType === 'free');
    for (const freeDay of freeDays) {
      const prevDrivingDay = drivingDays
        .filter(d => d.dayNumber < freeDay.dayNumber)
        .sort((a, b) => b.dayNumber - a.dayNumber)[0];
      if (prevDrivingDay) {
        const lastIdx = prevDrivingDay.segmentIndices[prevDrivingDay.segmentIndices.length - 1];
        map.set(lastIdx, [...(map.get(lastIdx) || []), freeDay]);
      }
    }
    return map;
  }, [summary.days]);

  // Find current/next stop (first unvisited non-guard stop)
  const currentStopIndex = useMemo(() => {
    for (let i = 0; i < summary.segments.length; i++) {
      if (summary.segments[i].to.id?.startsWith('guard-')) continue;
      const entry = journal.entries.find(e => e.segmentIndex === i);
      if (!entry || entry.status !== 'visited') {
        return i;
      }
    }
    return summary.segments.length - 1; // All visited, show last
  }, [summary.segments, journal.entries]);

  const currentSegment = summary.segments[currentStopIndex];

  // Get or create entry for a segment
  const getEntry = (segmentIndex: number): JournalEntry | undefined => {
    return journal.entries.find(e => e.segmentIndex === segmentIndex);
  };

  // Update an entry
  const handleUpdateEntry = (segmentIndex: number, updates: Partial<JournalEntry>) => {
    const existingEntry = getEntry(segmentIndex);
    const segment = summary.segments[segmentIndex];

    let newEntry: JournalEntry;
    if (existingEntry) {
      newEntry = {
        ...existingEntry,
        ...updates,
        updatedAt: new Date(),
      };
    } else {
      newEntry = {
        id: `entry-${segmentIndex}-${Date.now()}`,
        stopId: segment.to.id,
        segmentIndex,
        photos: [],
        notes: '',
        status: 'planned',
        isHighlight: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        plannedArrival: segment.arrivalTime ? new Date(segment.arrivalTime) : undefined,
        ...updates,
      };
    }

    const updatedEntries = existingEntry
      ? journal.entries.map(e => (e.id === existingEntry.id ? newEntry : e))
      : [...journal.entries, newEntry];

    onUpdateJournal({
      ...journal,
      entries: updatedEntries,
      updatedAt: new Date(),
    });
  };

  // Add photo to entry
  const handleAddPhoto = (segmentIndex: number, photo: JournalPhoto) => {
    const entry = getEntry(segmentIndex);
    const photos = entry?.photos || [];

    handleUpdateEntry(segmentIndex, {
      photos: [...photos, photo],
    });
  };

  // Remove photo from entry
  const handleRemovePhoto = (segmentIndex: number, photoId: string) => {
    const entry = getEntry(segmentIndex);
    if (!entry) return;

    handleUpdateEntry(segmentIndex, {
      photos: entry.photos.filter(p => p.id !== photoId),
    });
  };

  // Handle quick capture save
  const handleSaveQuickCapture = (capture: QuickCapture) => {
    onUpdateJournal({
      ...journal,
      quickCaptures: [...journal.quickCaptures, capture],
      stats: {
        ...journal.stats,
        photosCount: journal.stats.photosCount + 1,
      },
      updatedAt: new Date(),
    });

    showToast({
      message: '📸 Memory captured!',
      type: 'success',
    });
  };

  // Open quick capture dialog
  const handleOpenQuickCapture = (segmentIndex?: number, locationName?: string) => {
    setQuickCaptureContext({ segmentIndex, locationName });
    setQuickCaptureOpen(true);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Calculate progress — exclude border-avoidance guard waypoints (routing artifacts)
  const realSegmentIndices = useMemo(
    () => new Set(
      summary.segments
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => !s.to.id?.startsWith('guard-'))
        .map(({ i }) => i)
    ),
    [summary.segments]
  );
  const totalStops = realSegmentIndices.size;
  const visitedCount = journal.entries.filter(
    e => realSegmentIndices.has(e.segmentIndex) && e.status === 'visited'
  ).length;
  const progressPercent = totalStops > 0 ? Math.round((visitedCount / totalStops) * 100) : 0;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Progress Header */}
      <div className="rounded-xl border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-purple-600" />
            <h3 className="font-bold text-purple-900">{journal.metadata.title}</h3>
          </div>
          <div className="text-sm font-medium text-purple-700">
            {visitedCount}/{totalStops} stops
          </div>
        </div>

        {/* Origin badge */}
        {journal.origin && journal.origin.type !== 'manual' && (
          <div className="flex items-center gap-1.5 text-xs mb-3 pb-3 border-b border-purple-100">
            {journal.origin.type === 'challenge' ? (
              <>
                <span>🏁</span>
                <span className="font-semibold text-amber-700">Challenge Run</span>
                <span className="text-purple-400 mx-0.5">—</span>
                <span className="text-purple-700">{journal.origin.title}</span>
              </>
            ) : (
              <>
                <span>🔀</span>
                <span className="font-semibold text-purple-700">Forked from</span>
                <span className="text-purple-900 font-medium">"{journal.origin.title}"</span>
                {journal.origin.author && (
                  <span className="text-purple-500">by {journal.origin.author}</span>
                )}
              </>
            )}
          </div>
        )}

        {/* Progress Bar */}
        <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-4 mt-3 text-xs text-purple-600">
          <span className="flex items-center gap-1">
            <Camera className="h-3 w-3" />
            {journal.stats.photosCount} photos
          </span>
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3" />
            {journal.stats.highlightsCount} highlights
          </span>
        </div>
      </div>

      {/* Current Stop - Quick Arrive */}
      {currentStopIndex < summary.segments.length && currentSegment && (
        <QuickArriveButton
          stopName={currentSegment.to.name.split(',')[0]}
          onArrive={() => handleUpdateEntry(currentStopIndex, {
            status: 'visited',
            actualArrival: new Date(),
          })}
        />
      )}

      {/* Timeline */}
      <div className="space-y-0 pt-2 relative pb-12">
        {/* Timeline Line */}
        <div className="absolute left-[19px] top-4 bottom-0 w-0.5 bg-border -z-10" />

        {/* Start Node */}
        <div className="flex gap-4 mb-8">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center border-2 border-green-200 shadow-sm z-10">
              <MapPin className="h-5 w-5" />
            </div>
          </div>
          <div className="pt-1">
            <div className="text-xs font-bold text-green-600 uppercase tracking-wider mb-0.5">
              Start
            </div>
            <div className="font-bold text-xl">{summary.segments[0]?.from.name || 'Origin'}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
              <Clock className="h-3 w-3" /> {formatDate(startTime)} • {formatTime(startTime)}
            </div>
          </div>
        </div>

        {/* Stop Cards */}
        {summary.segments.map((segment, index) => {
          const isGuard = segment.to.id?.startsWith('guard-');
          const dayHeader = dayStartMap.get(index);

          // Guard waypoints are routing artifacts — render day header if needed, skip stop card
          if (isGuard) {
            return dayHeader ? (
              <DayHeader
                key={`day-${dayHeader.dayNumber}`}
                day={dayHeader}
                isFirst={dayHeader.dayNumber === 1}
                className="mb-6"
              />
            ) : null;
          }

          const entry = getEntry(index);
          const isDest = index === summary.segments.length - 1;
          const isCurrent = index === currentStopIndex;
          const isVisited = entry?.status === 'visited';
          const afterFreeDays = freeDaysAfterSegment.get(index) || [];

          // Get quick captures for this segment
          const segmentCaptures = journal.quickCaptures.filter(
            qc => qc.autoTaggedSegment === index
          );

          return (
            <div key={`stop-${index}`}>
              {/* Day Header — interleaved at the start of each day */}
              {dayHeader && (
                <DayHeader day={dayHeader} isFirst={dayHeader.dayNumber === 1} className="mb-6" />
              )}
              {/* Inline Add Memory Button (before stop) */}
              <div className="flex gap-4 mb-3">
                <div className="w-10 flex justify-center">
                  <div className="w-0.5 h-6 bg-border" />
                </div>
                <button
                  onClick={() => handleOpenQuickCapture(index, segment.to.name)}
                  className="flex-1 border-2 border-dashed border-purple-200 bg-purple-50/30 hover:bg-purple-50 hover:border-purple-300 rounded-lg px-3 py-2 transition-all group"
                >
                  <div className="flex items-center justify-center gap-2 text-xs text-purple-600 font-medium">
                    <Plus className="h-3 w-3 group-hover:scale-110 transition-transform" />
                    <span>Add Memory</span>
                  </div>
                </button>
              </div>

              {/* Quick Captures for this segment */}
              {segmentCaptures.map((capture) => (
                <div key={capture.id} className="flex gap-4 mb-4">
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 border-2 border-purple-200 flex items-center justify-center shadow-sm z-10">
                      <Camera className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="text-2xl">📸</div>
                        <div className="flex-1">
                          <div className="font-semibold text-purple-900 text-sm">
                            {capture.autoTaggedLocation || 'Quick Memory'}
                          </div>
                          <div className="text-xs text-purple-600 mt-0.5">
                            Captured on the way
                          </div>
                        </div>
                      </div>
                      {capture.photo && (
                        <img
                          src={capture.photo.dataUrl}
                          alt={capture.photo.caption || 'Memory'}
                          className="w-full h-40 object-cover rounded-lg mb-2"
                        />
                      )}
                      {capture.photo?.caption && (
                        <p className="text-sm text-purple-700">{capture.photo.caption}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex gap-4 mb-6">
              {/* Timeline Node */}
              <div className="relative flex-shrink-0">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center border-2 shadow-sm z-10 transition-all',
                    isDest
                      ? 'bg-yellow-100 text-yellow-600 border-yellow-200'
                      : isVisited
                      ? 'bg-green-500 text-white border-green-400'
                      : isCurrent
                      ? 'bg-purple-100 text-purple-600 border-purple-300 ring-4 ring-purple-100'
                      : 'bg-white text-muted-foreground border-slate-200'
                  )}
                >
                  {isDest ? (
                    <Trophy className="h-5 w-5" />
                  ) : isVisited ? (
                    '✓'
                  ) : (
                    <span className="font-mono text-xs font-bold">{index + 1}</span>
                  )}
                </div>
              </div>

              {/* Journal Card */}
              <div className="flex-1 min-w-0">
                {/* Drive Info */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2 pl-1">
                  <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                    <span>🚗</span>
                    <span>{segment.distanceKm.toFixed(0)} km</span>
                  </div>
                  <span className="text-slate-300">•</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>
                      {Math.floor(segment.durationMinutes / 60)}h {Math.round(segment.durationMinutes % 60)}m
                    </span>
                  </div>
                </div>

                {/* Journal Stop Card */}
                <JournalStopCard
                  segment={segment}
                  segmentIndex={index}
                  entry={entry}
                  onUpdateEntry={(updates) => handleUpdateEntry(index, updates)}
                  onAddPhoto={(photo) => handleAddPhoto(index, photo)}
                  onRemovePhoto={(photoId) => handleRemovePhoto(index, photoId)}
                />
              </div>
            </div>

            {/* Free day headers after this stop (e.g. "Day 2 at Thunder Bay") */}
            {afterFreeDays.map(freeDay => (
              <DayHeader
                key={`free-day-${freeDay.dayNumber}`}
                day={freeDay}
                isFirst={false}
                className="mb-6 mt-4"
              />
            ))}
            </div>
          );
        })}
      </div>

      {/* Trip Complete */}
      {visitedCount === totalStops && (
        <div className="rounded-xl border-2 border-green-200 bg-gradient-to-r from-green-50 to-white p-6 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h3 className="text-xl font-bold text-green-900 mb-2">Trip Complete!</h3>
          <p className="text-sm text-green-700 mb-4">
            You visited all {totalStops} stops and captured {journal.stats.photosCount} memories.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => {
                // Export journal as PDF-ready HTML format
                // TODO: Add html2canvas + jsPDF for proper PDF generation
                const journalHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>${journal.metadata.title}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #2563eb; }
    .stop { border-left: 3px solid #10b981; padding-left: 15px; margin: 20px 0; }
    .highlight { background: #fef3c7; padding: 10px; border-radius: 8px; }
    .rating { color: #f59e0b; }
  </style>
</head>
<body>
  <h1>🚗 ${journal.metadata.title}</h1>
  <p><strong>Distance:</strong> ${journal.tripSummary.totalDistanceKm.toFixed(1)} km |
     <strong>Duration:</strong> ${(journal.tripSummary.totalDurationMinutes / 60).toFixed(1)} hours</p>
  <p><strong>Travelers:</strong> ${journal.metadata.travelers?.join(', ') || 'Unknown'}</p>

  <h2>Journey Highlights</h2>
  ${journal.entries.map(e => {
    const stop = summary.segments[e.segmentIndex]?.to;
    const photosHTML = e.photos.length > 0
      ? `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin: 15px 0;">
          ${e.photos.map(p => `
            <div>
              <img src="${p.dataUrl}" alt="${p.caption || 'Photo'}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" />
              ${p.caption ? `<p style="font-size: 12px; color: #6b7280; margin-top: 4px; text-align: center;">${p.caption}</p>` : ''}
            </div>
          `).join('')}
         </div>`
      : '';

    return `
    <div class="stop ${e.isHighlight ? 'highlight' : ''}">
      <h3>${stop?.name || 'Unknown'}</h3>
      ${e.rating ? `<div class="rating">${'⭐'.repeat(e.rating)}</div>` : ''}
      ${photosHTML}
      ${e.notes ? `<p>${e.notes}</p>` : ''}
      ${e.isHighlight ? `<p><strong>✨ ${e.highlightReason}</strong></p>` : ''}
      <p><em>Status: ${e.status}</em></p>
    </div>`;
  }).join('')}

  ${journal.quickCaptures.length > 0 ? `
  <h2>📍 Memories Along the Way</h2>
  ${journal.quickCaptures.map(qc => {
    const mapsLink = qc.gpsCoords
      ? `https://www.google.com/maps?q=${qc.gpsCoords.lat},${qc.gpsCoords.lng}`
      : qc.photo?.location && (qc.photo.location.lat !== 0 || qc.photo.location.lng !== 0)
        ? `https://www.google.com/maps?q=${qc.photo.location.lat},${qc.photo.location.lng}`
        : null;
    return `
    <div style="border-left: 3px solid #a855f7; padding-left: 15px; margin: 15px 0;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <strong>${qc.autoTaggedLocation || 'Quick Memory'}</strong>
        ${qc.category ? `<span style="font-size: 11px; background: #f3e8ff; color: #7c3aed; padding: 2px 6px; border-radius: 9999px;">${qc.category}</span>` : ''}
        ${mapsLink ? `<a href="${mapsLink}" style="font-size: 11px; color: #2563eb;">📍 View on Maps</a>` : ''}
      </div>
      ${qc.photo ? `<img src="${qc.photo.dataUrl}" alt="${qc.photo.caption || 'Memory'}" style="width: 100%; max-width: 400px; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 6px;" />` : ''}
      ${qc.photo?.caption ? `<p style="margin: 4px 0; color: #374151;">${qc.photo.caption}</p>` : ''}
      ${qc.gpsCoords ? `<p style="font-size: 11px; color: #9ca3af;">GPS: ${qc.gpsCoords.lat.toFixed(5)}, ${qc.gpsCoords.lng.toFixed(5)}</p>` : ''}
    </div>`;
  }).join('')}
  ` : ''}

  <h2>Trip Statistics</h2>
  <ul>
    <li>Total Stops: ${journal.stats.stopsVisited + journal.stats.stopsSkipped}</li>
    <li>Stops Visited: ${journal.stats.stopsVisited}</li>
    <li>Photos Captured: ${journal.stats.photosCount}</li>
    <li>Highlights: ${journal.stats.highlightsCount}</li>
  </ul>

  <p style="text-align: center; color: #6b7280; margin-top: 40px;">
    Generated by My Experience Engine on ${new Date().toLocaleDateString()}
  </p>
</body>
</html>`;

                const blob = new Blob([journalHTML], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `roadtrip-journal-${journal.metadata.title.replace(/\s+/g, '-').toLowerCase()}.html`;
                link.click();
                URL.revokeObjectURL(url);

                showToast({
                  message: 'Journal exported! Open the HTML file and print to PDF (Ctrl+P)',
                  type: 'success',
                  duration: 4000,
                });
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
            >
              Export Journal
            </button>
            <button
              onClick={() => {
                // Create loadable trip template with reviews and recommendations
                const template = {
                  type: 'roadtrip-template',
                  version: '1.0',
                  createdAt: new Date().toISOString(),
                  author: journal.metadata.travelers?.[0] || 'Anonymous',

                  trip: {
                    title: journal.metadata.title,
                    description: journal.metadata.description || 'Follow this roadtrip route!',
                    tags: journal.metadata.tags,
                    durationDays: journal.tripSummary.days?.length || 1,
                    totalDistanceKm: journal.tripSummary.totalDistanceKm,
                    totalDurationHours: (journal.tripSummary.totalDurationMinutes / 60).toFixed(1),
                  },

                  budget: {
                    profile: settings.budget.profile,
                    totalSpent: journal.stats.totalActualSpent,
                    perPerson: journal.stats.totalActualSpent / settings.numTravelers,
                    breakdown: {
                      fuel: journal.tripSummary.totalFuelCost,
                      accommodation: journal.stats.totalActualSpent * 0.4, // estimate
                      food: journal.stats.totalActualSpent * 0.3, // estimate
                      misc: journal.stats.totalActualSpent * 0.3, // estimate
                    },
                  },

                  route: {
                    origin: summary.segments[0]?.from,
                    destination: summary.segments[summary.segments.length - 1]?.to,
                    waypoints: summary.segments
                      .map(s => s.to)
                      .filter((loc, idx, arr) => arr.findIndex(l => l.name === loc.name) === idx),
                  },

                  recommendations: journal.entries.map(e => {
                    const stop = summary.segments[e.segmentIndex]?.to;
                    return {
                      location: stop?.name,
                      lat: stop?.lat,
                      lng: stop?.lng,
                      rating: e.rating,
                      notes: e.notes,
                      isHighlight: e.isHighlight,
                      highlightReason: e.highlightReason,
                      wouldStayAgain: e.rating && e.rating >= 4,
                      tips: e.notes,
                    };
                  }).filter(r => r.rating || r.isHighlight),

                  // Include settings & vehicle so the plan can be fully loaded
                  settings: {
                    units: settings.units,
                    currency: settings.currency,
                    maxDriveHours: settings.maxDriveHours,
                    numTravelers: settings.numTravelers,
                    numDrivers: settings.numDrivers,
                    isRoundTrip: settings.isRoundTrip,
                    avoidTolls: settings.avoidTolls,
                    avoidBorders: settings.avoidBorders,
                    scenicMode: settings.scenicMode,
                    routePreference: settings.routePreference,
                    stopFrequency: settings.stopFrequency,
                    gasPrice: settings.gasPrice,
                    hotelPricePerNight: settings.hotelPricePerNight,
                    mealPricePerDay: settings.mealPricePerDay,
                  },

                  vehicle: journal.vehicle,

                  importInstructions: 'Load this template in My Experience Engine to follow the same route!',
                };

                const dataBlob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `trip-template-${journal.metadata.title.replace(/\s+/g, '-').toLowerCase()}.json`;
                link.click();
                URL.revokeObjectURL(url);

                showToast({
                  message: 'Trip template downloaded! Share it so others can follow your route.',
                  type: 'success',
                  duration: 4000,
                });
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              Share as Template
            </button>
          </div>
        </div>
      )}

      {/* Floating Add Memory Button */}
      <button
        onClick={() => handleOpenQuickCapture()}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center group"
        title="Add Memory"
      >
        <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform" />
      </button>

      {/* Quick Capture Dialog */}
      <QuickCaptureDialog
        open={quickCaptureOpen}
        onOpenChange={setQuickCaptureOpen}
        onSave={handleSaveQuickCapture}
        autoTaggedLocation={quickCaptureContext.locationName}
        autoTaggedSegment={quickCaptureContext.segmentIndex}
      />
    </div>
  );
}
