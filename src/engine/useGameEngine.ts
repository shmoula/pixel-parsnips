import { useState, useCallback, useEffect, useRef } from 'react';
import {
  initialGameState,
  plantSeed,
  processTurn,
  buySeed as engineBuySeed,
  buyUpgrade as engineBuyUpgrade,
  buyFertilizer as engineBuyFertilizer,
  applyFertilizer as engineApplyFertilizer,
  clearPestDamage as engineClearPestDamage,
  buyPlot as engineBuyPlot,
  getNextPlotPrice as engineGetNextPlotPrice,
  computeSeedCost,
} from './gameEngine';
import { UPGRADE_TIER_DEFINITIONS, MAX_UPGRADE_TIER, SCHEMA_VERSION } from './constants';
import { DEFAULT_ECONOMY } from './economy';
import type { GameState, CropId, DailyLogEntry } from './types';
import { recordRunEnd, type PersonalBests } from './records';
import { deriveMedal, type Medal } from './medals';
import { getSeasonForDay } from './seasons';

const STORAGE_KEY = 'pixel-parsnips-state';

/** Minimal structural check that `state` looks like a GameState payload. */
function isGameStateShape(state: unknown): state is Record<string, unknown> {
  return typeof state === 'object' && state !== null && 'phase' in state && 'plots' in state;
}

/**
 * Hardens a current-schema save against tampering/corruption before use.
 * Downstream code (state.plots.every, plots.map, getNextPlotPrice, market
 * helpers) assumes plots is an array, unlockedPlots is a number in
 * [0, plots.length], and market is an object with active/pending.
 */
function hardenCurrentSchema(st: Record<string, unknown>): GameState {
  const plots = Array.isArray(st.plots) ? st.plots : [];
  const rawUnlocked = Number(st.unlockedPlots);
  // A missing/non-numeric unlockedPlots defaults to "all visible plots
  // unlocked" so the run stays playable; any value is then clamped in range.
  const unlockedPlots = Math.max(
    0,
    Math.min(Number.isNaN(rawUnlocked) ? plots.length : rawUnlocked, plots.length),
  );
  const market =
    st.market && typeof st.market === 'object'
      ? (st.market as GameState['market'])
      : { active: null, pending: null };
  return {
    ...(st as unknown as GameState),
    plots,
    unlockedPlots,
    market,
    schemaVersion: SCHEMA_VERSION,
  } as GameState;
}

/** Migrates a parsed save envelope to the current schema, or returns null if unsupported. */
function migrateState(parsed: { schemaVersion: number; state: unknown }): GameState | null {
  // A non-shape state is unmigratable and falls through to "discard" (null) in
  // every branch anyway, so reject it up front. This removes one condition from
  // each version branch below without changing behavior.
  if (!isGameStateShape(parsed.state)) {
    console.info(
      `[PixelParsnips] Discarding malformed or unsupported save (v${parsed.schemaVersion}) — starting a new game.`
    );
    return null;
  }

  // Schema 8 — current. Harden tampered/corrupt fields in place.
  if (parsed.schemaVersion === SCHEMA_VERSION) {
    return hardenCurrentSchema(parsed.state as Record<string, unknown>);
  }

  // Schema 7 → 8 — add market (existing runs continue with no event)
  if (parsed.schemaVersion === 7) {
    console.info('[PixelParsnips] Migrating save from v7 to v8 (Market Events).');
    const st = parsed.state as Record<string, unknown>;
    return {
      ...(st as unknown as Omit<GameState, 'market'>),
      schemaVersion: SCHEMA_VERSION,
      market: { active: null, pending: null },
    };
  }

  // Schema 6 → 8 — add unlockedPlots (existing runs keep all plots unlocked) + market
  if (parsed.schemaVersion === 6) {
    console.info('[PixelParsnips] Migrating save from v6 to v8 (Plot Progression + Market Events).');
    const st = parsed.state as Record<string, unknown>;
    return {
      ...(st as unknown as Omit<GameState, 'unlockedPlots' | 'market'>),
      schemaVersion: SCHEMA_VERSION,
      unlockedPlots: Array.isArray(st.plots) ? st.plots.length : DEFAULT_ECONOMY.maxPlots,
      market: { active: null, pending: null },
    };
  }

  // Schema 5 → 8 — add harvestStreak, peakHarvestStreak, unlockedPlots, and market
  if (parsed.schemaVersion === 5) {
    console.info('[PixelParsnips] Migrating save from v5 to v8 (Harvest Streak + Plot Progression + Market Events).');
    return {
      ...(parsed.state as unknown as Omit<GameState, 'harvestStreak' | 'peakHarvestStreak' | 'unlockedPlots' | 'market'>),
      schemaVersion: SCHEMA_VERSION,
      harvestStreak: 0,
      peakHarvestStreak: 0,
      unlockedPlots: DEFAULT_ECONOMY.maxPlots,
      market: { active: null, pending: null },
    };
  }

  // Schema 4 → 8 — chained: add disastersSurvived + streak fields + unlockedPlots + market
  if (parsed.schemaVersion === 4) {
    console.info('[PixelParsnips] Migrating save from v4 to v8.');
    return {
      ...(parsed.state as unknown as Omit<GameState, 'disastersSurvived' | 'harvestStreak' | 'peakHarvestStreak' | 'unlockedPlots' | 'market'>),
      schemaVersion: SCHEMA_VERSION,
      disastersSurvived: 0,
      harvestStreak: 0,
      peakHarvestStreak: 0,
      unlockedPlots: DEFAULT_ECONOMY.maxPlots,
      market: { active: null, pending: null },
    };
  }

  // Schema 3 → 8 — chained: add endlessMode + disastersSurvived + streak fields + unlockedPlots + market
  if (parsed.schemaVersion === 3) {
    console.info('[PixelParsnips] Migrating save from v3 to v8 (Season System + Enriched Run Summary + Harvest Streak + Plot Progression + Market Events).');
    return {
      ...(parsed.state as unknown as Omit<GameState, 'endlessMode' | 'disastersSurvived' | 'harvestStreak' | 'peakHarvestStreak' | 'unlockedPlots' | 'market'>),
      schemaVersion: SCHEMA_VERSION,
      endlessMode: false,
      disastersSurvived: 0,
      harvestStreak: 0,
      peakHarvestStreak: 0,
      unlockedPlots: DEFAULT_ECONOMY.maxPlots,
      market: { active: null, pending: null },
    };
  }

  // Unrecognised / malformed save — discard
  console.info(
    `[PixelParsnips] Discarding malformed or unsupported save (v${parsed.schemaVersion}) — starting a new game.`
  );
  return null;
}

function loadState(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialGameState();
    const parsed = JSON.parse(raw);
    return migrateState(parsed) ?? initialGameState();
  } catch {
    return initialGameState();
  }
}

function saveState(state: GameState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, state }));
}

export interface EndOfRunRecap {
  records: PersonalBests;
  newBests: Set<keyof PersonalBests>;
  medal: Medal;
  seasonReached: number;
}

export interface GameEngineHook {
  state: GameState;
  lastDailyLog: DailyLogEntry | null;
  endOfRunRecap: EndOfRunRecap | null;
  nextDay: () => void;
  plantSeed: (plotId: number, cropId: CropId) => boolean;
  buySeed: (cropId: CropId, quantity: number) => boolean;
  buyUpgrade: () => boolean;
  buyFertilizer: (quantity: number) => boolean;
  applyFertilizer: (plotId: number) => boolean;
  clearPestDamage: (plotId: number) => boolean;
  buyPlot: () => boolean;
  getFertilizerCount: () => number;
  restart: () => void;
  continueSeason: () => void;
  endRunVictory: () => void;
  getSeedPrice: (cropId: CropId) => number;
  getNextUpgradeCost: () => number | null;
  getNextPlotPrice: () => number | null;
  getOccupiedPlotCount: () => number;
}

export function useGameEngine(): GameEngineHook {
  const [state, setState] = useState<GameState>(() => loadState());
  const hasHydratedRef = useRef(false);
  const [endOfRunRecap, setEndOfRunRecap] = useState<EndOfRunRecap | null>(null);
  const prevPhaseRef = useRef<GameState['phase']>(state.phase);

  // Mirror state in a ref so action callbacks can read the latest value synchronously.
  // setState's function updater runs lazily, so reading inside it can't drive a synchronous return.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => {
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      return;
    }
    saveState(state);
  }, [state]);

  // Fire recordRunEnd on the first terminal-phase transition per run.
  useEffect(() => {
    const prev = prevPhaseRef.current;
    const curr = state.phase;
    prevPhaseRef.current = curr;

    if (prev === curr) return;

    const isTerminalTransition =
      (curr === 'bankrupt' && prev !== 'bankrupt') ||
      (curr === 'season_4_won' && prev !== 'season_4_won' && !state.endlessMode);

    if (!isTerminalTransition) return;

    const { records, newBests } = recordRunEnd(state);
    const won = state.endlessMode || curr === 'season_4_won';
    const seasonReached = getSeasonForDay(state.currentDay).number;
    setEndOfRunRecap({
      records,
      newBests,
      medal: deriveMedal(seasonReached, won),
      seasonReached,
    });
  // Intentionally listing individual state fields rather than the whole `state` object to avoid
  // re-firing on every state change. The prevPhaseRef guard prevents double-firing on re-renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.endlessMode, state.currentDay, state.peakBalance, state.disastersSurvived]);

  const nextDay = useCallback(() => {
    setState(prev => {
      return processTurn(prev).state;
    });
  }, []);

  const plant = useCallback((plotId: number, cropId: CropId): boolean => {
    const result = plantSeed(stateRef.current, plotId, cropId);
    if (!result.ok) return false;
    setState(result.state);
    return true;
  }, []);

  const buySeed = useCallback((cropId: CropId, quantity: number): boolean => {
    const result = engineBuySeed(stateRef.current, cropId, quantity);
    if (!result.ok) return false;
    setState(result.state);
    return true;
  }, []);

  const buyUpgrade = useCallback((): boolean => {
    const result = engineBuyUpgrade(stateRef.current);
    if (!result.ok) return false;
    setState(result.state);
    return true;
  }, []);

  const buyFertilizer = useCallback((quantity: number): boolean => {
    const result = engineBuyFertilizer(stateRef.current, quantity);
    if (!result.ok) return false;
    setState(result.state);
    return true;
  }, []);

  const applyFertilizer = useCallback((plotId: number): boolean => {
    const result = engineApplyFertilizer(stateRef.current, plotId);
    if (!result.ok) return false;
    setState(result.state);
    return true;
  }, []);

  const clearPestDamage = useCallback((plotId: number): boolean => {
    const result = engineClearPestDamage(stateRef.current, plotId);
    if (!result.ok) return false;
    setState(result.state);
    return true;
  }, []);

  const buyPlot = useCallback((): boolean => {
    const result = engineBuyPlot(stateRef.current);
    if (!result.ok) return false;
    setState(result.state);
    return true;
  }, []);

  const getNextPlotPrice = useCallback((): number | null => {
    return engineGetNextPlotPrice(state);
  }, [state]);

  const restart = useCallback(() => {
    const fresh = initialGameState();
    setEndOfRunRecap(null);
    prevPhaseRef.current = fresh.phase;
    setState(fresh);
  }, []);

  const continueSeason = useCallback(() => {
    setState(prev => {
      if (prev.phase === 'season_passed') {
        return { ...prev, phase: 'playing' };
      }
      if (prev.phase === 'season_4_won') {
        return { ...prev, phase: 'playing', endlessMode: true, currentDay: prev.currentDay + 1 };
      }
      return prev;
    });
  }, []);

  const endRunVictory = useCallback(() => {
    const fresh = initialGameState();
    setEndOfRunRecap(null);
    prevPhaseRef.current = fresh.phase;
    setState(fresh);
  }, []);

  const getSeedPrice = useCallback(
    (cropId: CropId): number => computeSeedCost(cropId, state.upgradeTier),
    [state.upgradeTier]
  );

  const getNextUpgradeCost = useCallback((): number | null => {
    if (state.upgradeTier >= MAX_UPGRADE_TIER) return null;
    return UPGRADE_TIER_DEFINITIONS[state.upgradeTier].cost;
  }, [state.upgradeTier]);

  const getOccupiedPlotCount = useCallback(
    () => state.plots.filter(p => p.cropId !== null).length,
    [state.plots]
  );

  const getFertilizerCount = useCallback(
    () => state.fertilizerInventory,
    [state.fertilizerInventory]
  );

  return {
    state,
    lastDailyLog: state.lastDailyLog,
    endOfRunRecap,
    nextDay,
    plantSeed: plant,
    buySeed,
    buyUpgrade,
    buyFertilizer,
    applyFertilizer,
    clearPestDamage,
    buyPlot,
    getFertilizerCount,
    restart,
    continueSeason,
    endRunVictory,
    getSeedPrice,
    getNextUpgradeCost,
    getNextPlotPrice,
    getOccupiedPlotCount,
  };
}
