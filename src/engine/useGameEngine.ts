import { useState, useCallback } from 'react';
import {
  initialGameState,
  plantSeed,
  processTurn,
  buySeed as engineBuySeed,
  buyUpgrade as engineBuyUpgrade,
  computeSeedCost,
} from './gameEngine';
import { UPGRADE_TIER_DEFINITIONS, MAX_UPGRADE_TIER } from './constants';
import type { GameState, CropId } from './types';

export interface GameEngineHook {
  state: GameState;
  nextDay: () => void;
  plantSeed: (plotId: number, cropId: CropId) => boolean;
  buySeed: (cropId: CropId, quantity: number) => boolean;
  buyUpgrade: () => boolean;
  restart: () => void;
  getSeedPrice: (cropId: CropId) => number;
  getNextUpgradeCost: () => number | null;
  getOccupiedPlotCount: () => number;
}

export function useGameEngine(): GameEngineHook {
  const [state, setState] = useState<GameState>(() => initialGameState());

  const nextDay = useCallback(() => {
    setState(prev => processTurn(prev).state);
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

  const restart = useCallback(() => {
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

  return {
    state,
    nextDay,
    plantSeed: plant,
    buySeed,
    buyUpgrade,
    restart,
    getSeedPrice,
    getNextUpgradeCost,
    getOccupiedPlotCount,
  };
}
