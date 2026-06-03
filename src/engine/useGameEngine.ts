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

const STORAGE_KEY = 'pixel-parsnips-state';

function loadState(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialGameState();
    const parsed = JSON.parse(raw);

    // Schema 4 — current
    if (parsed?.schemaVersion === SCHEMA_VERSION) {
      return parsed.state as GameState;
    }

    // Schema 3 → 4 — add endlessMode: false
    if (parsed?.schemaVersion === 3 && parsed?.state) {
      console.info('[PixelParsnips] Migrating save from v3 to v4 (Season System).');
      return {
        ...(parsed.state as Omit<GameState, 'endlessMode'>),
        schemaVersion: SCHEMA_VERSION,
        endlessMode: false,
      };
    }

    // Schemas < 3 — discard (preserves existing policy)
    console.info(
      `[PixelParsnips] Save data schema upgraded from v${parsed?.schemaVersion} to v${SCHEMA_VERSION} — starting a new game.`
    );
    return initialGameState();
  } catch {
    return initialGameState();
  }
}

function saveState(state: GameState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, state }));
}

export interface GameEngineHook {
  state: GameState;
  lastDailyLog: DailyLogEntry | null;
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

  useEffect(() => {
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      return;
    }
    saveState(state);
  }, [state]);

  const nextDay = useCallback(() => {
    setState(prev => {
      return processTurn(prev).state;
    });
  }, []);

  const plant = useCallback((plotId: number, cropId: CropId): boolean => {
    let success = false;
    setState(prev => {
      const result = plantSeed(prev, plotId, cropId);
      if (result.ok) { success = true; return result.state; }
      return prev;
    });
    return success;
  }, []);

  const buySeed = useCallback((cropId: CropId, quantity: number): boolean => {
    let success = false;
    setState(prev => {
      const result = engineBuySeed(prev, cropId, quantity);
      if (result.ok) { success = true; return result.state; }
      return prev;
    });
    return success;
  }, []);

  const buyUpgrade = useCallback((): boolean => {
    let success = false;
    setState(prev => {
      const result = engineBuyUpgrade(prev);
      if (result.ok) { success = true; return result.state; }
      return prev;
    });
    return success;
  }, []);

  const buyFertilizer = useCallback((quantity: number): boolean => {
    let success = false;
    setState(prev => {
      const result = engineBuyFertilizer(prev, quantity);
      if (result.ok) { success = true; return result.state; }
      return prev;
    });
    return success;
  }, []);

  const applyFertilizer = useCallback((plotId: number): boolean => {
    let success = false;
    setState(prev => {
      const result = engineApplyFertilizer(prev, plotId);
      if (result.ok) { success = true; return result.state; }
      return prev;
    });
    return success;
  }, []);

  const clearPestDamage = useCallback((plotId: number): boolean => {
    let success = false;
    setState(prev => {
      const result = engineClearPestDamage(prev, plotId);
      if (result.ok) { success = true; return result.state; }
      return prev;
    });
    return success;
  }, []);

  const restart = useCallback(() => {
    const fresh = initialGameState();
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
    setState(initialGameState());
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
