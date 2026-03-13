/**
 * CollapsibleSection — smart-default accordion wrapper for wizard steps.
 *
 * Always-visible header row: icon · title · [summary chip when closed] · chevron
 * Collapsible body: children, animated via CSS grid-template-rows.
 *
 * Usage:
 *   <CollapsibleSection
 *     title="Travelers"
 *     icon={<Users className="h-4 w-4" />}
 *     summary={`${n} travelers · ${d} drivers`}
 *   >
 *     <TravelersSection headless settings={…} setSettings={…} />
 *   </CollapsibleSection>
 */

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  /** Optional icon — Lucide element or emoji string. */
  icon?: ReactNode;
  /** Short text shown in the header when collapsed, e.g. "4 travelers · 2 drivers". */
  summary?: string;
  /** Whether the section starts expanded. Default: false. */
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  icon,
  summary,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className="border-t pt-4">
      {/* ── Toggle button ── */}
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="w-full flex items-center justify-between gap-2 text-left mb-0 group"
      >
        {/* Left: icon + title */}
        <span className="flex items-center gap-2 text-sm font-semibold">
          {icon && <span className="text-primary">{icon}</span>}
          {title}
        </span>

        {/* Right: summary chip + chevron */}
        <span className="flex items-center gap-2 shrink-0">
          {!isOpen && summary && (
            <span className="text-[11px] text-muted-foreground/70 bg-muted/40 border border-white/8 px-2 py-0.5 rounded-full leading-tight max-w-[160px] truncate">
              {summary}
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </span>
      </button>

      {/* ── Collapsible body — CSS grid trick for smooth height animation ── */}
      <div
        id={contentId}
        style={{
          display: 'grid',
          gridTemplateRows: isOpen ? '1fr' : '0fr',
          transition: 'grid-template-rows 200ms ease',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div className="pt-3">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
