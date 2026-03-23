import { useState } from 'react';

interface LineageDisplayProps {
  /** The template's own title (this template). */
  currentTitle: string;
  /** Ordered ancestor titles, oldest first. May be empty. */
  lineageTitles: string[];
}

/**
 * Shows the fork chain below the author line.
 * One ancestor: "Based on Sarah's Manitoba Loop"
 * Two or more: "Based on Sarah's Manitoba Loop  [ Trip history ↓ ]"
 *   — expandable chain from original to current.
 */
export function LineageDisplay({ currentTitle, lineageTitles }: LineageDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  if (lineageTitles.length === 0) return null;

  const oldest = lineageTitles[0];
  const hasMultiple = lineageTitles.length >= 2;

  return (
    <div style={{ marginTop: 2 }}>
      <p style={{
        fontFamily: 'DM Mono, monospace',
        fontSize: 11,
        color: 'rgba(245, 240, 232, 0.45)',
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
      }}>
        <span>Based on {oldest}</span>
        {hasMultiple && (
          <button
            onClick={() => setExpanded(v => !v)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontFamily: 'DM Mono, monospace',
              fontSize: 11,
              color: 'rgba(245, 240, 232, 0.45)',
              cursor: 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: 2,
            }}
          >
            {expanded ? 'Trip history ↑' : 'Trip history ↓'}
          </button>
        )}
      </p>

      {expanded && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {lineageTitles.map((title, i) => (
            <p key={i} style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: 11,
              color: 'rgba(245, 240, 232, 0.35)',
              margin: 0,
            }}>
              {i === 0 ? 'Original' : `Fork ${i}`}{'  →  '}{title}
            </p>
          ))}
          <p style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: 11,
            color: 'rgba(245, 240, 232, 0.55)',
            margin: 0,
          }}>
            Fork {lineageTitles.length}{'  →  '}{currentTitle}{'  ← this template'}
          </p>
        </div>
      )}
    </div>
  );
}
