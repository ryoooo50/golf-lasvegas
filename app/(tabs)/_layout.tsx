import { Stack } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="scorecard" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="history" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="settings" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="round-detail" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="share" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="admin" options={{ presentation: 'card', animation: 'slide_from_right' }} />
    </Stack>
  );
}
