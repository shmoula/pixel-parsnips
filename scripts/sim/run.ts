import { PRESETS } from './economyPresets';
import { STRATEGIES } from './strategies';
import { monteCarlo } from './runner';
import { aggregate } from './metrics';
import { formatTable, type Row } from './report';

function arg(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const configNames = arg('--configs', Object.keys(PRESETS).join(',')).split(',');
const stratNames = arg('--strategies', Object.keys(STRATEGIES).join(',')).split(',');
const trials = parseInt(arg('--trials', '2000'), 10);
const seed = parseInt(arg('--seed', '42'), 10);

const rows: Row[] = [];
for (const c of configNames) {
  const config = PRESETS[c];
  if (!config) { console.error(`Unknown config: ${c}`); process.exit(1); }
  const finalTarget = config.seasons[config.seasons.length - 1].target;
  for (const sName of stratNames) {
    const strat = STRATEGIES[sName];
    if (!strat) { console.error(`Unknown strategy: ${sName}`); process.exit(1); }
    const outcomes = monteCarlo(config, strat, trials, seed);
    rows.push({ config: c, strategy: sName, metrics: aggregate(outcomes, finalTarget) });
  }
}

console.log(`\nMonte Carlo — ${trials} trials/seed=${seed}\n`);
console.log(formatTable(rows));
console.log('');
