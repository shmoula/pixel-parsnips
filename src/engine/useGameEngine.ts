import { useState, useCallback } from 'react';
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
    if (parsed?.schemaVersion !== SCHEMA_VERSION) {
      console.info(
        `[PixelParsnips] Save data schema upgraded from v${parsed?.schemaVersion} to v${SCHEMA_VERSION} — starting a new game.`
      );
      return initialGameState();
    }
    return parsed.state as GameState;
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
  getSeedPrice: (cropId: CropId) => number;
  getNextUpgradeCost: () => number | null;
  getOccupiedPlotCount: () => number;
}

export function useGameEngine(): GameEngineHook {
  const [state, setState] = useState<GameState>(() => loadState());

  const nextDay = useCallback(() => {
    setState(prev => {
      const next = processTurn(prev).state;
      saveState(next);
      return next;
    });
  }, []);

  const plant = useCallback((plotId: number, cropId: CropId): boolean => {
    let success = false;
    setState(prev => {
      const result = plantSeed(prev, plotId, cropId);
      if (result.ok) { success = true; saveState(result.state); return result.state; }
      return prev;
    });
    return success;
  }, []);

  const buySeed = useCallback((cropId: CropId, quantity: number): boolean => {
    let success = false;
    setState(prev => {
      const result = engineBuySeed(prev, cropId, quantity);
      if (result.ok) { success = true; saveState(result.state); return result.state; }
      return prev;
    });
    return success;
  }, []);

  const buyUpgrade = useCallback((): boolean => {
    let success = false;
    setState(prev => {
      const result = engineBuyUpgrade(prev);
      if (result.ok) { success = true; saveState(result.state); return result.state; }
      return prev;
    });
    return success;
  }, []);

  const buyFertilizer = useCallback((quantity: number): boolean => {
    let success = false;
    setState(prev => {
      const result = engineBuyFertilizer(prev, quantity);
      if (result.ok) { success = true; saveState(result.state); return result.state; }
      return prev;
    });
    return success;
  }, []);

  const applyFertilizer = useCallback((plotId: number): boolean => {
    let success = false;
    setState(prev => {
      const result = engineApplyFertilizer(prev, plotId);
      if (result.ok) { success = true; saveState(result.state); return result.state; }
      return prev;
    });
    return success;
  }, []);

  const clearPestDamage = useCallback((plotId: number): boolean => {
    let success = false;
    setState(prev => {
      const result = engineClearPestDamage(prev, plotId);
      if (result.ok) { success = true; saveState(result.state); return result.state; }
      return prev;
    });
    return success;
  }, []);

  const restart = useCallback(() => {
    const fresh = initialGameState();
    saveState(fresh);
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
    nextDay,
    plantSeed: plant,
    buySeed,
    buyUpgrade,
    buyFertilizer,
    applyFertilizer,
    clearPestDamage,
    getFertilizerCount,
    restart,
    getSeedPrice,
    getNextUpgradeCost,
    getOccupiedPlotCount,
  };
}
