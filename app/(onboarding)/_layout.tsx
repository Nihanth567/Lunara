import { Stack } from 'expo-router';
import { palette } from '@/constants/colors';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: palette.ink[0] },
      }}
    />
  );
}
