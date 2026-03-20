/**
 * VoilaScreen — The universal results surface.
 *
 * Every calculated trip ends here — icebreaker path and classic wizard path.
 * The screen doesn't know or care how the user got here. It presents the trip.
 *
 * Architecture:
 *   VoilaScreen (orchestrator — state, layout, callbacks)
 *   ├── VoilaHero (route label + title + reveal line)
 *   ├── VoilaDashboard (3 sacred chips)
 *   ├── VoilaCardRail (scroll-snap exploration layer)
 *   ├── VoilaLockIn (800ms commit overlay — shown on lock)
 *   ├── ItineraryDetailPanel (Tier A — shown when activeDetail = 'itinerary')
 *   └── TripSnapshotPanel (Tier B — shown when activeDetail = 'snapshot')
 *
 * 💚 My Experience Engine — Same stage. Same destination. Every user. Every time.
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { TripSummary, TripSettings, Vehicle, Location } from '../../types';
import { buildSeededTitle } from '../../lib/trip-title-seeds';
import { VoilaHero } from './VoilaHero';
import { VoilaDashboard } from './VoilaDashboard';
import { VoilaRoutePreview } from './VoilaRoutePreview';
import { VoilaCardRail } from './VoilaCardRail';
import { VoilaLockIn } from './VoilaLockIn';
import { ItineraryDetailPanel } from './ItineraryDetailPanel';
import { TripSnapshotPanel } from './TripSnapshotPanel';

type DetailCard = 'itinerary' | 'snapshot';

interface VoilaScreenProps {
  summary: TripSummary;
  settings: TripSettings;
  vehicle: Vehicle;
  locations: Location[];
  customTitle?: string | null;
  onEditTrip: () => void;
  onLockIn: () => void;
  onShare: () => void;
}

export function VoilaScreen({
  summary, settings, locations, customTitle,
  onEditTrip, onLockIn, onShare,
}: VoilaScreenProps) {
  const [activeDetail, setActiveDetail] = useState<DetailCard | null>(null);
  const [lockInActive, setLockInActive] = useState(false);

  // Build route label from locations
  const origin = locations.find(l => l.type === 'origin')?.name?.split(',')[0].trim() ?? '';
  const dest = locations.find(l => l.type === 'destination')?.name?.split(',')[0].trim() ?? '';
  const routeLabel = origin && dest ? `${origin} → ${dest}` : dest || origin || 'Your Route';

  // Title: custom if set, otherwise seeded (deterministic by destination + days + travelers)
  const destination = dest || (locations[locations.length - 1]?.name?.split(',')[0].trim() ?? '');
  const title = customTitle || buildSeededTitle({
    destination,
    days: summary.drivingDays,
    travelerCount: settings.numTravelers ?? 1,
  });

  const handleLockIn = useCallback(() => {
    setLockInActive(true);
  }, []);

  const handleLockInComplete = useCallback(() => {
    setLockInActive(false);
    onLockIn();
  }, [onLockIn]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 30,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      pointerEvents: 'none',
    }}>
      {/* Glass panel — centered, max 620px, same material as wizard */}
      <div
        className="sidebar-dark mee-panel"
        style={{
          width: '100%',
          maxWidth: 620,
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          pointerEvents: 'auto',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px 12px',
          borderBottom: '1px solid rgba(245, 240, 232, 0.07)',
          flexShrink: 0,
        }}>
          <button
            onClick={onEditTrip}
            style={{
              background: 'rgba(245, 240, 232, 0.06)',
              border: '1px solid rgba(245, 240, 232, 0.1)',
              borderRadius: 100,
              padding: '6px 14px',
              color: 'rgba(245, 240, 232, 0.7)',
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Edit Trip
          </button>

          <p style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize: 15,
            color: 'rgba(245, 240, 232, 0.5)',
            margin: '0 8px',
            flex: 1,
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {routeLabel}
          </p>

          <button
            onClick={onShare}
            style={{
              background: 'rgba(245, 240, 232, 0.06)',
              border: '1px solid rgba(245, 240, 232, 0.1)',
              borderRadius: 100,
              padding: '6px 14px',
              color: 'rgba(245, 240, 232, 0.7)',
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Share
          </button>
        </div>

        {/* Scrollable content — staggered reveal */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut', delay: 0.05 }}
          >
            <VoilaHero routeLabel={routeLabel} title={title} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut', delay: 0.2 }}
          >
            <VoilaDashboard summary={summary} settings={settings} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut', delay: 0.35 }}
          >
            <VoilaRoutePreview geometry={summary.fullGeometry} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut', delay: 0.5 }}
          >
            <VoilaCardRail
              summary={summary}
              settings={settings}
              onOpenDetail={setActiveDetail}
            />
          </motion.div>
        </div>

        {/* Sticky bottom bar — always visible */}
        <div style={{
          display: 'flex',
          gap: 10,
          padding: '12px 16px',
          borderTop: '1px solid rgba(245, 240, 232, 0.07)',
          flexShrink: 0,
        }}>
          <button
            onClick={onEditTrip}
            style={{
              flex: 1,
              padding: '13px 0',
              background: 'rgba(245, 240, 232, 0.06)',
              border: '1px solid rgba(245, 240, 232, 0.1)',
              borderRadius: 12,
              color: '#f5f0e8',
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Let MEE make it better
          </button>
          <button
            onClick={handleLockIn}
            style={{
              flex: 1,
              padding: '13px 0',
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
            Lock it in →
          </button>
        </div>

        {/* Tier A — Itinerary detail */}
        {activeDetail === 'itinerary' && (
          <ItineraryDetailPanel
            summary={summary}
            onBack={() => setActiveDetail(null)}
            onLockIn={() => { setActiveDetail(null); handleLockIn(); }}
            onEditTrip={() => { setActiveDetail(null); onEditTrip(); }}
          />
        )}

        {/* Tier B — Trip Snapshot */}
        {activeDetail === 'snapshot' && (
          <TripSnapshotPanel
            summary={summary}
            settings={settings}
            onBack={() => setActiveDetail(null)}
          />
        )}
      </div>

      {/* Lock-in micro-moment — renders above everything */}
      {lockInActive && (
        <VoilaLockIn title={title} onComplete={handleLockInComplete} />
      )}
    </div>
  );
}
