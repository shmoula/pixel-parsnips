import type { Outcome } from './runner';

export interface Metrics {
  trials: number;
  winPct: number;
  bankruptPct: number;
  targetMissPct: number;
  avgPeak: number;
  medianPeak: number;
  p10Peak: number;
  p90Peak: number;
  overshoot: number; // avgPeak / finalTarget
  clearedSeasonPct: number[]; // index 0..3 = seasons 1..4
}

function pct(part: number, total: number): number { return total === 0 ? 0 : (100 * part) / total; }

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  // Linear interpolation between closest ranks (NIST/Excel "PERCENTILE.INC").
  const pos = (p / 100) * (sorted.length - 1);
  const lo = Math.max(0, Math.floor(pos));
  const hi = Math.min(sorted.length - 1, Math.ceil(pos));
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function aggregate(outcomes: Outcome[], finalTarget: number): Metrics {
  const n = outcomes.length;
  const peaks = outcomes.map(o => o.peakBalance).sort((a, b) => a - b);
  const avgPeak = n === 0 ? 0 : peaks.reduce((s, v) => s + v, 0) / n;
  const median = n === 0 ? 0
    : n % 2 ? peaks[(n - 1) / 2]
    : (peaks[n / 2 - 1] + peaks[n / 2]) / 2;
  const clearedSeasonPct = [1, 2, 3, 4].map(season =>
    pct(outcomes.filter(o => o.result === 'won' || o.seasonReached > season).length, n),
  );
  return {
    trials: n,
    winPct: pct(outcomes.filter(o => o.result === 'won').length, n),
    bankruptPct: pct(outcomes.filter(o => o.result === 'bankrupt').length, n),
    targetMissPct: pct(outcomes.filter(o => o.result === 'targetMissed').length, n),
    avgPeak: Math.round(avgPeak),
    medianPeak: median,
    p10Peak: percentile(peaks, 10),
    p90Peak: percentile(peaks, 90),
    overshoot: finalTarget === 0 ? 0 : avgPeak / finalTarget,
    clearedSeasonPct,
  };
}
