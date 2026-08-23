import { Suspense, useEffect, useState } from 'react';
import { useGameEngine } from './engine/useGameEngine';
import { GameBoard } from './components/GameBoard';
import {
  BankruptcyScreen,
  SeasonTransitionModal,
  prefetchLateModals,
} from './components/lazyModals';
import { requestOnboardingReplay } from './engine/onboarding';
import type { PersonalBests } from './engine/records';
import { initAnalytics, track } from './analytics/track';
import { useAnalyticsEvents } from './analytics/useAnalyticsEvents';

function GrainFilter() {
  return (
    <svg className="hidden" aria-hidden="true" focusable="false">
      <defs>
        <filter id="pp-grain" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
          <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" result="blended" />
          <feComponentTransfer in="blended">
            <feFuncA type="linear" slope="1" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}

/**
 * Placeholder for the code-split terminal screens (bankruptcy, season
 * transition). `prefetchLateModals()` normally warms these chunks during idle
 * time so this never shows, but idle callbacks can be throttled and a cold or
 * slow network can still leave a gap — the bankruptcy screen replaces the whole
 * page, so a `null` fallback would be a blank browser window. Backgrounds match
 * the screens they stand in for, so the handover doesn't flash.
 */
function ScreenFallback({ variant }: { variant: 'page' | 'overlay' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        variant === 'page'
          ? 'flex items-center justify-center min-h-screen bg-farm-soil text-farm-parchment'
          : 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm text-farm-parchment'
      }
    >
      <span className="font-pixel text-body">Loading…</span>
    </div>
  );
}

function App() {
  useEffect(() => {
    initAnalytics();
    prefetchLateModals();
  }, []);

  const engine = useGameEngine();
  useAnalyticsEvents(engine.state);
  const { state, restart, continueSeason, endRunVictory, endOfRunRecap } = engine;

  // Bumped by a replay-tutorial request to remount GameBoard (see below).
  const [replayNonce, setReplayNonce] = useState(0);

  // Shared by the bankruptcy screen and the in-run game menu (024): flag the
  // tutorial for replay, then reset the run so it starts from day 1.
  //
  // The nonce bump remounts GameBoard so the tutorial actually restarts. The
  // onboarding activation is a one-time, mount-only read of the persisted record
  // (useOnboarding), so from the bankruptcy screen — where GameBoard is unmounted
  // and remounts on restart — replay already worked. From the in-run menu
  // GameBoard stays mounted across restart(), so without a forced remount the
  // record reset would never be re-read and the tutorial would not reappear.
  const handleReplayTutorial = () => {
    track('onboarding_replay_requested', {});
    requestOnboardingReplay();
    restart();
    setReplayNonce(n => n + 1);
  };

  // Bankruptcy — terminal run-end (existing behavior)
  if (state.phase === 'bankrupt') {
    const seasonReached = endOfRunRecap ? endOfRunRecap.seasonReached : 1;
    const medal = endOfRunRecap ? endOfRunRecap.medal : 'none';
    const records: PersonalBests = endOfRunRecap ? endOfRunRecap.records : {
      schemaVersion: 2,
      bestDaysSurvived: 0,
      bestPeakBalance: 0,
      bestSeasonReached: 0,
      mostDisastersSurvived: 0,
      bestHarvestStreak: 0,
      totalRunsCompleted: 0,
    };
    const newBests: Set<keyof PersonalBests> = endOfRunRecap ? endOfRunRecap.newBests : new Set();
    return (
      <>
        <GrainFilter />
        <Suspense fallback={<ScreenFallback variant="page" />}>
          <BankruptcyScreen
            daysPlayed={state.currentDay}
            peakBalance={state.peakBalance}
            peakHarvestStreak={state.peakHarvestStreak}
            disastersSurvived={state.disastersSurvived}
            seasonReached={seasonReached}
            medal={medal}
            records={records}
            newBests={newBests}
            lastDailyLog={state.lastDailyLog}
            onRestart={restart}
            onReplayTutorial={handleReplayTutorial}
            showEventsUnlockTease={!state.farmEvents.enabled}
          />
        </Suspense>
      </>
    );
  }

  // Season transition modals overlay the game board
  const transitionVariant =
    state.phase === 'season_passed' ? 'passed' :
    state.phase === 'season_failed' ? 'failed' :
    state.phase === 'season_4_won'  ? 'victory' :
    null;

  return (
    <>
      <GrainFilter />
      <GameBoard
        // Remount on replay-tutorial so the mount-only onboarding init re-reads
        // the freshly reset record and the tutorial restarts. A plain restart
        // does not bump this, so it stays a no-remount reset.
        key={replayNonce}
        state={state}
        lastDailyLog={engine.lastDailyLog}
        onNextDay={engine.nextDay}
        onPlantSeed={engine.plantSeed}
        onBuySeed={cropId => engine.buySeed(cropId, 1)}
        onBuyFertilizer={() => engine.buyFertilizer(1)}
        onApplyFertilizer={engine.applyFertilizer}
        onClearPestDamage={engine.clearPestDamage}
        getFertilizerCount={engine.getFertilizerCount}
        getSeedPrice={engine.getSeedPrice}
        seedYieldMultiplier={engine.getSeedYieldMultiplier()}
        onBuyPlot={engine.buyPlot}
        getNextPlotPrice={engine.getNextPlotPrice}
        recoveryDays={engine.getRecoveryDays()}
        buildingCards={engine.getBuildingCards()}
        onBuyBuilding={engine.buyBuilding}
        onRestart={restart}
        onReplayTutorial={handleReplayTutorial}
        pendingFarmEvent={engine.getPendingFarmEvent()}
        onResolveFarmEvent={engine.resolveFarmEvent}
      />
      {transitionVariant && (
        <Suspense fallback={<ScreenFallback variant="overlay" />}>
          <SeasonTransitionModal
            variant={transitionVariant}
            currentDay={state.currentDay}
            coinBalance={state.coinBalance}
            peakBalance={state.peakBalance}
            onContinue={continueSeason}
            onEndRun={endRunVictory}
            onRestart={restart}
            showEventsUnlockTease={!state.farmEvents.enabled}
          />
        </Suspense>
      )}
    </>
  );
}

export default App;
