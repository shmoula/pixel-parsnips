import { useGameEngine } from './engine/useGameEngine';
import { GameBoard } from './components/GameBoard';
import { BankruptcyScreen } from './components/BankruptcyScreen';

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
  const {
    state,
    lastDailyLog,
    nextDay,
    plantSeed,
    buySeed,
    buyUpgrade,
    buyFertilizer,
    applyFertilizer,
    clearPestDamage,
    getFertilizerCount,
    restart,
    getSeedPrice,
    getNextUpgradeCost,
  } = useGameEngine();

  if (state.phase === 'bankrupt') {
    return (
      <>
        <GrainFilter />
        <BankruptcyScreen
          daysPlayed={state.currentDay}
          peakBalance={state.peakBalance}
          lastLog={lastDailyLog}
          onRestart={restart}
        />
      </>
    );
  }

  return (
    <>
      <GrainFilter />
      <GameBoard
      state={state}
      lastDailyLog={lastDailyLog}
      onNextDay={nextDay}
      onPlantSeed={plantSeed}
      onBuySeed={cropId => buySeed(cropId, 1)}
      onBuyUpgrade={buyUpgrade}
      onBuyFertilizer={() => buyFertilizer(1)}
      onApplyFertilizer={applyFertilizer}
      onClearPestDamage={clearPestDamage}
      getFertilizerCount={getFertilizerCount}
      getSeedPrice={getSeedPrice}
      getNextUpgradeCost={getNextUpgradeCost}
    />
    </>
  );
}

export default App;
