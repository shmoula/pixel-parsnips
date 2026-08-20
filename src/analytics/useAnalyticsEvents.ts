import { useEffect, useRef } from 'react';
import type { CropId, GameState } from '../engine/types';
import { getSeasonForDay } from '../engine/seasons';
import { DEFAULT_ECONOMY } from '../engine/economy';
import { computeSeedCost, getNextPlotPrice } from '../engine/gameEngine';
import { deriveMedal } from '../engine/medals';
import { track } from './track';
import { buildDayCompletedProps, buildRunEndedProps, runOutcomeForPhase } from './events';
import type { SeasonOutcome } from './events';

/** Mutable holder for the once-per-run run_ended guard. */
interface RunEndedGuard {
  current: boolean;
}

/** Once-per-run guards for the activation "firsts". Reset by detectRunLifecycle. */
interface RunFirsts {
  plant: boolean;
  harvest: boolean;
}

/** day_completed — fire when a new daily log is produced. */
function detectDayCompleted(prev: GameState, state: GameState): void {
  if (state.lastDailyLog && state.lastDailyLog !== prev.lastDailyLog) {
    const log = state.lastDailyLog;
    const seasonNumber = getSeasonForDay(log.day).number;
    track('day_completed', buildDayCompletedProps(log, seasonNumber, state.phase));
  }
}

/**
 * plot_unlocked + first_plot_unlocked milestone — on an unlockedPlots increment.
 * Runs start at startingPlots (never 0), so the milestone's "first purchased
 * plot" is the startingPlots -> startingPlots + 1 transition.
 */
function detectPlotUnlocked(prev: GameState, state: GameState, firedMilestones: Set<string>): void {
  if (state.unlockedPlots <= prev.unlockedPlots) return;
  const price = getNextPlotPrice(prev) ?? 0;
  track('plot_unlocked', {
    unlocked_plots_after: state.unlockedPlots,
    price,
    coin_balance_after: state.coinBalance,
    day: state.currentDay,
    season_number: getSeasonForDay(state.currentDay).number,
  });
  if (prev.unlockedPlots === DEFAULT_ECONOMY.startingPlots && !firedMilestones.has('first_plot_unlocked')) {
    firedMilestones.add('first_plot_unlocked');
    track('milestone_reached', {
      milestone: 'first_plot_unlocked',
      day: state.currentDay,
      season_number: getSeasonForDay(state.currentDay).number,
    });
  }
}

/** season_2_reached milestone — first time the derived season number reaches 2. */
function detectSeason2(prev: GameState, state: GameState, firedMilestones: Set<string>): void {
  const prevSeason = getSeasonForDay(prev.currentDay).number;
  const currSeason = getSeasonForDay(state.currentDay).number;
  if (prevSeason < 2 && currSeason >= 2 && !firedMilestones.has('season_2_reached')) {
    firedMilestones.add('season_2_reached');
    track('milestone_reached', {
      milestone: 'season_2_reached',
      day: state.currentDay,
      season_number: currSeason,
    });
  }
}

/** season_completed — on entering any season-resolution phase. */
function detectSeasonCompleted(prev: GameState, state: GameState): void {
  const seasonPhases: SeasonOutcome[] = ['season_passed', 'season_failed', 'season_4_won'];
  if (state.phase !== prev.phase && seasonPhases.includes(state.phase as SeasonOutcome)) {
    track('season_completed', {
      season_number: getSeasonForDay(state.currentDay).number,
      outcome: state.phase as SeasonOutcome,
      coin_balance: state.coinBalance,
      days_played: state.currentDay,
    });
  }
}

/**
 * New-run reset followed by run_ended. A fresh initialGameState (day 1, playing,
 * from a non-day-1 prev) resets the per-run guards; then run_ended fires once on
 * the first transition into a terminal phase. The reset MUST run before the
 * run_ended check within the same pass.
 */
function detectRunLifecycle(
  prev: GameState,
  state: GameState,
  firedMilestones: Set<string>,
  runEndedFired: RunEndedGuard,
  firsts: RunFirsts,
): void {
  // New-run reset — a fresh initialGameState (day 1, playing) starts a new run.
  if (state.phase === 'playing' && state.currentDay === 1 && prev.currentDay !== 1) {
    // A still-playable outgoing run means the player quit rather than finished;
    // a terminal prev.phase is the ordinary restart after run_ended. Read prev:
    // `state` is already the fresh day-1 run.
    if (prev.phase === 'playing') {
      track('run_abandoned', {
        days_played: prev.currentDay,
        season_number: getSeasonForDay(prev.currentDay).number,
        coin_balance: prev.coinBalance,
      });
    }
    firedMilestones.clear();
    runEndedFired.current = false;
    firsts.plant = false;
    firsts.harvest = false;
  }

  // run_ended — first transition into a terminal phase this run.
  const outcome = runOutcomeForPhase(state.phase);
  const isEndlessWin = state.phase === 'season_4_won' && state.endlessMode;
  if (outcome !== null && !isEndlessWin && state.phase !== prev.phase && !runEndedFired.current) {
    runEndedFired.current = true;
    const seasonReached = getSeasonForDay(state.currentDay).number;
    const won = outcome === 'won';
    track('run_ended', buildRunEndedProps(state, outcome, seasonReached, deriveMedal(seasonReached, won)));
  }
}

/** endless_mode_entered — the one-way flip set by endRunVictory's "Continue".
 *  Self-resetting: a new run returns endlessMode to false, so no guard is needed. */
function detectEndlessMode(prev: GameState, state: GameState): void {
  if (prev.endlessMode || !state.endlessMode) return;
  track('endless_mode_entered', {
    day: state.currentDay,
    season_number: getSeasonForDay(state.currentDay).number,
    coin_balance: state.coinBalance,
  });
}

const CROP_IDS: CropId[] = ['radish', 'parsnip', 'pumpkin'];

/** shop_purchased — any per-commit increase in a shop-panel inventory is a purchase.
 *  Costs reconstruct from prev-state prices (each action commits separately, so the
 *  prev state is exactly the state the purchase was priced against). Decreases
 *  (planting, applying fertilizer) and run resets stay silent. */
function detectShopPurchased(prev: GameState, state: GameState): void {
  const common = {
    day: state.currentDay,
    season_number: getSeasonForDay(state.currentDay).number,
    coin_balance_after: state.coinBalance,
  };
  for (const cropId of CROP_IDS) {
    const delta = state.seedInventory[cropId] - prev.seedInventory[cropId];
    if (delta > 0) {
      track('shop_purchased', {
        item_type: 'seed',
        item_id: cropId,
        quantity: delta,
        cost: computeSeedCost(cropId, prev.buildings, DEFAULT_ECONOMY, prev.farmEvents.activeEffects) * delta,
        ...common,
      });
    }
  }
  const fertDelta = state.fertilizerInventory - prev.fertilizerInventory;
  if (fertDelta > 0) {
    track('shop_purchased', {
      item_type: 'fertilizer',
      item_id: 'fertilizer',
      quantity: fertDelta,
      cost: DEFAULT_ECONOMY.fertilizerCost * fertDelta,
      ...common,
    });
  }
  for (const def of DEFAULT_ECONOMY.buildings.definitions) {
    if (state.buildings[def.id] && !prev.buildings[def.id]) {
      track('shop_purchased', {
        item_type: 'building',
        item_id: def.id,
        quantity: 1,
        cost: def.cost,
        ...common,
      });
    }
  }
}

/** 022 — farm-event lifecycle, all derived from state diffs (engine stays pure). */
function detectFarmEvents(prev: GameState, state: GameState): void {
  const curr = state.farmEvents;
  const before = prev.farmEvents;

  if (curr.pending !== null && curr.pending !== before.pending) {
    track('farm_event_fired', {
      event_id: curr.pending.eventId,
      season: getSeasonForDay(curr.pending.firedDay).number,
      day: curr.pending.firedDay,
    });
  }
  if (curr.lastResolved !== null && curr.lastResolved !== before.lastResolved) {
    track('farm_event_choice', {
      event_id: curr.lastResolved.eventId,
      choice: curr.lastResolved.choice,
      auto: curr.lastResolved.auto,
      day: curr.lastResolved.day,
    });
  }
  const log = state.lastDailyLog;
  if (log && log !== prev.lastDailyLog) {
    if (log.contractCompleted) {
      track('contract_completed', { event_id: log.contractCompleted.eventId, reward: log.contractCompleted.reward });
    }
    if (log.contractExpired) {
      track('contract_expired', { event_id: log.contractExpired });
    }
  }
}

/** first_plant_placed — the first plot to go from empty to planted this run. */
function detectFirstPlant(prev: GameState, state: GameState, firsts: RunFirsts): void {
  if (firsts.plant) return;
  for (let i = 0; i < state.plots.length; i += 1) {
    const after = state.plots[i];
    const before = prev.plots[i];
    if (after.cropId !== null && (before === undefined || before.cropId === null)) {
      firsts.plant = true;
      track('first_plant_placed', { day: state.currentDay, crop_id: after.cropId });
      return;
    }
  }
}

/** first_harvest_collected — the first new daily log this run that contains a harvest. */
function detectFirstHarvest(prev: GameState, state: GameState, firsts: RunFirsts): void {
  if (firsts.harvest) return;
  const log = state.lastDailyLog;
  if (log === null || log === prev.lastDailyLog || log.harvests.length === 0) return;
  firsts.harvest = true;
  track('first_harvest_collected', {
    day: log.day,
    coin_balance_after: state.coinBalance,
    harvest_count: log.harvests.length,
  });
}

/** Fires all state-derived analytics events by diffing engine state across renders. */
export function useAnalyticsEvents(state: GameState): void {
  const prevRef = useRef<GameState | null>(null);
  const firedMilestonesRef = useRef<Set<string>>(new Set());
  const runEndedFiredRef = useRef<RunEndedGuard>({ current: false });
  const runFirstsRef = useRef<RunFirsts>({ plant: false, harvest: false });

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = state;
    if (prev === null) return;

    detectDayCompleted(prev, state);
    detectPlotUnlocked(prev, state, firedMilestonesRef.current);
    detectSeason2(prev, state, firedMilestonesRef.current);
    detectSeasonCompleted(prev, state);
    detectEndlessMode(prev, state);
    detectRunLifecycle(prev, state, firedMilestonesRef.current, runEndedFiredRef.current, runFirstsRef.current);
    detectShopPurchased(prev, state);
    detectFarmEvents(prev, state);
    detectFirstPlant(prev, state, runFirstsRef.current);
    detectFirstHarvest(prev, state, runFirstsRef.current);
  }, [state]);
}
