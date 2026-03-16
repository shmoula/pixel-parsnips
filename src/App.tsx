import { useGameEngine } from './engine/useGameEngine';
import { GameBoard } from './components/GameBoard';
import { BankruptcyScreen } from './components/BankruptcyScreen';

function App() {
  const { state, nextDay, plantSeed, restart } = useGameEngine();

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
      onNextDay={nextDay}
      onPlantSeed={plantSeed}
    />
  );
}

export default App;
