import { initialGameState, processTurn, clearPestDamage } from '../../src/engine/gameEngine';
import { getSeasonForDay } from '../../src/engine/seasons';
import { makeRng } from './rng';
import type { Strategy } from './strategies';
import type { EconomyConfig } from '../../src/engine/economy';

export type RunResult = 'won' | 'bankrupt' | 'targetMissed';

export interface Outcome {
  result: RunResult;
  endedDay: number;
  peakBalance: number;
  finalBalance: number;
  seasonReached: number;
}

const MAX_DAYS = 80; // finite arc; endless not simulated for difficulty measurement

type Rng = ReturnType<typeof makeRng>;

const TERMINAL_PHASES = new Set(['bankrupt', 'season_failed', 'season_4_won']);

function isTerminal(phase: string, day: number): boolean {
  return TERMINAL_PHASES.has(phase) || day > MAX_DAYS;
}

function clearPests(state: ReturnType<typeof initialGameState>): ReturnType<typeof initialGameState> {
  let s = state;
  for (const p of s.plots) {
    if (p.pestDamaged) {
      const r = clearPestDamage(s, p.id);
      if (r.ok) s = r.state;
    }
  }
  return s;
}

function tickDay(
  state: ReturnType<typeof initialGameState>,
  strategy: Strategy,
  config: EconomyConfig,
  rng: Rng,
): ReturnType<typeof initialGameState> {
  const cleared = clearPests(state);
  const decided = strategy(cleared, config);
  return processTurn(decided, undefined, undefined, undefined, config, rng).state;
}

export function playRun(config: EconomyConfig, strategy: Strategy, seed: number): Outcome {
  const rng = makeRng(seed);
  let state = initialGameState(config);

  for (let guard = 0; guard < 1000; guard++) {
    if (isTerminal(state.phase, state.currentDay)) break;
    if (state.phase === 'season_passed') { state = { ...state, phase: 'playing' }; continue; }
    state = tickDay(state, strategy, config, rng);
  }

  const result: RunResult =
    state.phase === 'season_4_won' ? 'won'
    : state.phase === 'bankrupt' ? 'bankrupt'
    : 'targetMissed';

  return {
    result,
    endedDay: state.currentDay,
    peakBalance: state.peakBalance,
    finalBalance: state.coinBalance,
    seasonReached: getSeasonForDay(state.currentDay, config).number,
  };
}

export function monteCarlo(
  config: EconomyConfig, strategy: Strategy, trials: number, masterSeed: number,
): Outcome[] {
  const out: Outcome[] = [];
  for (let i = 0; i < trials; i++) out.push(playRun(config, strategy, masterSeed + i));
  return out;
}
