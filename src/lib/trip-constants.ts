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

  /** Day overflow: tolerance for slightly exceeding maxDriveHours in day splitting.
   *  Humans "push through 30 more minutes" to reach the next city rather than
   *  stopping at a highway km marker. Without this, an 8h30m day (510 min) gets
   *  split into two 4h15m days, doubling the trip length. */
  dayOverflow: {
    /** Fixed hours of grace beyond maxDriveHours before forcing a new day.
     *  1 hour is reasonable — especially with multiple drivers sharing the load. */
    toleranceHours: 1,
  },

  /** Budget analysis thresholds */
  budget: {
    /** Utilization fraction that triggers an amber (tight) warning. */
    tightThreshold: 0.85,
    /** Utilization fraction that triggers a red (over-budget) warning. */
    overThreshold: 1.0,
  },

  /**
   * OSRM routing corrections
   * The public OSRM demo server uses conservative road speeds (~15% faster than
   * real-world travel). Multiply raw durations by this factor to align with
   * typical Google Maps / real-drive times.
   */
  routing: {
    osrmDurationFactor: 0.85,
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
