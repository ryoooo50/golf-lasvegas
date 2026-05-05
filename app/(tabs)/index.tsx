import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { AuthScreen } from '../../src/screens/AuthScreen';
import { ScoreInputScreen } from '../../src/screens/ScoreInputScreen';
import { StartScreen } from '../../src/screens/StartScreen';
import { useAuthStore } from '../../src/store/authStore';
import { useGameStore } from '../../src/store/gameStore';

export default function HomeScreen() {
  const { user, isGuest, isLoading, initialize } = useAuthStore();
  const gameStatus = useGameStore((state) => state.gameStatus);

  // React.StrictMode 対策: 一度だけ initialize() を呼ぶ
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (!user && !isGuest) {
    return <AuthScreen />;
  }

  if (gameStatus === 'menu') {
    return <StartScreen />;
  }

  return <ScoreInputScreen />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
