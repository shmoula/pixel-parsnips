import { useState } from 'react';
import type { GameState, CropId } from '../engine/types';
import { HUD } from './HUD';
import { FarmGrid } from './FarmGrid';

interface GameBoardProps {
  state: GameState;
  onNextDay: () => void;
  onPlantSeed: (plotId: number, cropId: CropId) => boolean;
}

export function GameBoard({ state, onNextDay, onPlantSeed }: GameBoardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedCrop] = useState<CropId | null>(null);

  function handleNextDay() {
    if (isProcessing) return;
    setIsProcessing(true);
    // Slight async tick so the disabled state renders before processing
    setTimeout(() => {
      onNextDay();
      setIsProcessing(false);
    }, 0);
  }

  function handlePlant(plotId: number) {
    if (selectedCrop) {
      onPlantSeed(plotId, selectedCrop);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 min-h-screen bg-farm-parchment">
      <HUD currentDay={state.currentDay} coinBalance={state.coinBalance} />

      <main className="flex flex-col gap-4 flex-1">
        <FarmGrid
          plots={state.plots}
          onPlant={handlePlant}
          selectedCrop={selectedCrop}
        />
      </main>

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
