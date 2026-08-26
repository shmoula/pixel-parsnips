import type { Metrics } from './metrics';
import { DEATH_TITLES, type DeathCauseId } from '../../src/engine/runPostMortem';

export interface Row { config: string; strategy: string; metrics: Metrics; }

export function formatTable(rows: Row[]): string {
  const header = ['config', 'strategy', 'win%', 'bankrupt%', 'miss%', 'avgPeak', 'medPeak', 'overshoot', 'cleared%'];
  const lines = rows.map(r => [
    r.config, r.strategy,
    r.metrics.winPct.toFixed(1),
    r.metrics.bankruptPct.toFixed(1),
    r.metrics.targetMissPct.toFixed(1),
    String(r.metrics.avgPeak),
    String(r.metrics.medianPeak),
    r.metrics.overshoot.toFixed(2) + 'x',
    r.metrics.clearedSeasonPct.map(p => p.toFixed(0)).join('/'),
  ]);
  const widths = header.map((h, i) =>
    Math.max(h.length, ...lines.map(l => l[i].length)));
  const fmt = (cols: string[]) => cols.map((c, i) => c.padEnd(widths[i])).join('  ');
  return [fmt(header), widths.map(w => '-'.repeat(w)).join('  '), ...lines.map(fmt)].join('\n');
}

const CAUSE_ORDER = Object.keys(DEATH_TITLES) as DeathCauseId[];

/**
 * 025 — how bankrupt runs are distributed across the five death titles.
 * Percentages are of BANKRUPT runs, not of all trials.
 */
export function formatDeathCauses(rows: Row[]): string {
  const header = ['config', 'strategy', 'bankrupt', ...CAUSE_ORDER];
  const lines = rows.map(r => {
    const total = Object.values(r.metrics.deathCauses).reduce((a, b) => a + b, 0);
    return [
      r.config,
      r.strategy,
      String(total),
      ...CAUSE_ORDER.map(c => {
        const n = r.metrics.deathCauses[c];
        return total === 0 ? '—' : `${((100 * n) / total).toFixed(0)}%`;
      }),
    ];
  });
  const widths = header.map((h, i) => Math.max(h.length, ...lines.map(l => l[i].length)));
  const fmt = (cols: string[]) => cols.map((c, i) => c.padEnd(widths[i])).join('  ');
  return [fmt(header), widths.map(w => '-'.repeat(w)).join('  '), ...lines.map(fmt)].join('\n');
}
