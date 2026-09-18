import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/context/AppContext';
import { ThinkingOrb } from '@/components/ThinkingOrb';
import { palette } from '@/constants/colors';

/**
 * The entry gate.
 *
 * `onboardingComplete` is an AsyncStorage flag, which says only that this
 * device finished onboarding once — never that the account behind it is still
 * signed in. On its own it sent someone whose session had expired straight
 * into a fully-rendered app: their streak, their partner's name, tonight's
 * cards, and not one write that could land. `sessionExpired` is the context's
 * answer to "we had an account a moment ago and no longer do", and it takes
 * priority, so the app asks for a sign-in instead of pretending.
 *
 * Nothing they have written is lost on the way through — the draft lives in
 * the Tonight screen's own state and in `entries`, neither of which this
 * clears, so signing back in returns them to the night they were in the
 * middle of.
 */
export default function Index() {
  const router = useRouter();
  const { isLoading, onboardingComplete, sessionExpired } = useApp();

  useEffect(() => {
    if (isLoading) return;
    if (sessionExpired) {
      router.replace('/(onboarding)/auth');
    } else if (onboardingComplete) {
      router.replace('/(app)/' as never);
    } else {
      router.replace('/(onboarding)/welcome');
    }
  }, [isLoading, onboardingComplete, sessionExpired]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.ink[0],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* "Breathing" — a slow morphing ring — for the one moment nobody has
          asked the app to do anything yet; it's just working out where they
          go. The other three spots below pick a state that matches what's
          actually happening; this one is ambient on purpose. */}
      <ThinkingOrb state="breathing" size={64} theme="dark" accessibilityLabel="Loading Lunara" />
    </View>
  );
}
