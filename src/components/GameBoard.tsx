import { useEffect, useRef, useState } from 'react';
import type { GameState, CropId, DailyLogEntry, WeatherId } from '../engine/types';
import { canAdvanceProductively } from '../engine/gameEngine';
import { useOnboarding } from '../hooks/useOnboarding';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { BottomActionBar } from './BottomActionBar';
import { HUD } from './HUD';
import { FarmGrid } from './FarmGrid';
import { Shop } from './Shop';
import { DaySummaryModal } from './DaySummaryModal';
import { OnboardingOverlay } from './OnboardingOverlay';

function canAfford(balance: number, price: number | null): boolean {
  if (price === null) return false;
  return balance >= price;
}

/** Null-safe harvest income from the last daily log. */
function getHarvestIncome(state: GameState): number {
  return state.lastDailyLog?.totalHarvestIncome ?? 0;
}

function FlashDroughtBanner({ daysRemaining }: { daysRemaining: number }) {
  if (daysRemaining === 0) return null;
  const suffix = daysRemaining === 1 ? '' : 's';
  return (
    <p
      role="alert"
      aria-label="Flash Drought warning"
      className="font-pixel text-xs text-farm-red bg-farm-red/20 border border-farm-red/70 tracking-wide px-3 py-2 rounded"
    >
      ☀️🔥 Flash Drought — crops planted today grow at half speed.{' '}
      {daysRemaining} day{suffix} remaining.
    </p>
  );
}

function EmptyDayConfirm({ onCancel, onAdvance }: { onCancel: () => void; onAdvance: () => void }) {
  return (
    <div role="dialog" aria-label="Advance empty day" className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-6">
      <div className="max-w-xs w-full bg-farm-soil border border-farm-stone/40 rounded-xl p-5 flex flex-col gap-4 text-center">
        <p className="font-pixel text-xs text-farm-parchment leading-relaxed">
          Nothing's planted — advance anyway?
        </p>
        <div className="flex gap-2 justify-center">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="font-pixel text-xs px-4 py-2 rounded bg-farm-grass text-farm-parchment hover:bg-farm-gold hover:text-farm-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAdvance}
            className="font-pixel text-xs px-4 py-2 rounded bg-farm-ink text-farm-parchment border border-farm-stone/40 hover:bg-farm-soil"
          >
            Advance
          </button>
        </div>
      </div>
    </div>
  );
}

interface GameBoardProps {
  state: GameState;
  lastDailyLog: DailyLogEntry | null;
  onNextDay: (weatherOverride?: WeatherId) => void;
  onPlantSeed: (plotId: number, cropId: CropId) => boolean;
  onBuySeed: (cropId: CropId) => void;
  onBuyUpgrade: () => void;
  onBuyFertilizer: () => void;
  onApplyFertilizer: (plotId: number) => void;
  onClearPestDamage: (plotId: number) => void;
  getFertilizerCount: () => number;
  getSeedPrice: (cropId: CropId) => number;
  getNextUpgradeCost: () => number | null;
  onBuyPlot: () => boolean;
  getNextPlotPrice: () => number | null;
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
  onClearPestDamage,
  getFertilizerCount,
  getSeedPrice,
  getNextUpgradeCost,
  onBuyPlot,
  getNextPlotPrice,
}: GameBoardProps) {
  const [selectedCrop, setSelectedCrop] = useState<CropId | null>(null);

  // T005 — bottom sheet state (mobile)
  const [isShopOpen, setIsShopOpen] = useState(false);

  // T010 — Day Summary modal state
  const [daySummary, setDaySummary] = useState<DailyLogEntry | null>(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [summaryAnimate, setSummaryAnimate] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  // Ref flag: set true when we want the next lastDailyLog update to open the modal
  const awaitingModalRef = useRef(false);

  const isDesktop = useMediaQuery('(min-width: 768px)');
  const isShopVisible = isDesktop || isShopOpen;
  const onboarding = useOnboarding(state, { isShopVisible });
  const canAdvance = canAdvanceProductively(state);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const [hasConfirmedEmptyDay, setHasConfirmedEmptyDay] = useState(false);

  // T010 — When the parent re-renders with a new lastDailyLog after onNextDay(),
  // open the Day Summary modal with that log.
  useEffect(() => {
    if (awaitingModalRef.current && lastDailyLog !== null) {
      awaitingModalRef.current = false;
      setDaySummary(lastDailyLog);
      setSummaryAnimate(true);
      setIsSummaryOpen(true);
      setIsProcessing(false);
    }
  }, [lastDailyLog]);

  // Auto-deselect when the selected crop's inventory runs out.
  useEffect(() => {
    if (selectedCrop && state.seedInventory[selectedCrop] === 0) {
      setSelectedCrop(null);
    }
  }, [selectedCrop, state.seedInventory]);

  function toggleShop() {
    setIsShopOpen(prev => !prev);
  }

  // T010 — Next Day handler: flag modal as awaited, then fire the engine callback
  function doAdvance() {
    if (isProcessing) return;
    setIsProcessing(true);
    awaitingModalRef.current = true;
    onNextDay(onboarding.shouldPinWeather ? 'sunny' : undefined);
  }

  function handleNextDay() {
    if (isProcessing) return;
    if (!canAdvance && !hasConfirmedEmptyDay) { setShowEmptyConfirm(true); return; }
    doAdvance();
  }

  function handlePlot(plotId: number) {
    if (!selectedCrop) return;
    onPlantSeed(plotId, selectedCrop);
    // Selection persists across plants; the effect below clears it when inventory empties.
  }

  function handleBuySeed(cropId: CropId) {
    onBuySeed(cropId);
    setSelectedCrop(cropId);
  }

  const nextPlotPrice = getNextPlotPrice();
  const canAffordPlot = canAfford(state.coinBalance, nextPlotPrice);

  return (
    // T006 — relative container needed for fixed backdrop to scope correctly
    <div className="flex flex-col min-h-screen bg-[#140E06]">
      <HUD
        currentDay={state.currentDay}
        coinBalance={state.coinBalance}
        onNextDay={handleNextDay}
        onLastTurn={() => {
          setSummaryAnimate(false);
          setIsSummaryOpen(true);
        }}
        isProcessing={isProcessing}
        hasLastTurn={lastDailyLog !== null}
        endlessMode={state.endlessMode}
        harvestStreak={state.harvestStreak}
        canAdvanceProductively={canAdvance}
      />

      {/* T006 — flex-col on mobile, flex-row on desktop; no flex-1 so board grows with content */}
      <div className="flex flex-col md:flex-row gap-4 p-4 pb-24 md:pb-4">
        {/* Farm grid — main area */}
        <main className="flex flex-col gap-4 flex-1 min-w-0">
          <FlashDroughtBanner daysRemaining={state.flashDroughtDaysRemaining} />
          {selectedCrop && (
            <p className="font-pixel text-xs text-farm-gold bg-farm-gold/10 border border-farm-gold/30 px-3 py-2 rounded">
              🌱 Planting: {selectedCrop} — click an empty plot
            </p>
          )}
          <FarmGrid
            plots={state.plots}
            currentDay={state.currentDay}
            fertilizerInventory={getFertilizerCount()}
            onPlant={handlePlot}
            onApplyFertilizer={onApplyFertilizer}
            onClearPestDamage={onClearPestDamage}
            unlockedPlots={state.unlockedPlots}
            nextPlotPrice={nextPlotPrice}
            canAffordPlot={canAffordPlot}
            onBuyPlot={onBuyPlot}
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
        {/* T012 — DailyLog removed from sidebar (now shown only in DaySummaryModal) */}
        <div
          className={[
            // Mobile: fixed slide-up panel
            'fixed bottom-0 left-0 right-0 z-40',
            'rounded-t-2xl',
            'max-h-[70vh] overflow-y-auto overscroll-contain',
            'transition-transform duration-300 ease-in-out',
            isShopOpen ? 'translate-y-0' : 'translate-y-full',
            // Desktop: back in flow as right sidebar, page scroll handles everything
            'md:relative md:bottom-auto md:left-auto md:right-auto md:z-auto',
            'md:rounded-none md:max-h-none md:overflow-visible',
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
            marketActive={state.market.active}
            dimNonRadish={onboarding.active && onboarding.step === 'buy-radishes'}
          />
        </div>
      </div>

      {/* T011 — Day Summary modal: opens after each turn, reopenable via Last Turn */}
      {isSummaryOpen && daySummary !== null && (
        <DaySummaryModal
          log={daySummary}
          animateReveal={summaryAnimate}
          onClose={() => setIsSummaryOpen(false)}
        />
      )}

      {onboarding.active && (
        <OnboardingOverlay
          step={onboarding.step}
          harvestIncome={getHarvestIncome(state)}
          onStart={onboarding.onStart}
          onSkip={onboarding.onSkip}
          onDismissPayoff={onboarding.onDismissPayoff}
        />
      )}

      {showEmptyConfirm && (
        <EmptyDayConfirm
          onCancel={() => setShowEmptyConfirm(false)}
          onAdvance={() => {
            setShowEmptyConfirm(false);
            setHasConfirmedEmptyDay(true);
            doAdvance();
          }}
        />
      )}

      <BottomActionBar
        onToggleShop={toggleShop}
        onNextDay={handleNextDay}
        isProcessing={isProcessing}
        canAdvanceProductively={canAdvance}
      />
    </div>
  );
}
