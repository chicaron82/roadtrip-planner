/**
 * PostTripScreen — Full-screen "thank you" surface after journal finalization.
 *
 * Shown when journal.finalized is true. Presents the trip as a sealed souvenir:
 *  - Earned-reveal animation (staggered, like VoilaScreen)
 *  - Title + route + date range
 *  - Stats grid (stops, km, photos, entries)
 *  - Share / Print / Template export buttons
 *  - "Start fresh" CTA → clears active journal, returns to landing
 *
 * 💚 My Experience Engine — Thank you for your MEE time.
 */

import { motion } from 'framer-motion';
import type { TripJournal, TripSettings } from '../../../types';
import { exportJournalAsHTML } from '../../../lib/journal-export';
import { exportJournalAsTemplate } from '../../../lib/journal-export-templates';
import { getTripDisplayEndpoints } from '../../../lib/trip-summary-view';
import type { TripRecapSummary } from '../../../lib/trip-summary-slices';
import { formatDateRange } from '../../../lib/trip-formatters';

interface PostTripScreenProps {
  journal: TripJournal;
  summary: TripRecapSummary;
  settings: TripSettings;
  onStartFresh: () => void;
  onShare: () => void;
  onPrint?: () => void;
}


export function PostTripScreen({
  journal, summary, settings, onStartFresh, onShare, onPrint,
}: PostTripScreenProps) {
  const endpoints = getTripDisplayEndpoints(summary);
  const origin = endpoints.origin?.name.split(',')[0] ?? 'Start';
  const destination = endpoints.destination?.name.split(',')[0] ?? 'End';
  const routeLabel = `${origin} → ${destination}`;

  const dateStart = journal.metadata.dates.actualStart ?? journal.metadata.dates.plannedStart;
  const dateEnd   = journal.metadata.dates.actualEnd   ?? journal.metadata.dates.plannedEnd;
  const dateRange = dateStart && dateEnd ? formatDateRange(dateStart, dateEnd) : null;

  const totalStops = journal.entries.filter(e => e.status === 'visited').length;
  const totalPhotos = journal.entries.reduce((sum, e) => sum + e.photos.length, 0)
    + journal.quickCaptures.filter(qc => qc.photo).length;
  const entriesWithContent = journal.entries.filter(
    e => e.status === 'visited' && (e.notes || e.photos.length > 0),
  ).length;
  const kmDriven = Math.round(summary.totalDistanceKm);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 40,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
    }}>
      {/* Dark wash */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(14, 11, 7, 0.88)' }} />

      {/* Glass panel */}
      <div
        className="sidebar-dark mee-panel"
        style={{
          width: '100%',
          maxWidth: 620,
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' } as React.CSSProperties}>
          {/* Green glow strip */}
          <div style={{ height: 3, background: 'linear-gradient(90deg, #22c55e, #16a34a, #15803d)' }} />

          {/* Hero section */}
          <div style={{ padding: '48px 28px 24px', textAlign: 'center' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏁</div>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              style={{
                fontFamily: '"DM Mono", monospace',
                fontSize: 12,
                color: '#f97316',
                letterSpacing: '0.1em',
                margin: '0 0 12px',
              }}
            >
              Thank you for your MEE time.
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.45 }}
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 'clamp(26px, 6vw, 38px)',
                fontWeight: 600,
                color: '#f5f0e8',
                margin: '0 0 8px',
                lineHeight: 1.15,
              }}
            >
              {journal.metadata.title}
            </motion.h1>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35, delay: 0.6 }}
            >
              <p style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 14,
                color: 'rgba(245, 240, 232, 0.55)',
                margin: 0,
              }}>
                {routeLabel}
              </p>
              {dateRange && (
                <p style={{
                  fontFamily: '"DM Mono", monospace',
                  fontSize: 11,
                  color: 'rgba(245, 240, 232, 0.35)',
                  letterSpacing: '0.06em',
                  margin: '4px 0 0',
                }}>
                  {dateRange}
                </p>
              )}
            </motion.div>
          </div>

          {/* Parked car track */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.7 }}
            style={{ padding: '0 28px 24px' }}
          >
            <div className="relative" style={{ height: 28 }}>
              <div
                className="absolute rounded-full"
                style={{
                  top: '50%', left: 0, right: 0, height: 2,
                  transform: 'translateY(-50%)',
                  background: 'linear-gradient(90deg, rgba(74,222,128,0.4), rgba(74,222,128,0.8))',
                }}
              />
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
              <div style={{
                position: 'absolute', top: '50%', right: 0,
                transform: 'translate(50%, -60%)', fontSize: 18,
                filter: 'drop-shadow(0 2px 6px rgba(74,222,128,0.4))',
              }}>
                🚗
              </div>
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
          </motion.div>

          {/* Stats grid */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.85 }}
            style={{ padding: '0 28px 24px' }}
          >
            <div className="grid grid-cols-2 gap-3">
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
          </motion.div>

          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 1.0 }}
            style={{ padding: '0 28px 32px' }}
          >
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={onShare}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold tracking-wider uppercase transition-all"
                style={{
                  background: 'rgba(74,222,128,0.12)',
                  border: '1px solid rgba(74,222,128,0.2)',
                  color: '#86efac',
                }}
              >
                📤 Share
              </button>
              {onPrint && (
                <button
                  onClick={onPrint}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold tracking-wider uppercase transition-all"
                  style={{
                    background: 'rgba(74,222,128,0.12)',
                    border: '1px solid rgba(74,222,128,0.2)',
                    color: '#86efac',
                  }}
                >
                  🖨 Print
                </button>
              )}
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
          </motion.div>
        </div>

        {/* Sticky bottom bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 1.15 }}
          style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(245, 240, 232, 0.07)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={onStartFresh}
            style={{
              width: '100%',
              padding: '14px 0',
              background: '#f97316',
              border: 'none',
              borderRadius: 12,
              color: '#fff',
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Start fresh →
          </button>
        </motion.div>
      </div>
    </div>
  );
}
