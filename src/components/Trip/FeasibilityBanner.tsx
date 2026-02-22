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
    containerClass: 'border-green-200 bg-green-50/80',
    iconClass: 'text-green-600',
    dotClass: 'bg-green-500',
  },
  'tight': {
    label: 'Getting Tight',
    icon: AlertTriangle,
    containerClass: 'border-amber-200 bg-amber-50/80',
    iconClass: 'text-amber-600',
    dotClass: 'bg-amber-500',
  },
  'over': {
    label: 'Needs Attention',
    icon: XCircle,
    containerClass: 'border-red-200 bg-red-50/80',
    iconClass: 'text-red-600',
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
    badge: 'bg-blue-100 text-blue-700',
    text: 'text-blue-700',
  },
  warning: {
    badge: 'bg-amber-100 text-amber-700',
    text: 'text-amber-700',
  },
  critical: {
    badge: 'bg-red-100 text-red-700',
    text: 'text-red-700',
  },
};

// ==================== COMPONENT ====================

export function FeasibilityBanner({
  result,
  numTravelers = 1,
  className,
  defaultCollapsed = false,
}: FeasibilityBannerProps) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const config = STATUS_CONFIG[result.status];
  const StatusIcon = config.icon;

  const warningCount = result.warnings.length;
  const criticalCount = result.warnings.filter(w => w.severity === 'critical').length;
  const isMultiPerson = numTravelers > 1;

  return (
    <div
      className={cn(
        'rounded-xl border-2 transition-all duration-300',
        config.containerClass,
        className,
      )}
      role="status"
      aria-label={`Trip feasibility: ${config.label}`}
    >
      {/* Header — always visible */}
      <button
        className="w-full flex items-center justify-between p-3 gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2.5">
          <div className={cn('w-2.5 h-2.5 rounded-full animate-pulse', config.dotClass)} />
          <StatusIcon className={cn('w-5 h-5', config.iconClass)} />
          <span className="font-semibold text-sm text-gray-800">
            {config.label}
          </span>
          {warningCount > 0 && (
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full font-medium',
              criticalCount > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
            )}>
              {warningCount} {warningCount === 1 ? 'note' : 'notes'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Budget chip: per-person for groups, total for solo */}
          {result.summary.budgetUtilization > 0 && (
            <span className="text-xs text-gray-500 hidden sm:inline">
              {isMultiPerson
                ? `$${result.summary.perPersonCost}/person · ${Math.round(result.summary.budgetUtilization * 100)}% budget`
                : `${Math.round(result.summary.budgetUtilization * 100)}% budget`
              }
            </span>
          )}
          {expanded
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
          }
        </div>
      </button>

      {/* Expanded: Warning list */}
      {expanded && warningCount > 0 && (
        <div className="px-3 pb-3 space-y-2">
          <div className="border-t border-gray-200/60 pt-2" />
          {result.warnings.map((warning, i) => (
            <WarningRow key={`${warning.category}-${warning.dayNumber ?? 'trip'}-${i}`} warning={warning} />
          ))}
        </div>
      )}

      {/* Expanded: All clear message */}
      {expanded && warningCount === 0 && (
        <div className="px-3 pb-3">
          <div className="border-t border-gray-200/60 pt-2" />
          <p className="text-sm text-green-700 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            All green. Fuel up, get sleep, depart on time. You've got this.
          </p>
        </div>
      )}
    </div>
  );
}

// ==================== WARNING ROW ====================

function WarningRow({ warning }: { warning: FeasibilityWarning }) {
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
            <span className="text-xs text-gray-400">Day {warning.dayNumber}</span>
          )}
        </div>
        {warning.detail && (
          <p className="text-xs text-gray-500 mt-0.5">{warning.detail}</p>
        )}
        {warning.suggestion && (
          <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
            <Lightbulb className="w-3 h-3 text-amber-500 shrink-0" />
            {warning.suggestion}
          </p>
        )}
      </div>
      <span className={cn(
        'text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0',
        severity.badge,
      )}>
        {warning.severity}
      </span>
    </div>
  );
}
