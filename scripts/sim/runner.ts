import { initialGameState, processTurn, clearPestDamage, resolveFarmEventChoice } from '../../src/engine/gameEngine';
import { getSeasonForDay } from '../../src/engine/seasons';
import { makeRng } from './rng';
import { EVENT_POLICIES, type Strategy, type EventPolicy } from './strategies';
import type { EconomyConfig } from '../../src/engine/economy';
import { deathCauseForState, type DeathCauseId } from '../../src/engine/runPostMortem';

export type RunResult = 'won' | 'bankrupt' | 'targetMissed';

export interface Outcome {
  result: RunResult;
  endedDay: number;
  peakBalance: number;
  finalBalance: number;
  seasonReached: number;
  /** 025 — which death title this run would show; null when the run did not go broke. */
  deathCause: DeathCauseId | null;
}

const MAX_DAYS = 80; // finite arc; endless not simulated for difficulty measurement

type Rng = ReturnType<typeof makeRng>;

const TERMINAL_PHASES = new Set(['bankrupt', 'season_failed', 'season_4_won']);

function isTerminal(phase: string, day: number): boolean {
  return TERMINAL_PHASES.has(phase) || day > MAX_DAYS;
}

function clearPests(
  state: ReturnType<typeof initialGameState>,
  config: EconomyConfig,
): ReturnType<typeof initialGameState> {
  let s = state;
  for (const p of s.plots) {
    if (p.pestDamaged) {
      const r = clearPestDamage(s, p.id, config);
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
  eventPolicy: EventPolicy,
): ReturnType<typeof initialGameState> {
  const cleared = clearPests(state, config);
  // 022: answer a pending farm event via the run's policy before the bot acts.
  const answered = cleared.farmEvents.pending !== null
    ? resolveFarmEventChoice(cleared, eventPolicy(cleared, config), config)
    : cleared;
  const decided = strategy(answered, config);
  return processTurn(decided, undefined, undefined, undefined, config, rng).state;
}

export function playRun(
  config: EconomyConfig,
  strategy: Strategy,
  seed: number,
  eventPolicy: EventPolicy = EVENT_POLICIES.heuristic,
): Outcome {
  const rng = makeRng(seed);
  let state = initialGameState(config);

  for (let guard = 0; guard < 1000; guard++) {
    if (isTerminal(state.phase, state.currentDay)) break;
    if (state.phase === 'season_passed') { state = { ...state, phase: 'playing' }; continue; }
    state = tickDay(state, strategy, config, rng, eventPolicy);
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
    deathCause: result === 'bankrupt' ? deathCauseForState(state) : null,
  };
}

export function monteCarlo(
  config: EconomyConfig,
  strategy: Strategy,
  trials: number,
  masterSeed: number,
  eventPolicy: EventPolicy = EVENT_POLICIES.heuristic,
): Outcome[] {
  const out: Outcome[] = [];
  for (let i = 0; i < trials; i++) out.push(playRun(config, strategy, masterSeed + i, eventPolicy));
  return out;
}
