import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/context/AppContext';

export default function Index() {
  const router = useRouter();
  const { isLoading, onboardingComplete } = useApp();

  useEffect(() => {
    if (isLoading) return;
    if (onboardingComplete) {
      router.replace('/(app)/' as never);
    } else {
      router.replace('/(onboarding)/welcome');
    }
  }, [isLoading, onboardingComplete]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#0F0C29',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator color="#FF9A8B" size="large" />
    </View>
  );
}
