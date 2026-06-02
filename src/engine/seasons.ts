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
 * Returns the active SeasonConfig for any calendar day ≥ 1.
 * Days 1–80 use SEASON_TABLE; days ≥ 81 use the Endless formula:
 *   - Season N = 5 + floor((day - 81) / 20)
 *   - startDay = 81 + 20 * (N - 5)
 *   - endDay   = startDay + 19
 *   - leasePerDay      = 30 + 2 * (N - 4)
 *   - disasterTotalPct = min(0.35 + 0.02 * (N - 4), 0.50)
 *   - target           = 600 + 200 * (N - 4)
 */
export function getSeasonForDay(day: number): SeasonConfig {
  for (const s of SEASON_TABLE) {
    if (day >= s.startDay && day <= s.endDay) return s;
  }
  // Endless Season N (N ≥ 5)
  const n = 5 + Math.floor((day - 81) / 20);
  const startDay = 81 + 20 * (n - 5);
  return {
    number: n,
    name: 'Deep Winter',
    startDay,
    endDay: startDay + 19,
    leasePerDay: 30 + 2 * (n - 4),
    disasterTotalPct: Math.min(0.35 + 0.02 * (n - 4), 0.50),
    target: 600 + 200 * (n - 4),
  };
}
