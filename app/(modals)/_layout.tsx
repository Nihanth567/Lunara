import { Stack } from 'expo-router';

export default function ModalsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="paywall" />
      <Stack.Screen name="terms" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="privacy" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
