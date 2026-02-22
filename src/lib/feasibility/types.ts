export type FeasibilityStatus = 'on-track' | 'tight' | 'over';

export type WarningCategory =
  | 'budget'        // Over budget, close to budget
  | 'drive-time'    // Exceeds max drive hours
  | 'driver'        // Single driver fatigue, uneven rotation
  | 'timing'        // Late arrivals, early departures
  | 'passenger'     // Per-person cost changes
  | 'fuel'          // Fuel range / gas stop warnings
  | 'date-window';  // Not enough calendar days for transit + free time

export type WarningSeverity = 'info' | 'warning' | 'critical';

export interface FeasibilityWarning {
  category: WarningCategory;
  severity: WarningSeverity;
  message: string;
  detail?: string;          // Extended explanation
  dayNumber?: number;       // Which day this applies to (undefined = whole trip)
  suggestion?: string;      // "Consider adding an overnight stop"
}

export interface FeasibilityResult {
  status: FeasibilityStatus;
  warnings: FeasibilityWarning[];
  summary: {
    totalBudgetUsed: number;
    totalBudgetAvailable: number;
    budgetUtilization: number;    // 0-1 (percentage)
    longestDriveDay: number;      // minutes
    maxDriveLimit: number;        // minutes
    perPersonCost: number;
    totalDays: number;
  };
}

export interface RefinementChange {
  travelersBefore?: number;
  travelersAfter?: number;
  driversBefore?: number;
  driversAfter?: number;
  stopsAdded?: number;
  stopsRemoved?: number;
}
