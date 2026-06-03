import { useGameEngine } from './engine/useGameEngine';
import { GameBoard } from './components/GameBoard';
import { BankruptcyScreen } from './components/BankruptcyScreen';
import { SeasonTransitionModal } from './components/SeasonTransitionModal';

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

function App() {
  const engine = useGameEngine();
  const { state, restart, continueSeason, endRunVictory } = engine;

  // Bankruptcy — terminal run-end (existing behavior)
  if (state.phase === 'bankrupt') {
    return (
      <>
        <GrainFilter />
        <BankruptcyScreen
          daysPlayed={state.currentDay}
          peakBalance={state.peakBalance}
          lastDailyLog={state.lastDailyLog}
          onRestart={restart}
        />
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
        state={state}
        lastDailyLog={engine.lastDailyLog}
        onNextDay={engine.nextDay}
        onPlantSeed={engine.plantSeed}
        onBuySeed={cropId => engine.buySeed(cropId, 1)}
        onBuyUpgrade={engine.buyUpgrade}
        onBuyFertilizer={() => engine.buyFertilizer(1)}
        onApplyFertilizer={engine.applyFertilizer}
        onClearPestDamage={engine.clearPestDamage}
        getFertilizerCount={engine.getFertilizerCount}
        getSeedPrice={engine.getSeedPrice}
        getNextUpgradeCost={engine.getNextUpgradeCost}
      />
      {transitionVariant && (
        <SeasonTransitionModal
          variant={transitionVariant}
          currentDay={state.currentDay}
          coinBalance={state.coinBalance}
          peakBalance={state.peakBalance}
          onContinue={continueSeason}
          onEndRun={endRunVictory}
          onRestart={restart}
        />
      )}
    </>
  );
}

export default App;
