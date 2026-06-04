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
  computeSeedCost,
} from './gameEngine';
import { UPGRADE_TIER_DEFINITIONS, MAX_UPGRADE_TIER, SCHEMA_VERSION } from './constants';
import type { GameState, CropId, DailyLogEntry } from './types';
import { recordRunEnd, type PersonalBests } from './records';
import { deriveMedal, type Medal } from './medals';
import { getSeasonForDay } from './seasons';

const STORAGE_KEY = 'pixel-parsnips-state';

/** Migrates a parsed save envelope to the current schema, or returns null if unsupported. */
function migrateState(parsed: { schemaVersion: number; state: unknown }): GameState | null {
  // Schema 5 — current
  if (parsed.schemaVersion === SCHEMA_VERSION && parsed.state) {
    return parsed.state as GameState;
  }

  // Schema 4 → 5 — add disastersSurvived: 0
  if (parsed.schemaVersion === 4 && parsed.state) {
    console.info('[PixelParsnips] Migrating save from v4 to v5 (Enriched Run Summary).');
    return {
      ...(parsed.state as Omit<GameState, 'disastersSurvived'>),
      schemaVersion: SCHEMA_VERSION,
      disastersSurvived: 0,
    };
  }

  // Schema 3 → 5 — chained migration (add endlessMode and disastersSurvived)
  if (parsed.schemaVersion === 3 && parsed.state) {
    console.info('[PixelParsnips] Migrating save from v3 to v5 (Season System + Enriched Run Summary).');
    return {
      ...(parsed.state as Omit<GameState, 'endlessMode' | 'disastersSurvived'>),
      schemaVersion: SCHEMA_VERSION,
      endlessMode: false,
      disastersSurvived: 0,
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
  getFertilizerCount: () => number;
  restart: () => void;
  continueSeason: () => void;
  endRunVictory: () => void;
  getSeedPrice: (cropId: CropId) => number;
  getNextUpgradeCost: () => number | null;
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
    getFertilizerCount,
    restart,
    continueSeason,
    endRunVictory,
    getSeedPrice,
    getNextUpgradeCost,
    getOccupiedPlotCount,
  };
}
