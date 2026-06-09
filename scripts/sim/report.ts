import type { Metrics } from './metrics';

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
