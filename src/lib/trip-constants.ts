/**
 * Central home for every magic number in the trip planning pipeline.
 * Tune here instead of grep-hunting across 5 files.
 */
export const TRIP_CONSTANTS = {

  /** Departure time computation */
  departure: {
    /** Earliest allowed departure hour (24h). */
    minHour: 5,
    /** Max departure hour for a "full day" leg (≥75% of maxDriveHours). */
    maxHourFullDay: 10,
    /** Max departure hour for a short leg (<75% of maxDriveHours). */
    maxHourShortLeg: 18,
    /** Ratio of maxDriveHours above which a day is considered "full". */
    fullDayThreshold: 0.75,
  },

  /** Rest enforcement between driving days */
  rest: {
    /** Minimum hours of sleep guaranteed between estimated arrival and next departure. */
    minHours: 7,
  },

  /** Feasibility analysis thresholds */
  feasibility: {
    /** Grace buffer (hours) before a "hard limit exceeded" warning fires. */
    driveTimeGraceHours: 1,
    /** Fraction of max drive time that triggers an amber (tight) warning. */
    tightDriveThreshold: 0.90,
    /** Hours past targetArrivalHour before Day-1 late-arrival hint fires. */
    day1ArrivalBuffer: 0.5,
    /** Minimum number of drivers before per-driver shift hints appear. */
    minDriversForRotation: 2,
    /** Minimum driving minutes per day to show per-driver breakdown. */
    minDrivingMinutesForBreakdown: 120,
  },

  /** Budget analysis thresholds */
  budget: {
    /** Utilization fraction that triggers an amber (tight) warning. */
    tightThreshold: 0.85,
    /** Utilization fraction that triggers a red (over-budget) warning. */
    overThreshold: 1.0,
  },

  /** Stop suggestion and consolidation parameters */
  stops: {
    /** Time window (ms) within which nearby stops are merged. */
    mergeWindowMs: 60 * 60 * 1000,

    /** Priority tiers used when two stops compete for the same slot. Higher wins. */
    priorities: {
      overnight: 4,
      fuel: 3,
      meal: 2,
      rest: 1,
    } as const,

    /**
     * Safety margin subtracted from vehicle range before computing fuel stops.
     * safeRangeKm = vehicleRangeKm × (1 − buffer)
     */
    buffers: {
      conservative: 0.30,
      balanced: 0.25,
      aggressive: 0.20,
    } as const,

    /** How many hours between mandatory rest breaks (by driving style). */
    restInterval: {
      conservative: 1.5,
      balanced: 2.0,
      aggressive: 2.5,
    } as const,

    /** How many hours between comfort refuel stops (by driving style). */
    comfortRefuel: {
      conservative: 2.5,
      balanced: 3.5,
      aggressive: 4.5,
    } as const,
  },

} as const;
