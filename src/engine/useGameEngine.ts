import { useState, useCallback } from 'react';
import { initialGameState, plantSeed, processTurn } from './gameEngine';
import { CROP_DEFINITIONS, UPGRADE_TIER_DEFINITIONS, coins } from './constants';
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
      if (result.ok) {
        success = true;
        return result.state;
      }
      return prev;
    });
    return success;
  }, []);

  // buySeed and buyUpgrade are stubs for Phase 3; implemented in T030 (Phase 5)
  const buySeed = useCallback(
    (_cropId: CropId, _quantity: number): boolean => false,
    []
  );

  const buyUpgrade = useCallback((): boolean => false, []);

  const restart = useCallback(() => {
    setState(initialGameState());
  }, []);

  const getSeedPrice = useCallback(
    (cropId: CropId): number => {
      const crop = CROP_DEFINITIONS[cropId];
      const tier = state.upgradeTier;
      if (tier === 0) return crop.baseSeedCost;
      const def = UPGRADE_TIER_DEFINITIONS[tier - 1];
      return coins(crop.baseSeedCost * (1 - def.cumulativeDiscount));
    },
    [state.upgradeTier]
  );

  const getNextUpgradeCost = useCallback((): number | null => {
    if (state.upgradeTier >= 3) return null;
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
