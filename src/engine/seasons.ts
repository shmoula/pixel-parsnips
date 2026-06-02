export const SEASON_LENGTH = 20;

export interface SeasonConfig {
  number: number;
  name: string;
  startDay: number;
  endDay: number;
  leasePerDay: number;
  disasterTotalPct: number;
  target: number;
}

/** Hard-coded configs for Seasons 1–4 (the finite arc). */
export const SEASON_TABLE: SeasonConfig[] = [
  { number: 1, name: 'Spring Thaw',      startDay:  1, endDay: 20, leasePerDay: 15, disasterTotalPct: 0.15, target: 150 },
  { number: 2, name: 'Summer Heat',      startDay: 21, endDay: 40, leasePerDay: 20, disasterTotalPct: 0.20, target: 250 },
  { number: 3, name: 'Autumn Pressure',  startDay: 41, endDay: 60, leasePerDay: 25, disasterTotalPct: 0.28, target: 400 },
  { number: 4, name: 'Winter Crunch',    startDay: 61, endDay: 80, leasePerDay: 30, disasterTotalPct: 0.35, target: 600 },
];

/**
 * Returns the active SeasonConfig for the given calendar day.
 * For day > 80 (Endless), see Task 2 — this initial version covers Seasons 1–4 only.
 */
export function getSeasonForDay(day: number): SeasonConfig {
  for (const s of SEASON_TABLE) {
    if (day >= s.startDay && day <= s.endDay) return s;
  }
  // Temporary fallback for days > 80 — implemented in Task 2.
  return SEASON_TABLE[SEASON_TABLE.length - 1];
}
