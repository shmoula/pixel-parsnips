import { PRESETS } from './economyPresets';
import { STRATEGIES } from './strategies';
import { monteCarlo } from './runner';
import { aggregate } from './metrics';
import { formatTable, type Row } from './report';

function arg(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function csv(flag: string, fallback: string): string[] {
  return arg(flag, fallback).split(',').map(s => s.trim()).filter(Boolean);
}

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function posInt(flag: string, fallback: string, min: number): number {
  const raw = arg(flag, fallback);
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n < min) fail(`Invalid ${flag}: ${raw} (expected integer >= ${min})`);
  return n;
}

const configNames = csv('--configs', Object.keys(PRESETS).join(','));
const stratNames = csv('--strategies', Object.keys(STRATEGIES).join(','));
const trials = posInt('--trials', '2000', 1);
const seed = posInt('--seed', '42', 0);

if (configNames.length === 0) fail('No configs specified');
if (stratNames.length === 0) fail('No strategies specified');

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
