import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StarField } from '@/components/StarField';
import { SpringPressable } from '@/components/SpringPressable';
import { ThinkingOrb } from '@/components/ThinkingOrb';
import { OnboardingPhoto } from '@/components/OnboardingFrame';
import { ONBOARDING_PHOTOS } from '@/assets/images/onboarding';
import { haptic } from '@/lib/haptics';
import { useApp, type RemoteAccountState } from '@/context/AppContext';
import { isGoogleSignInConfigured } from '@/lib/googleSignIn';
import { gradients, palette, tint } from '@/constants/colors';
import { radius, space, touchTarget } from '@/constants/tokens';
import { type as text } from '@/constants/typography';

/**
 * Sign in — Apple and Google, and nothing else.
 *
 * This is the screen for the person *starting* a couple (and for anyone
 * returning). The partner who joins with a code never sees it: they give a name
 * on the pairing screen and get an anonymous account there — see
 * `joinCoupleAsGuest` in AppContext.
 *
 * This screen used to offer four ways in: Apple, Google, phone OTP and
 * email/password. Four is not generosity, it is a decision handed to someone
 * who has been in the app for less than a minute, and each extra route is a
 * separate account that can end up being the "wrong" one when the same person
 * reinstalls and picks differently. Two federated providers cover effectively
 * everyone on both platforms, neither needs a password, and both return a
 * verified identity — so pairing can trust it.
 *
 * Removing phone and email also removed the app's only unverified-identity
 * path, which is what made `signUpWithEmail`'s "check your email to confirm"
 * dead-end state necessary in the first place.
 */

/**
 * Where a successful sign-in lands.
 *
 * Every caller used to pass an empty name, so *everyone* was sent to profile
 * setup — including someone reinstalling the app, who then had to re-enter a
 * name the server already had and was offered "Start a new couple" for a couple
 * they were already in (which `create_couple` rejects outright). The server's
 * own answer decides: no name → profile setup, no couple → pairing, otherwise
 * they are a returning user and belong straight in the app.
 */
async function afterSignIn(
  router: ReturnType<typeof useRouter>,
  account: RemoteAccountState | null,
  completeOnboarding: () => Promise<void>,
  intent: string | undefined,
) {
  haptic.success();
  // Carried from "Invite my partner" so pairing can go straight to the code.
  const query = intent === 'invite' ? '?intent=invite' : '';
  if (!account?.hasProfile) {
    router.replace(`/(onboarding)/profile-setup${query}` as never);
    return;
  }
  if (!account.hasCouple) {
    router.replace(`/(onboarding)/pairing${query}` as never);
    return;
  }
  await completeOnboarding();
  router.replace('/(app)/' as never);
}

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { intent, after } = useLocalSearchParams<{ intent?: string; after?: string }>();
  /**
   * The late sign-in: reached from the paywall (or on resume) with a trial
   * already running on an anonymous account. Signing in here *links* Apple or
   * Google to that account rather than making a new one, so the purchase and
   * the profile the webhook unlocks stay put. See `authenticateWithIdToken`.
   */
  const lateSignIn = after === 'trial';
  const {
    signInWithApple,
    signInWithGoogle,
    refreshSharedState,
    completeOnboarding,
    carryPurchaseToAccount,
    deviceEntitled,
  } = useApp();

  /**
   * If the sign-in replaced the device's account instead of linking to it, a
   * purchase made a minute ago is still on the old one. Carry it across before
   * routing on, or pairing would open the app onto a paywall for a trial they
   * just started. A failure here isn't fatal: the gate's paywall still has
   * Restore.
   */
  const settle = async (switchedAccount: boolean, hadPurchase: boolean) => {
    if (switchedAccount && hadPurchase) await carryPurchaseToAccount().catch(() => false);
    const account = await refreshSharedState();
    await afterSignIn(router, account, completeOnboarding, intent);
  };
  /**
   * Which provider is in flight. Both buttons used to share one boolean and
   * simply went inert — nothing on screen said which one you'd pressed, or
   * that anything was happening at all while the provider sheet came up and
   * the account loaded behind it.
   */
  const [pending, setPending] = useState<'apple' | 'google' | null>(null);
  const loading = pending !== null;

  const handleApple = async () => {
    setPending('apple');
    const hadPurchase = deviceEntitled;
    try {
      const { switchedAccount } = await signInWithApple();
      await settle(switchedAccount, hadPurchase);
    } catch (error: any) {
      if (error?.code !== 'ERR_REQUEST_CANCELED') {
        haptic.error();
        Alert.alert(
          'Apple sign-in didn’t finish',
          `${error?.message ?? 'Something got in the way.'} Nothing’s lost — try once more.`,
        );
      }
    } finally {
      setPending(null);
    }
  };

  const handleGoogle = async () => {
    setPending('google');
    const hadPurchase = deviceEntitled;
    try {
      const { switchedAccount } = await signInWithGoogle();
      await settle(switchedAccount, hadPurchase);
    } catch (error: any) {
      if (error?.code !== 'SIGN_IN_CANCELLED' && error?.code !== '-5') {
        haptic.error();
        Alert.alert(
          'Google sign-in didn’t finish',
          `${error?.message ?? 'Something got in the way.'} Nothing’s lost — try once more.`,
        );
      }
    } finally {
      setPending(null);
    }
  };

  const handleDemoSignIn = () => {
    router.push('/(onboarding)/pairing');
  };

  // Hidden rather than shown-and-broken when the build has no Google client id.
  const googleAvailable = isGoogleSignInConfigured();
  const appleAvailable = Platform.OS === 'ios';
  // With phone and email gone this is a dead end rather than a degraded screen,
  // so it says so instead of rendering an empty box.
  const noProviders = !googleAvailable && !appleAvailable;

  return (
    <LinearGradient
      colors={gradients.screen}
      locations={gradients.screenLocations}
      style={styles.container}
    >
      <StarField />
      <View
        style={[
          styles.content,
          // Less top room after the paywall: the photo takes it, and the
          // buttons still have to fit on a small phone without scrolling.
          { paddingTop: insets.top + (lateSignIn ? 24 : 60), paddingBottom: insets.bottom + 40 },
        ]}
      >
        {/* The good part they just paid for — the last picture before the
            last two steps. Only on the late sign-in; a returning user
            doesn't need selling to. */}
        {lateSignIn && <OnboardingPhoto photo={ONBOARDING_PHOTOS.delight} aspectRatio={2} />}

        <Animated.View style={styles.header}>
          <Text style={styles.title}>
            {lateSignIn ? 'You’re in. Now keep it safe.' : 'Welcome to Lunara'}
          </Text>
          <Text style={styles.subtitle}>
            {lateSignIn
              ? 'Sign in so your nights are saved to your account and follow you to any phone. Your partner won’t need to.'
              : 'One tap, and everything the two of you share stays in sync.'}
          </Text>
        </Animated.View>

        <Animated.View style={styles.authOptions}>
          {appleAvailable && (
            <SpringPressable
              style={styles.authButton}
              onPress={handleApple}
              disabled={loading}
              // The one you pressed stays bright and shows it is working; the
              // other dims, so it's clear which way in is happening.
              dimWhenDisabled={pending !== 'apple'}
              accessibilityState={{ busy: pending === 'apple' }}
            >
              {pending === 'apple' ? (
                <ThinkingOrb state="working" size={20} theme="dark" accessibilityLabel="Signing in with Apple" />
              ) : (
                <Ionicons name="logo-apple" size={22} color={palette.content[0]} />
              )}
              <Text style={styles.authButtonText}>
                {pending === 'apple' ? 'Signing you in…' : 'Continue with Apple'}
              </Text>
            </SpringPressable>
          )}

          {googleAvailable && (
            <SpringPressable
              style={styles.authButton}
              onPress={handleGoogle}
              disabled={loading}
              dimWhenDisabled={pending !== 'google'}
              accessibilityState={{ busy: pending === 'google' }}
            >
              {pending === 'google' ? (
                <ThinkingOrb state="working" size={20} theme="dark" accessibilityLabel="Signing in with Google" />
              ) : (
                <Ionicons name="logo-google" size={20} color={palette.content[0]} />
              )}
              <Text style={styles.authButtonText}>
                {pending === 'google' ? 'Signing you in…' : 'Continue with Google'}
              </Text>
            </SpringPressable>
          )}

          {noProviders && (
            <Text style={styles.unavailable}>
              Sign-in isn’t available in this build. Try the demo below.
            </Text>
          )}
        </Animated.View>

        {/* Not after the paywall: someone who has just started a trial has
            nothing to preview, and a stand-in partner would only be a detour
            between them and their real one. */}
        {!lateSignIn && (
          <Animated.View style={styles.demoSection}>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
            <SpringPressable
              onPress={handleDemoSignIn}
              style={styles.demoBtn}
              disabled={loading}
              feedback="highlight"
            >
              <Text style={styles.demoBtnText}>Look around first</Text>
            </SpringPressable>
            <Text style={styles.demoNote}>
              Explore with a stand-in partner — nothing saved, no account
            </Text>
          </Animated.View>
        )}

        <Animated.View>
          <Text style={styles.legal}>
            By continuing, you agree to our{' '}
            <Text style={styles.legalLink} onPress={() => router.push('/(modals)/terms')}>
              Terms of Service
            </Text>{' '}
            and{' '}
            <Text style={styles.legalLink} onPress={() => router.push('/(modals)/privacy')}>
              Privacy Policy
            </Text>
            . We take your privacy seriously — especially for users under 18.
          </Text>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 26, gap: space.xl },
  header: { gap: space.sm },
  title: { ...text.title, color: palette.content[0] },
  subtitle: { ...text.callout, color: palette.content[1], lineHeight: 22 },

  authOptions: { gap: space.md },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: tint.cream(0.12),
    minHeight: touchTarget + space.sm,
    paddingVertical: space.lg,
    paddingHorizontal: 20,
  },
  authButtonText: { ...text.label, color: palette.content[0] },
  unavailable: {
    ...text.callout,
    color: palette.content[2],
    textAlign: 'center',
    lineHeight: 21,
  },

  demoSection: { gap: space.sm },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(247, 241, 232, 0.08)' },
  dividerText: { ...text.caption, color: palette.content[2] },
  demoBtn: { alignItems: 'center', paddingVertical: 10 },
  demoBtnText: { ...text.label, color: palette.content[1] },
  demoNote: { ...text.caption, color: palette.content[2], textAlign: 'center' },

  legal: {
    ...text.caption,
    color: palette.content[2],
    textAlign: 'center',
    lineHeight: 17,
  },
  legalLink: { color: palette.content[1], textDecorationLine: 'underline' },
});
