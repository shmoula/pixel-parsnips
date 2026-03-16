import { useGameEngine } from './engine/useGameEngine';
import { GameBoard } from './components/GameBoard';

function App() {
  const { state, nextDay, plantSeed } = useGameEngine();

  return (
    <GameBoard
      state={state}
      onNextDay={nextDay}
      onPlantSeed={plantSeed}
    />
  );
}

export default App;
