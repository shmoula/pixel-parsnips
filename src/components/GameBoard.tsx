import { useState } from 'react';
import type { GameState, CropId, DailyLogEntry } from '../engine/types';
import { HUD } from './HUD';
import { FarmGrid } from './FarmGrid';
import { Shop } from './Shop';
import { DailyLog } from './DailyLog';

interface GameBoardProps {
  state: GameState;
  lastDailyLog: DailyLogEntry | null;
  onNextDay: () => void;
  onPlantSeed: (plotId: number, cropId: CropId) => boolean;
  onBuySeed: (cropId: CropId) => void;
  onBuyUpgrade: () => void;
  onBuyFertilizer: () => void;
  onApplyFertilizer: (plotId: number) => void;
  getFertilizerCount: () => number;
  getSeedPrice: (cropId: CropId) => number;
  getNextUpgradeCost: () => number | null;
}

export function GameBoard({
  state,
  lastDailyLog,
  onNextDay,
  onPlantSeed,
  onBuySeed,
  onBuyUpgrade,
  onBuyFertilizer,
  onApplyFertilizer,
  getFertilizerCount,
  getSeedPrice,
  getNextUpgradeCost,
}: GameBoardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState<CropId | null>(null);

  function handleNextDay() {
    if (isProcessing) return;
    setIsProcessing(true);
    setTimeout(() => {
      onNextDay();
      setIsProcessing(false);
    }, 0);
  }

  function handlePlot(plotId: number) {
    if (!selectedCrop) return;
    const planted = onPlantSeed(plotId, selectedCrop);
    if (planted) setSelectedCrop(null); // deselect after successful plant
  }

  function handleBuySeed(cropId: CropId) {
    onBuySeed(cropId);
    setSelectedCrop(cropId); // auto-select the just-bought crop
  }

  return (
    <div className="flex flex-col min-h-screen bg-farm-parchment">
      <HUD currentDay={state.currentDay} coinBalance={state.coinBalance} />

      <div className="flex flex-1 gap-4 p-4 overflow-hidden">
        {/* Farm grid — main area */}
        <main className="flex flex-col gap-4 flex-1 min-w-0">
          {selectedCrop && (
            <p className="font-pixel text-xs text-farm-ink bg-farm-gold/30 px-3 py-2 rounded">
              Planting: {selectedCrop} — click an empty plot
            </p>
          )}
          <FarmGrid
            plots={state.plots}
            currentDay={state.currentDay}
            fertilizerInventory={getFertilizerCount()}
            onPlant={handlePlot}
            onApplyFertilizer={onApplyFertilizer}
            selectedCrop={selectedCrop}
          />
        </main>

        {/* Right column: Shop + Daily Log */}
        <div className="flex flex-col gap-4 w-56 shrink-0">
          <Shop
            coinBalance={state.coinBalance}
            upgradeTier={state.upgradeTier}
            seedInventory={state.seedInventory}
            fertilizerInventory={getFertilizerCount()}
            selectedCrop={selectedCrop}
            getSeedPrice={getSeedPrice}
            onBuySeed={handleBuySeed}
            onSelectCrop={setSelectedCrop}
            onBuyUpgrade={onBuyUpgrade}
            onBuyFertilizer={onBuyFertilizer}
            getNextUpgradeCost={getNextUpgradeCost}
          />

          {/* Daily Log — null on Day 1 before any turn */}
          {lastDailyLog && <DailyLog log={lastDailyLog} />}
        </div>
      </div>

      <footer className="flex justify-center py-4">
        <button
          type="button"
          aria-label="Advance to next day"
          disabled={isProcessing}
          onClick={handleNextDay}
          className="
            px-8 py-3 rounded-lg font-pixel text-sm
            bg-farm-grass text-farm-parchment
            hover:bg-farm-gold hover:text-farm-ink
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
          "
        >
          {isProcessing ? 'Processing…' : 'Next Day →'}
        </button>
      </footer>
    </div>
  );
}
