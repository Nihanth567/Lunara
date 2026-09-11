import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StarField } from '@/components/StarField';
import { useApp, type RemoteAccountState } from '@/context/AppContext';
import { isGoogleSignInConfigured } from '@/lib/googleSignIn';
import { gradients, palette } from '@/constants/colors';
import { radius, space } from '@/constants/tokens';
import { type as text } from '@/constants/typography';

/**
 * Sign in — Apple and Google, and nothing else.
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
) {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  if (!account?.hasProfile) {
    router.replace('/(onboarding)/profile-setup');
    return;
  }
  if (!account.hasCouple) {
    router.replace('/(onboarding)/pairing');
    return;
  }
  await completeOnboarding();
  router.replace('/(app)/' as never);
}

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    signInWithApple,
    signInWithGoogle,
    refreshSharedState,
    completeOnboarding,
  } = useApp();
  const [loading, setLoading] = useState(false);

  const handleApple = async () => {
    setLoading(true);
    try {
      await signInWithApple();
      const account = await refreshSharedState();
      await afterSignIn(router, account, completeOnboarding);
    } catch (error: any) {
      if (error?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Could not sign in with Apple', error?.message ?? 'Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      const account = await refreshSharedState();
      await afterSignIn(router, account, completeOnboarding);
    } catch (error: any) {
      if (error?.code !== 'SIGN_IN_CANCELLED' && error?.code !== '-5') {
        Alert.alert('Could not sign in with Google', error?.message ?? 'Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
          { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 },
        ]}
      >
        <Animated.View style={styles.header}>
          <Text style={styles.title}>Welcome to Lunara</Text>
          <Text style={styles.subtitle}>
            One tap, and everything the two of you share stays in sync.
          </Text>
        </Animated.View>

        <Animated.View style={styles.authOptions}>
          {appleAvailable && (
            <Pressable style={styles.authButton} onPress={handleApple} disabled={loading}>
              <Ionicons name="logo-apple" size={22} color={palette.content[0]} />
              <Text style={styles.authButtonText}>Continue with Apple</Text>
            </Pressable>
          )}

          {googleAvailable && (
            <Pressable style={styles.authButton} onPress={handleGoogle} disabled={loading}>
              <Ionicons name="logo-google" size={20} color={palette.content[0]} />
              <Text style={styles.authButtonText}>Continue with Google</Text>
            </Pressable>
          )}

          {noProviders && (
            <Text style={styles.unavailable}>
              Sign-in isn’t available in this build. Try the demo below.
            </Text>
          )}
        </Animated.View>

        <Animated.View style={styles.demoSection}>
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>
          <Pressable onPress={handleDemoSignIn} style={styles.demoBtn}>
            <Text style={styles.demoBtnText}>Look around first</Text>
          </Pressable>
          <Text style={styles.demoNote}>
            Explore with a stand-in partner — nothing saved, no account
          </Text>
        </Animated.View>

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
    borderColor: 'rgba(248, 241, 246, 0.12)',
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
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(248, 241, 246, 0.08)' },
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
