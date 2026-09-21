import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/context/AppContext';
import { ThinkingOrb } from '@/components/ThinkingOrb';
import { palette } from '@/constants/colors';
import { isPro } from '@/lib/entitlements';
import { hasStoreKey } from '@/lib/purchases';
import { resolveGate } from '@/lib/accessGate';

/**
 * The entry gate.
 *
 * ─── This screen is now the front door to a paid product ─────────────────────
 *
 * Lunara used to route straight into the app once this device had finished
 * onboarding once. There is no free full product any more: a couple with no
 * active subscription and no running trial does not reach the ritual, they
 * reach the paywall.
 *
 * The decision itself lives in `lib/accessGate.ts` — pure, total and tested —
 * because it depends on two asynchronous signals that settle at different
 * times, and the expensive version of getting it wrong is showing a paywall to
 * somebody who has already paid. This screen does nothing but route.
 *
 * ─── What survives from the old gate ─────────────────────────────────────────
 *
 * `onboardingComplete` is an AsyncStorage flag, which says only that this
 * device finished onboarding once — never that the account behind it is still
 * signed in. `sessionExpired` still outranks it, so an expired session asks for
 * a sign-in rather than rendering a fully-populated app where not one write can
 * land. Nothing anyone has written is lost on the way through either state.
 */
export default function Index() {
  const router = useRouter();
  const { isLoading, onboardingComplete, sessionExpired, couple, purchasesReady } = useApp();

  const destination = resolveGate({
    isLoading,
    sessionExpired,
    onboardingComplete,
    coupleEntitled: isPro(couple),
    purchasesReady,
    purchasesConfigurable: hasStoreKey(),
    isDev: __DEV__,
    isDemo: couple?.isDemoMode ?? false,
  });

  useEffect(() => {
    switch (destination) {
      case 'loading':
        return;
      case 'auth':
        router.replace('/(onboarding)/auth');
        return;
      case 'onboarding':
        router.replace('/(onboarding)/welcome');
        return;
      case 'paywall':
        // `gate=1` is what makes the paywall non-dismissible: there is nothing
        // behind it to go back to.
        router.replace('/(modals)/paywall?gate=1' as never);
        return;
      case 'app':
        router.replace('/(app)/' as never);
    }
  }, [destination]);

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
