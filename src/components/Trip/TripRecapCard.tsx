/**
 * TripRecapCard — End-of-trip summary shown when all journal stops are visited.
 *
 * Replaces the plain JournalCompletionCard with a rich "MEE time souvenir":
 *  - Route header: Origin → Destination
 *  - Date span + driving days
 *  - Stats: stops, entries, photos, km
 *  - Parked car 🚗 at the end of a mini track (the journey is complete)
 *  - Export / share buttons
 *
 * 💚 My Experience Engine
 */

import { useState, useRef, useEffect } from 'react';
import type { TripJournal, TripSummary, TripSettings } from '../../types';
import { exportJournalAsHTML, exportJournalAsTemplate } from '../../lib/journal-export';

interface TripRecapCardProps {
  journal: TripJournal;
  summary: TripSummary;
  settings: TripSettings;
  totalStops: number;
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (s.getFullYear() === e.getFullYear()) {
    if (s.getMonth() === e.getMonth()) {
      return `${months[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
    }
    return `${months[s.getMonth()]} ${s.getDate()} – ${months[e.getMonth()]} ${e.getDate()}, ${s.getFullYear()}`;
  }
  return `${months[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()} – ${months[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
}

function calendarDays(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00').getTime();
  const e = new Date(end + 'T00:00:00').getTime();
  return Math.round((e - s) / 86_400_000) + 1;
}

export function TripRecapCard({ journal, summary, settings, totalStops }: TripRecapCardProps) {
  const [shareState, setShareState] = useState<'idle' | 'copying' | 'copied'>('idle');
  const shareTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(shareTimerRef.current), []);

  const origin      = summary.segments[0]?.from.name.split(',')[0] ?? 'Start';
  const destination = summary.segments.at(-1)?.to.name.split(',')[0] ?? 'End';

  const dateStart = journal.metadata.dates.actualStart ?? journal.metadata.dates.plannedStart;
  const dateEnd   = journal.metadata.dates.actualEnd   ?? journal.metadata.dates.plannedEnd;
  const dateRange = dateStart && dateEnd ? formatDateRange(dateStart, dateEnd) : null;
  const days      = dateStart && dateEnd ? calendarDays(dateStart, dateEnd) : summary.days?.length ?? 1;

  const entriesWithContent = journal.entries.filter(
    e => e.status === 'visited' && (e.notes || e.photos.length > 0),
  ).length;
  const totalPhotos = journal.entries.reduce((sum, e) => sum + e.photos.length, 0)
    + journal.quickCaptures.filter(qc => qc.photo).length;
  const kmDriven = Math.round(summary.totalDistanceKm);

  const handleShare = async () => {
    const text =
      `🏁 ${origin} → ${destination}\n` +
      (dateRange ? `📅 ${dateRange} · ${days} day${days !== 1 ? 's' : ''}\n` : '') +
      `📍 ${totalStops} stops\n` +
      (totalPhotos > 0 ? `📷 ${totalPhotos} photos\n` : '') +
      `🛣 ${kmDriven.toLocaleString()} km driven\n\n` +
      `Planned with My Experience Engine 💚`;

    setShareState('copying');
    try {
      if (navigator.share) {
        await navigator.share({ title: journal.metadata.title, text });
      } else {
        await navigator.clipboard.writeText(text);
        setShareState('copied');
        shareTimerRef.current = setTimeout(() => setShareState('idle'), 2500);
        return;
      }
    } catch {
      // share cancelled or failed — fall through
    }
    setShareState('idle');
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0f1a0a 0%, #1a2e0e 50%, #0c1a18 100%)',
        border: '1px solid rgba(134,239,172,0.2)',
        boxShadow: '0 0 40px rgba(74,222,128,0.08)',
      }}
    >
      {/* Header glow strip */}
      <div
        style={{
          height: 3,
          background: 'linear-gradient(90deg, #22c55e, #16a34a, #15803d)',
        }}
      />

      <div className="p-6 space-y-5">
        {/* Title */}
        <div className="text-center">
          <div className="text-3xl mb-2">🏁</div>
          <h3
            className="text-xl font-bold mb-1"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              background: 'linear-gradient(135deg, #86efac, #4ade80)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {origin} → {destination}
          </h3>
          {dateRange && (
            <p
              style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: '0.08em' }}
              className="text-green-400/70"
            >
              {dateRange} · {days} day{days !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Mini parked car track */}
        <div className="relative" style={{ height: 28 }}>
          <div
            className="absolute rounded-full"
            style={{
              top: '50%', left: 0, right: 0, height: 2,
              transform: 'translateY(-50%)',
              background: 'linear-gradient(90deg, rgba(74,222,128,0.4), rgba(74,222,128,0.8))',
            }}
          />
          {/* Start dot */}
          <div
            className="absolute rounded-full"
            style={{
              top: '50%', left: 0,
              width: 8, height: 8,
              transform: 'translate(-50%, -50%)',
              background: '#4ade80',
              boxShadow: '0 0 6px rgba(74,222,128,0.7)',
            }}
          />
          {/* Car parked at end */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              right: 0,
              transform: 'translate(50%, -60%)',
              fontSize: 18,
              filter: 'drop-shadow(0 2px 6px rgba(74,222,128,0.4))',
            }}
            title="Arrived!"
          >
            🚗
          </div>
          {/* End dot */}
          <div
            className="absolute rounded-full"
            style={{
              top: '50%', right: 0,
              width: 10, height: 10,
              transform: 'translate(50%, -50%)',
              background: '#22c55e',
              boxShadow: '0 0 10px rgba(74,222,128,0.9)',
            }}
          />
        </div>

        {/* Stats grid */}
        <div
          className="grid grid-cols-2 gap-3"
        >
          {[
            { icon: '📍', value: totalStops, label: 'stops visited' },
            { icon: '🛣', value: `${kmDriven.toLocaleString()} km`, label: 'driven' },
            { icon: '📷', value: totalPhotos, label: 'photos' },
            { icon: '✍️', value: entriesWithContent, label: 'journal entries' },
          ].map(({ icon, value, label }) => (
            <div
              key={label}
              className="rounded-xl p-3 flex items-center gap-3"
              style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.1)' }}
            >
              <span className="text-xl">{icon}</span>
              <div>
                <div className="text-sm font-bold text-green-200">{value}</div>
                <div
                  className="text-green-500/70"
                  style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}
                >
                  {label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleShare}
            disabled={shareState === 'copying'}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold tracking-wider uppercase transition-all"
            style={{
              background: shareState === 'copied'
                ? 'rgba(74,222,128,0.2)'
                : 'rgba(74,222,128,0.12)',
              border: `1px solid ${shareState === 'copied' ? 'rgba(74,222,128,0.5)' : 'rgba(74,222,128,0.2)'}`,
              color: '#86efac',
            }}
          >
            {shareState === 'copying' ? '…' : shareState === 'copied' ? '✓ Copied!' : '📤 Share'}
          </button>
          <button
            onClick={() => exportJournalAsHTML(journal, summary)}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold tracking-wider uppercase transition-all"
            style={{
              background: 'rgba(74,222,128,0.12)',
              border: '1px solid rgba(74,222,128,0.2)',
              color: '#86efac',
            }}
          >
            📄 Export
          </button>
          <button
            onClick={() => exportJournalAsTemplate(journal, summary, settings)}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold tracking-wider uppercase transition-all"
            style={{
              background: 'rgba(74,222,128,0.12)',
              border: '1px solid rgba(74,222,128,0.2)',
              color: '#86efac',
            }}
          >
            🔀 Template
          </button>
        </div>
      </div>
    </div>
  );
}
