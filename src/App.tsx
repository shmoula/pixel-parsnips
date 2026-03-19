import { useGameEngine } from './engine/useGameEngine';
import { GameBoard } from './components/GameBoard';
import { BankruptcyScreen } from './components/BankruptcyScreen';

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
      <BankruptcyScreen
        daysPlayed={state.currentDay}
        peakBalance={state.peakBalance}
        onRestart={restart}
      />
    );
  }

  return (
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
  );
}

export default App;
