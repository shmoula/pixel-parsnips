import { useEffect, useRef, useState } from 'react';
import type { GameState, CropId, DailyLogEntry, WeatherId } from '../engine/types';
import { canAdvanceProductively } from '../engine/gameEngine';
import { useOnboarding, buyRadishesNeeded } from '../hooks/useOnboarding';
import type { OnboardingStep } from '../engine/onboarding';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { BottomActionBar } from './BottomActionBar';
import { HUD } from './HUD';
import { FarmGrid } from './FarmGrid';
import { Shop } from './Shop';
import { EmojiIcon } from './EmojiIcon';
import { PageBackdrop } from './PageBackdrop';
import { DaySummaryModal } from './DaySummaryModal';
import { OnboardingOverlay } from './OnboardingOverlay';

function canAfford(balance: number, price: number | null): boolean {
  if (price === null) return false;
  return balance >= price;
}

/** Null-safe gross harvest income from the last daily log. */
function getHarvestIncome(state: GameState): number {
  return state.lastDailyLog?.totalHarvestIncome ?? 0;
}

/** Null-safe net coins change from the last daily log (after lease & tax). */
function getNetIncome(state: GameState): number {
  return state.lastDailyLog?.netChange ?? 0;
}

/** 017 FR-005 — live seed-buying progress shown during the buy-radishes onboarding step. */
function getBuyProgress(
  state: GameState,
  step: OnboardingStep,
): { owned: number; needed: number } | null {
  if (step !== 'buy-radishes') return null;
  return { owned: state.seedInventory.radish, needed: buyRadishesNeeded(state) };
}

/** 017 FR-014 — guidance copy for a seedless plot tap. */
function getSeedlessTapHint(seedInventory: GameState['seedInventory']): string {
  const ownsSeeds = Object.values(seedInventory).some(n => n > 0);
  return ownsSeeds
    ? "Pick a seed first — tap 'Plant' on a seed you own."
    : 'You need seeds — grab some in the shop.';
}

/** 017 FR-014 — react to a plot tap with no seed selected: surface a hint,
 * and on mobile, pop the shop sheet open so the player can pick one. */
function onSeedlessPlotTap({ seedInventory, isDesktop, showSeedHint, openShop }: {
  seedInventory: GameState['seedInventory'];
  isDesktop: boolean;
  showSeedHint: (message: string) => void;
  openShop: () => void;
}): void {
  showSeedHint(getSeedlessTapHint(seedInventory));
  if (!isDesktop) openShop();
}

/** 017 FR-014 — transient (auto-clearing) guidance message state. */
function useSeedHint() {
  const [seedHint, setSeedHint] = useState<string | null>(null);
  const hintTimerRef = useRef<number | null>(null);

  function showSeedHint(message: string) {
    setSeedHint(message);
    if (hintTimerRef.current !== null) window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => setSeedHint(null), 4000);
  }

  useEffect(() => () => {
    if (hintTimerRef.current !== null) window.clearTimeout(hintTimerRef.current);
  }, []);

  return { seedHint, showSeedHint };
}

/**
 * FR-017: the run is unwinnable when nothing is growing, no seeds are owned,
 * and the player can't afford even the cheapest seed (radish) to plant one.
 */
function checkIsUnwinnable(
  state: GameState,
  canAdvance: boolean,
  getSeedPrice: (cropId: CropId) => number
): boolean {
  const anySeedOwned = Object.values(state.seedInventory).some(n => n > 0);
  return !canAdvance && !anySeedOwned && state.coinBalance < getSeedPrice('radish');
}

function FlashDroughtBanner({ daysRemaining }: { daysRemaining: number }) {
  if (daysRemaining === 0) return null;
  const suffix = daysRemaining === 1 ? '' : 's';
  return (
    <p
      role="alert"
      aria-label="Flash Drought warning"
      className="font-pixel text-body text-farm-red bg-farm-red/20 border border-farm-red/70 tracking-wide px-3 py-2 rounded"
    >
      <EmojiIcon>☀️🔥</EmojiIcon> Flash Drought — crops planted today grow at half speed.{' '}
      {daysRemaining} day{suffix} remaining.
    </p>
  );
}

/** 017 FR-014 — transient hint shown after a seedless plot tap; hidden once a
 * crop gets selected so it never lingers stale over the "Planting: X" banner. */
function SeedHintBanner({ seedHint, selectedCrop }: { seedHint: string | null; selectedCrop: CropId | null }) {
  if (!seedHint || selectedCrop) return null;
  return (
    <p
      role="status"
      className="font-pixel text-body text-farm-gold bg-farm-gold/10 border border-farm-gold/30 px-3 py-2 rounded"
    >
      <EmojiIcon>🌱</EmojiIcon> {seedHint}
    </p>
  );
}

function UnwinnableBanner({ isUnwinnable, onRestart }: { isUnwinnable: boolean; onRestart: () => void }) {
  const [armed, setArmed] = useState(false);

  // Auto-disarm after a short window so a much-later tap can't restart without a
  // fresh first tap; also reset whenever the banner leaves the unwinnable state.
  useEffect(() => {
    if (!isUnwinnable) {
      setArmed(false);
      return;
    }
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [armed, isUnwinnable]);

  if (!isUnwinnable) return null;
  return (
    <div
      role="alert"
      aria-label="Run cannot recover"
      className="flex flex-wrap items-center justify-between gap-2 font-pixel text-body text-farm-red bg-farm-red/20 border border-farm-red/70 px-3 py-2 rounded"
    >
      <span>
        <EmojiIcon>💸</EmojiIcon> Out of options — you can't afford seeds and nothing is growing.
        Skip days to the end, or start over.
      </span>
      <button
        type="button"
        onClick={() => (armed ? onRestart() : setArmed(true))}
        className="font-pixel text-body px-3 py-1.5 min-h-[44px] md:min-h-0 rounded bg-farm-ink text-farm-parchment border border-farm-stone/40 hover:bg-farm-soil"
      >
        {armed ? 'Tap again to confirm' : 'Start new run'}
      </button>
    </div>
  );
}

function EmptyDayConfirm({ onCancel, onAdvance }: { onCancel: () => void; onAdvance: () => void }) {
  return (
    <div role="dialog" aria-label="Advance empty day" className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-6">
      <div className="max-w-xs w-full bg-farm-soil border border-farm-stone/40 rounded-xl p-5 flex flex-col gap-4 text-center">
        <p className="font-pixel text-body text-farm-parchment leading-relaxed">
          Nothing's planted — advance anyway?
        </p>
        <div className="flex gap-2 justify-center">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="font-pixel text-body px-4 py-2 rounded bg-farm-grass text-farm-parchment hover:bg-farm-gold hover:text-farm-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAdvance}
            className="font-pixel text-body px-4 py-2 rounded bg-farm-ink text-farm-parchment border border-farm-stone/40 hover:bg-farm-soil"
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
  onBuyFertilizer: () => void;
  onApplyFertilizer: (plotId: number) => void;
  onClearPestDamage: (plotId: number) => void;
  getFertilizerCount: () => number;
  getSeedPrice: (cropId: CropId) => number;
  onBuyPlot: () => boolean;
  getNextPlotPrice: () => number | null;
  /** Reset to a fresh run (unwinnable-state escape hatch, 017 FR-017). */
  onRestart: () => void;
}

export function GameBoard({
  state,
  lastDailyLog,
  onNextDay,
  onPlantSeed,
  onBuySeed,
  onBuyFertilizer,
  onApplyFertilizer,
  onClearPestDamage,
  getFertilizerCount,
  getSeedPrice,
  onBuyPlot,
  getNextPlotPrice,
  onRestart,
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

  const isUnwinnable = checkIsUnwinnable(state, canAdvance, getSeedPrice);

  const { seedHint, showSeedHint } = useSeedHint();

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

  // 017 FR-004 — the bar's shop button can only OPEN (the bar hides while the
  // sheet is up); the backdrop CLOSES. A toggle here let double-fired events
  // close the sheet right after opening, stranding the tutorial's buy step.
  const openShop = () => setIsShopOpen(true);
  const closeShop = () => setIsShopOpen(false);

  // When onboarding reaches the planting step, close the mobile shop sheet so the
  // farm grid it covers becomes visible and tappable — otherwise the "fill every
  // plot" highlight floats over the open sheet and the plots can't be reached.
  // No-op on desktop, where the shop is an always-open sidebar and isShopOpen stays false.
  useEffect(() => {
    if (onboarding.active && onboarding.step === 'plant') {
      closeShop();
    }
  }, [onboarding.active, onboarding.step]);

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
    if (!selectedCrop) {
      onSeedlessPlotTap({ seedInventory: state.seedInventory, isDesktop, showSeedHint, openShop });
      return;
    }
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
    // 018 — page colour lives on PageBackdrop now (a fixed -z-10 layer scoped to
    // the viewport; no positioned ancestor needed). Body is transparent so it shows.
    <div className="flex flex-col min-h-screen">
      <PageBackdrop />
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
          <UnwinnableBanner isUnwinnable={isUnwinnable} onRestart={onRestart} />
          <FlashDroughtBanner daysRemaining={state.flashDroughtDaysRemaining} />
          {selectedCrop && (
            <p className="font-pixel text-body text-farm-gold bg-farm-gold/10 border border-farm-gold/30 px-3 py-2 rounded">
              <EmojiIcon>🌱</EmojiIcon> Planting: {selectedCrop} — click an empty plot
            </p>
          )}
          <SeedHintBanner seedHint={seedHint} selectedCrop={selectedCrop} />
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
          onClick={closeShop}
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
            seedInventory={state.seedInventory}
            fertilizerInventory={getFertilizerCount()}
            selectedCrop={selectedCrop}
            getSeedPrice={getSeedPrice}
            onBuySeed={handleBuySeed}
            onSelectCrop={setSelectedCrop}
            onBuyFertilizer={onBuyFertilizer}
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
          netIncome={getNetIncome(state)}
          isShopOpen={isShopOpen}
          buyProgress={getBuyProgress(state, onboarding.step)}
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

      {/* Hidden while the mobile shop sheet is open: the sheet is anchored to the
          same bottom edge, so a visible bar would overlay (and steal taps from) its
          bottom rows. Desktop keeps isShopOpen false, so the bar still renders there
          (and is md:hidden). Dismiss the sheet via the backdrop. */}
      <BottomActionBar
        hidden={isShopOpen}
        onOpenShop={openShop}
        onNextDay={handleNextDay}
        isProcessing={isProcessing}
        canAdvanceProductively={canAdvance}
      />
    </div>
  );
}
