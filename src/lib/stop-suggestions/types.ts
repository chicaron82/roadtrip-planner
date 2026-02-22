/** Mutable simulation state threaded through per-segment check functions */
export interface SimState {
  currentFuel: number;
  distanceSinceLastFill: number;
  hoursSinceLastFill: number;
  currentTime: Date;
  hoursOnRoad: number;
  totalDrivingToday: number;
  lastBreakTime: Date;
  currentDayNumber: number;
  currentTzAbbr: string | null;
  // Computed from stopFrequency config — constant throughout simulation
  restBreakInterval: number;
  comfortRefuelHours: number;
}
