/**
 * MakeMEETimeScreen — Trip sharing curation screen.
 *
 * "The trip was mine. What you receive becomes yours."
 *
 * The author decides what their gift includes — not an export dialog,
 * a handoff moment. Route & stops is the only required field.
 *
 * 💚 My Experience Engine
 */

import { useState, useCallback, useEffect } from 'react';
import type { PrintInput } from '../../../lib/canonical-trip';
import type { TripJournal, TripOrigin } from '../../../types';
import { exportTripAsTemplate, DEFAULT_SHARE_OPTIONS } from '../../../lib/journal-export';
import type { ShareOptions } from '../../../lib/journal-export';
import { ShareOptionsRow } from './ShareOptionsRow';
import { DiscoveriesPreview } from './DiscoveriesPreview';

const ORIGIN_PREF_KEY = 'mee-share-include-origin';

interface MakeMEETimeScreenProps {
  printInput: PrintInput;
  journal?: TripJournal | null;
  tripOrigin?: TripOrigin | null;
  onClose: () => void;
}

export function MakeMEETimeScreen({ printInput, journal, tripOrigin, onClose }: MakeMEETimeScreenProps) {
  const { summary, inputs: { locations, settings } } = printInput;

  // Persist origin preference; all others reset each session.
  const [options, setOptions] = useState<ShareOptions>(() => ({
    ...DEFAULT_SHARE_OPTIONS,
    includeOrigin: localStorage.getItem(ORIGIN_PREF_KEY) === 'true',
    includeNotes: !!(journal?.entries.some(e => e.rating || e.isHighlight)),
  }));

  const setOption = useCallback(<K extends keyof ShareOptions>(key: K, value: ShareOptions[K]) => {
    setOptions(prev => ({ ...prev, [key]: value }));
    if (key === 'includeOrigin') {
      localStorage.setItem(ORIGIN_PREF_KEY, String(value));
    }
  }, []);

  // Trap scroll behind overlay
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const origin      = locations.find(l => l.type === 'origin');
  const destination = locations.find(l => l.type === 'destination');
  const fullRouteLabel = origin && destination ? `${origin.name} → ${destination.name}` : '';
  const days        = summary.drivingDays ?? 1;
  const travelers   = settings.numTravelers ?? 1;

  // Route preview shown in the checklist row — reacts to includeOrigin toggle
  const routePreview = options.includeOrigin
    ? (fullRouteLabel || 'Your route')
    : (destination?.name ?? 'Your route');

  const hasDiscoveries = !!(
    journal?.entries.some(e => e.rating || e.isHighlight) ||
    journal?.quickCaptures.some(qc => qc.autoTaggedLocation || qc.photo)
  );

  const discoveriesCount =
    (journal?.entries.filter(e => e.rating || e.isHighlight).length ?? 0) +
    (journal?.quickCaptures.filter(qc => qc.autoTaggedLocation || qc.photo).length ?? 0);

  const canShare = options.includeRoute;

  const handleCreate = useCallback(() => {
    exportTripAsTemplate(printInput, options, journal ?? undefined, tripOrigin ?? undefined);
  }, [printInput, options, journal, tripOrigin]);

  return (
    <>
      {/* Dark wash */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(14, 11, 7, 0.82)', zIndex: 70 }}
        onClick={onClose}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 71,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        padding: '24px 16px',
      }}>
        <div style={{
          pointerEvents: 'auto',
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'rgba(14, 11, 7, 0.72)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          borderRadius: 16,
          border: '1px solid rgba(245, 240, 232, 0.08)',
          padding: '28px 24px 24px',
        }}>

          {/* Close */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 16, right: 16,
              background: 'none', border: 'none',
              color: 'rgba(245, 240, 232, 0.4)',
              fontSize: 20, cursor: 'pointer', lineHeight: 1,
            }}
            aria-label="Close"
          >
            ×
          </button>

          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{
              fontFamily: '"Cormorant Garamond", Georgia, serif',
              fontSize: 22,
              fontWeight: 600,
              color: 'rgba(245, 240, 232, 0.95)',
              margin: '0 0 6px',
              lineHeight: 1.2,
            }}>
              Make My MEE Time → Your MEE Time
            </h2>
            {fullRouteLabel && (
              <p style={{
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 13,
                color: 'rgba(245, 240, 232, 0.5)',
                margin: '0 0 2px',
              }}>
                {fullRouteLabel}
              </p>
            )}
            <p style={{
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: 12,
              color: 'rgba(245, 240, 232, 0.35)',
              margin: 0,
            }}>
              {days} day{days !== 1 ? 's' : ''} · {travelers} traveler{travelers !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Curation label */}
          <p style={{
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSize: 11,
            color: 'rgba(245, 240, 232, 0.35)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            margin: '0 0 4px',
          }}>
            What do you want to pass on?
          </p>

          {/* Checklist */}
          <div>
            <ShareOptionsRow
              checked={options.includeRoute}
              onChange={v => setOption('includeRoute', v)}
              label="Route & stops"
              preview={routePreview}
              required
            />
            <ShareOptionsRow
              checked={options.includeDates}
              onChange={v => setOption('includeDates', v)}
              label="Trip length & dates"
              preview={`${days} day${days !== 1 ? 's' : ''}`}
            />
            <ShareOptionsRow
              checked={options.includeTravelers}
              onChange={v => setOption('includeTravelers', v)}
              label="Travelers"
              preview={`${travelers} traveler${travelers !== 1 ? 's' : ''}`}
            />
            <ShareOptionsRow
              checked={options.includeBudget}
              onChange={v => setOption('includeBudget', v)}
              label="Budget breakdown"
              preview={summary.costBreakdown
                ? `~C$${Math.round(summary.costBreakdown.perPerson)}/person`
                : 'Fuel, hotels, food'}
            />
            <ShareOptionsRow
              checked={options.includeOrigin}
              onChange={v => setOption('includeOrigin', v)}
              label="Starting location"
              preview={origin?.name ?? 'Your starting point'}
            />
            {hasDiscoveries && (
              <ShareOptionsRow
                checked={options.includeNotes}
                onChange={v => setOption('includeNotes', v)}
                label="Your notes & discoveries"
                preview={`${discoveriesCount} highlight${discoveriesCount !== 1 ? 's' : ''}`}
              />
            )}
          </div>

          {/* Discoveries preview */}
          {hasDiscoveries && options.includeNotes && journal && (
            <DiscoveriesPreview journal={journal} />
          )}

          {/* Share button */}
          <div style={{ marginTop: 24 }}>
            <button
              onClick={handleCreate}
              disabled={!canShare}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: 100,
                background: canShare ? '#f97316' : 'rgba(245, 240, 232, 0.1)',
                border: 'none',
                color: canShare ? '#fff' : 'rgba(245, 240, 232, 0.3)',
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '0.06em',
                cursor: canShare ? 'pointer' : 'not-allowed',
                transition: 'all 200ms ease',
              }}
            >
              Create shareable file
            </button>

            {!canShare && (
              <p style={{
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 11,
                color: '#f97316',
                textAlign: 'center',
                margin: '8px 0 0',
                opacity: 0.8,
              }}>
                * Route &amp; stops is required to share a trip.
              </p>
            )}

            {canShare && (
              <p style={{
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 11,
                color: 'rgba(245, 240, 232, 0.3)',
                textAlign: 'center',
                margin: '8px 0 0',
                lineHeight: 1.5,
              }}>
                Whoever loads this will build their own MEE time from your foundation.
                They can tweak anything before they go.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
