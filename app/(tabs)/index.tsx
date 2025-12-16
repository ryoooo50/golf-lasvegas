import { ResultScreen } from '../../src/screens/ResultScreen';
import { ScoreInputScreen } from '../../src/screens/ScoreInputScreen';
import { useGameStore } from '../../src/store/gameStore';

export default function HomeScreen() {
  const { gameStatus } = useGameStore();

  if (gameStatus === 'finished') {
    return <ResultScreen />;
  }

  return <ScoreInputScreen />;
}
