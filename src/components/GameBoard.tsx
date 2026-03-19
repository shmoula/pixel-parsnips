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
  onClearPestDamage: (plotId: number) => void;
  getFertilizerCount: () => number;
  getSeedPrice: (cropId: CropId) => number;
  getNextUpgradeCost: () => number | null;
}

export function GameBoard({
  state,
  lastDailyLog,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onNextDay,
  onPlantSeed,
  onBuySeed,
  onBuyUpgrade,
  onBuyFertilizer,
  onApplyFertilizer,
  onClearPestDamage,
  getFertilizerCount,
  getSeedPrice,
  getNextUpgradeCost,
}: GameBoardProps) {
  const [selectedCrop, setSelectedCrop] = useState<CropId | null>(null);
  // T005 — bottom sheet state (mobile)
  const [isShopOpen, setIsShopOpen] = useState(false);

  function toggleShop() {
    setIsShopOpen(prev => !prev);
  }

  function handlePlot(plotId: number) {
    if (!selectedCrop) return;
    const planted = onPlantSeed(plotId, selectedCrop);
    if (planted) setSelectedCrop(null);
  }

  function handleBuySeed(cropId: CropId) {
    onBuySeed(cropId);
    setSelectedCrop(cropId);
  }

  return (
    // T006 — relative container needed for fixed backdrop to scope correctly
    <div className="flex flex-col min-h-screen bg-farm-parchment">
      <HUD
        currentDay={state.currentDay}
        coinBalance={state.coinBalance}
        onToggleShop={toggleShop}
      />

      {/* T006 — flex-col on mobile, flex-row on desktop */}
      <div className="flex flex-1 flex-col md:flex-row gap-4 p-4 overflow-hidden">
        {/* Farm grid — main area */}
        <main className="flex flex-col gap-4 flex-1 min-w-0">
          {state.flashDroughtDaysRemaining > 0 && (
            <p
              role="alert"
              aria-label="Flash Drought warning"
              className="font-pixel text-xs text-farm-ink bg-farm-red/20 border border-farm-red/40 px-3 py-2 rounded"
            >
              ☀️🔥 Flash Drought — crops planted today grow at half speed.{' '}
              {state.flashDroughtDaysRemaining} day{state.flashDroughtDaysRemaining === 1 ? '' : 's'} remaining.
            </p>
          )}
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
            onClearPestDamage={onClearPestDamage}
            selectedCrop={selectedCrop}
          />
        </main>

        {/* T007 — backdrop: mobile-only, fades in/out behind the bottom sheet */}
        <div
          className={[
            'fixed inset-0 bg-black/40 z-30 transition-opacity md:hidden',
            isShopOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
          ].join(' ')}
          onClick={toggleShop}
          aria-hidden="true"
        />

        {/* T007 — Shop panel: fixed bottom sheet on mobile, inline sidebar on desktop */}
        <div
          className={[
            // Mobile: fixed slide-up panel
            'fixed bottom-0 left-0 right-0 z-40',
            'rounded-t-2xl',
            'max-h-[70vh] overflow-y-auto overscroll-contain',
            'transition-transform duration-300 ease-in-out',
            isShopOpen ? 'translate-y-0' : 'translate-y-full',
            // Desktop: back in flow as right sidebar
            'md:relative md:bottom-auto md:left-auto md:right-auto md:z-auto',
            'md:rounded-none md:max-h-none md:overflow-y-auto',
            'md:w-56 md:shrink-0 md:translate-y-0',
            'md:flex md:flex-col md:gap-4',
          ].join(' ')}
        >
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

          {/* Daily Log — removed from sidebar in Phase 4 / T012 */}
          {lastDailyLog && <DailyLog log={lastDailyLog} />}
        </div>
      </div>

      {/* Footer removed (T006) — Next Day button moves to HUD in Phase 4 / T009 */}
    </div>
  );
}
