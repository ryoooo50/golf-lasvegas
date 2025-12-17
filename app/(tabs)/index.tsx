import { ScoreInputScreen } from '../../src/screens/ScoreInputScreen';
import { StartScreen } from '../../src/screens/StartScreen';
import { useGameStore } from '../../src/store/gameStore';

export default function HomeScreen() {
  const gameStatus = useGameStore((state) => state.gameStatus);

  if (gameStatus === 'menu') {
    return <StartScreen />;
  }

  return <ScoreInputScreen />;
}
