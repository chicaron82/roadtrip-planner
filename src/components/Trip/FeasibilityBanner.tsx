/**
 * FeasibilityBanner — Trip health check at a glance
 *
 * Shows 🟢🟡🔴 status with expandable warnings.
 * Pure display component — all logic lives in feasibility.ts
 */

import { useState } from 'react';
import { cn } from '../../lib/utils';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Clock,
  Users,
  Sunrise,
  Fuel,
  Lightbulb,
  CalendarRange,
} from 'lucide-react';
import type {
  FeasibilityResult,
  FeasibilityStatus,
  FeasibilityWarning,
  WarningCategory,
  WarningSeverity,
} from '../../lib/feasibility';

// ==================== PROPS ====================

interface FeasibilityBannerProps {
  result: FeasibilityResult;
  numTravelers?: number;
  className?: string;
  /** Start collapsed — useful when embedded in dense layouts */
  defaultCollapsed?: boolean;
}

// ==================== STATUS CONFIG ====================

const STATUS_CONFIG: Record<FeasibilityStatus, {
  label: string;
  icon: typeof CheckCircle;
  containerClass: string;
  iconClass: string;
  dotClass: string;
}> = {
  'on-track': {
    label: 'On Track',
    icon: CheckCircle,
    containerClass: 'border-green-500/25 bg-green-500/10',
    iconClass: 'text-green-500',
    dotClass: 'bg-green-500',
  },
  'tight': {
    label: 'Getting Tight',
    icon: AlertTriangle,
    containerClass: 'border-amber-500/25 bg-amber-500/10',
    iconClass: 'text-amber-400',
    dotClass: 'bg-amber-500',
  },
  'over': {
    label: 'Needs Attention',
    icon: XCircle,
    containerClass: 'border-red-500/25 bg-red-500/10',
    iconClass: 'text-red-400',
    dotClass: 'bg-red-500',
  },
};

const CATEGORY_ICONS: Record<WarningCategory, typeof DollarSign> = {
  budget: DollarSign,
  'drive-time': Clock,
  driver: Users,
  timing: Sunrise,
  passenger: Users,
  fuel: Fuel,
  'date-window': CalendarRange,
};

const SEVERITY_STYLES: Record<WarningSeverity, {
  badge: string;
  text: string;
}> = {
  info: {
    badge: 'bg-blue-500/15 text-blue-400',
    text: 'text-blue-400',
  },
  warning: {
    badge: 'bg-amber-500/15 text-amber-400',
    text: 'text-amber-400',
  },
  critical: {
    badge: 'bg-red-500/15 text-red-400',
    text: 'text-red-400',
  },
};

// ==================== COMPONENT ====================

// Stable string key for a warning — used to track dismissals within a session.
function getWarningKey(w: FeasibilityWarning): string {
  return `${w.category}-${w.dayNumber ?? 'trip'}-${w.message}`;
}

export function FeasibilityBanner({
  result,
  numTravelers = 1,
  className,
  defaultCollapsed = false,
}: FeasibilityBannerProps) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const [dismissed, setDismissed] = useState(() => new Set<string>());
  const config = STATUS_CONFIG[result.status];
  const StatusIcon = config.icon;

  // Reset dismissals when the warning set changes (route recalculated → fresh context).
  // Signature uses category + dayNumber + severity so structural changes clear dismissals
  // even if the message text is unchanged.
  const resultSignature = result.warnings
    .map(w => `${w.category}:${w.dayNumber ?? 'trip'}:${w.severity}`)
    .join('|');
  const [prevSig, setPrevSig] = useState(resultSignature);
  if (prevSig !== resultSignature) {
    setPrevSig(resultSignature);
    setDismissed(new Set());
  }

  const visibleWarnings = result.warnings.filter(w => !dismissed.has(getWarningKey(w)));
  const dismissedCount = result.warnings.length - visibleWarnings.length;

  const warningCount = result.warnings.length;
  const criticalCount = result.warnings.filter(w => w.severity === 'critical').length;
  const isMultiPerson = numTravelers > 1;

  // Pulse only when there are still unacknowledged warnings visible
  const needsAttention = !expanded && visibleWarnings.length > 0 && result.status !== 'on-track';

  return (
    <div
      className={cn(
        'rounded-xl border-2 transition-all duration-300 relative',
        config.containerClass,
        className,
      )}
      role="status"
      aria-label={`Trip feasibility: ${config.label}`}
    >
      {/* Pulsing attention ring — signals "expand me" when collapsed with warnings */}
      {needsAttention && (
        <div className={cn(
          'absolute inset-[-2px] rounded-xl ring-2 animate-pulse pointer-events-none z-10',
          result.status === 'over' ? 'ring-red-400/70' : 'ring-amber-400/70',
        )} />
      )}

      {/* Header — always visible */}
      <button
        className="w-full flex items-center justify-between p-3 gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2.5">
          <div className={cn('w-2.5 h-2.5 rounded-full animate-pulse', config.dotClass)} />
          <StatusIcon className={cn('w-5 h-5', config.iconClass)} />
          <span className="font-semibold text-sm text-foreground">
            {config.label}
          </span>
          {warningCount > 0 && (
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full font-medium',
              criticalCount > 0 ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400',
              !expanded && visibleWarnings.length > 0 && 'animate-pulse',
            )}>
              {warningCount} {warningCount === 1 ? 'note' : 'notes'}
              {dismissedCount > 0 && (
                <span className="opacity-50 font-normal ml-1">({dismissedCount} ✓)</span>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Budget chip: per-person for groups, total for solo */}
          {result.summary.budgetUtilization > 0 && (
            <span className="text-xs text-foreground/50 hidden sm:inline">
              {isMultiPerson
                ? `$${result.summary.perPersonCost}/person · ${Math.round(result.summary.budgetUtilization * 100)}% budget`
                : `${Math.round(result.summary.budgetUtilization * 100)}% budget`
              }
            </span>
          )}
          {expanded
            ? <ChevronUp className="w-4 h-4 text-foreground/40" />
            : <ChevronDown className="w-4 h-4 text-foreground/40" />
          }
        </div>
      </button>

      {/* Expanded: Warning list */}
      {expanded && warningCount > 0 && (
        <div className="px-3 pb-3 space-y-2">
          <div className="border-t border-white/10 pt-2" />
          {visibleWarnings.map((warning) => (
            <WarningRow
              key={getWarningKey(warning)}
              warning={warning}
              onDismiss={() => setDismissed(prev => new Set([...prev, getWarningKey(warning)]))}
            />
          ))}
          {dismissedCount > 0 && visibleWarnings.length === 0 && (
            <p className="text-xs text-foreground/35 text-center py-1">
              All notes acknowledged — looking good.
            </p>
          )}
        </div>
      )}

      {/* Expanded: All clear message */}
      {expanded && warningCount === 0 && (
        <div className="px-3 pb-3">
          <div className="border-t border-white/10 pt-2" />
          <p className="text-sm text-green-500 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            All green. Fuel up, get sleep, depart on time. You've got this.
          </p>
        </div>
      )}
    </div>
  );
}

// ==================== WARNING ROW ====================

function WarningRow({ warning, onDismiss }: { warning: FeasibilityWarning; onDismiss?: () => void }) {
  const CategoryIcon = CATEGORY_ICONS[warning.category] || AlertTriangle;
  const severity = SEVERITY_STYLES[warning.severity];

  return (
    <div className="flex items-start gap-2.5 text-sm">
      <CategoryIcon className={cn('w-4 h-4 mt-0.5 shrink-0', severity.text)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('font-medium', severity.text)}>
            {warning.message}
          </span>
          {warning.dayNumber != null && (
            <span className="text-xs text-foreground/40">Day {warning.dayNumber}</span>
          )}
        </div>
        {warning.detail && (
          <p className="text-xs text-foreground/50 mt-0.5">{warning.detail}</p>
        )}
        {warning.suggestion && (
          <p className="text-xs text-foreground/60 mt-1 flex items-center gap-1">
            <Lightbulb className="w-3 h-3 text-amber-500 shrink-0" />
            {warning.suggestion}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={cn(
          'text-[10px] px-1.5 py-0.5 rounded font-medium',
          severity.badge,
        )}>
          {warning.severity}
        </span>
        {onDismiss && (
          <button
            onClick={onDismiss}
            title="Acknowledge — I've read this"
            className="text-foreground/25 hover:text-foreground/60 transition-colors text-base leading-none"
            aria-label="Acknowledge warning"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
