import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';
import { useApp, type RemoteAccountState } from '@/context/AppContext';
import { isGoogleSignInConfigured } from '@/lib/googleSignIn';
import { supabase } from '@/lib/supabase';
import { radius } from '@/constants/tokens';

type AuthMode = 'choose' | 'phone' | 'phone-otp' | 'email';

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
    sendPhoneOtp,
    verifyPhoneOtp,
    signUpWithEmail,
    signInWithEmail,
    refreshSharedState,
    completeOnboarding,
  } = useApp();
  const [mode, setMode] = useState<AuthMode>('choose');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [emailIsSignUp, setEmailIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailNotice, setEmailNotice] = useState('');
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

  // Hidden rather than shown-and-broken when the build has no Google client id.
  const googleAvailable = isGoogleSignInConfigured();

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

  const handleSendOtp = async () => {
    if (phone.trim().length < 8) return;
    setLoading(true);
    try {
      await sendPhoneOtp(phone.trim());
      setMode('phone-otp');
    } catch (error: any) {
      Alert.alert('Could not send code', error?.message ?? 'Please check the number and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.trim().length < 4) return;
    setLoading(true);
    try {
      await verifyPhoneOtp(phone.trim(), otp.trim());
      const account = await refreshSharedState();
      await afterSignIn(router, account, completeOnboarding);
    } catch (error: any) {
      Alert.alert('Could not verify code', error?.message ?? 'Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async () => {
    if (email.trim().length < 5 || password.length < 6) return;
    setLoading(true);
    setEmailNotice('');
    try {
      if (emailIsSignUp) {
        await signUpWithEmail(email.trim(), password);
        // If email confirmations are on, Supabase won't return a session yet —
        // guide them to confirm and come back to sign in rather than looking stuck.
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setEmailNotice('Almost there — check your email to confirm your account, then sign in.');
          setEmailIsSignUp(false);
          setLoading(false);
          return;
        }
      } else {
        await signInWithEmail(email.trim(), password);
      }
      const account = await refreshSharedState();
      await afterSignIn(router, account, completeOnboarding);
    } catch (error: any) {
      Alert.alert(
        emailIsSignUp ? 'Could not create your account' : 'Could not sign in',
        error?.message ?? 'Please check your details and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(onboarding)/pairing');
  };

  if (mode === 'phone' || mode === 'phone-otp') {
    return (
      <LinearGradient colors={['#0A0817', '#141127', '#23203D']} style={styles.container}>
        <StarField />
        <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }]}>
          <Pressable
            onPress={() => setMode(mode === 'phone-otp' ? 'phone' : 'choose')}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color="#C0B8D4" />
          </Pressable>

          {mode === 'phone' ? (
            <Animated.View style={styles.phoneSection}>
              <Text style={styles.title}>Enter your phone number</Text>
              <Text style={styles.subtitle}>
                We'll text you a one-time code to sign in — no password needed.
              </Text>
              <TextInput
                style={styles.phoneInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 (555) 000-0000"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="phone-pad"
                autoFocus
              />
              <LunaraButton
                title="Send code"
                onPress={handleSendOtp}
                loading={loading}
                disabled={phone.trim().length < 8}
              />
            </Animated.View>
          ) : (
            <Animated.View style={styles.phoneSection}>
              <Text style={styles.title}>Enter the code</Text>
              <Text style={styles.subtitle}>We sent a code to {phone}</Text>
              <TextInput
                style={[styles.phoneInput, styles.otpInput]}
                value={otp}
                onChangeText={setOtp}
                placeholder="000000"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="number-pad"
                maxLength={8}
                autoFocus
              />
              <LunaraButton
                title="Verify & continue"
                onPress={handleVerifyOtp}
                loading={loading}
                disabled={otp.trim().length < 4}
              />
              <Pressable onPress={handleSendOtp} style={styles.resendBtn} disabled={loading}>
                <Text style={styles.resendText}>Resend code</Text>
              </Pressable>
            </Animated.View>
          )}
        </View>
      </LinearGradient>
    );
  }

  if (mode === 'email') {
    return (
      <LinearGradient colors={['#0A0817', '#141127', '#23203D']} style={styles.container}>
        <StarField />
        <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }]}>
          <Pressable onPress={() => setMode('choose')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#C0B8D4" />
          </Pressable>

          <Animated.View style={styles.phoneSection}>
            <Text style={styles.title}>{emailIsSignUp ? 'Create your account' : 'Welcome back'}</Text>
            <Text style={styles.subtitle}>
              {emailIsSignUp
                ? 'A place just for the two of you — set a password to keep it yours.'
                : 'Sign in with the email and password you set up before.'}
            </Text>

            {!!emailNotice && <Text style={styles.emailNotice}>{emailNotice}</Text>}

            <TextInput
              style={styles.phoneInput}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="rgba(255,255,255,0.25)"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            <TextInput
              style={styles.phoneInput}
              value={password}
              onChangeText={setPassword}
              placeholder="Password (6+ characters)"
              placeholderTextColor="rgba(255,255,255,0.25)"
              secureTextEntry
              autoCapitalize="none"
            />
            <LunaraButton
              title={emailIsSignUp ? 'Create account' : 'Sign in'}
              onPress={handleEmailSubmit}
              loading={loading}
              disabled={email.trim().length < 5 || password.length < 6}
            />
            <Pressable
              onPress={() => {
                setEmailIsSignUp((v) => !v);
                setEmailNotice('');
              }}
              style={styles.resendBtn}
              disabled={loading}
            >
              <Text style={styles.resendText}>
                {emailIsSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0A0817', '#141127', '#23203D']} style={styles.container}>
      <StarField />
      <View style={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
        <Animated.View style={styles.header}>
          <Text style={styles.title}>Welcome to Lunara</Text>
          <Text style={styles.subtitle}>Sign in to keep your Lunara memories safe and in sync</Text>
        </Animated.View>

        <Animated.View style={styles.authOptions}>
          {Platform.OS === 'ios' && (
            <Pressable style={styles.authButton} onPress={handleApple} disabled={loading}>
              <Ionicons name="logo-apple" size={22} color="#F5F2FB" />
              <Text style={styles.authButtonText}>Continue with Apple</Text>
            </Pressable>
          )}

          {googleAvailable && (
            <Pressable style={styles.authButton} onPress={handleGoogle} disabled={loading}>
              <Ionicons name="logo-google" size={20} color="#F5F2FB" />
              <Text style={styles.authButtonText}>Continue with Google</Text>
            </Pressable>
          )}

          <Pressable style={styles.authButton} onPress={() => setMode('phone')} disabled={loading}>
            <Ionicons name="call-outline" size={20} color="#F5F2FB" />
            <Text style={styles.authButtonText}>Continue with phone</Text>
          </Pressable>

          <Pressable style={styles.authButton} onPress={() => setMode('email')} disabled={loading}>
            <Ionicons name="mail-outline" size={20} color="#F5F2FB" />
            <Text style={styles.authButtonText}>Continue with email</Text>
          </Pressable>
        </Animated.View>

        <Animated.View style={styles.demoSection}>
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>
          <Pressable onPress={handleDemoSignIn} style={styles.demoBtn}>
            <Text style={styles.demoBtnText}>Try in demo mode</Text>
          </Pressable>
          <Text style={styles.demoNote}>
            Explore with a simulated partner — no account needed
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
  content: { flex: 1, paddingHorizontal: 26, gap: 28 },
  backBtn: { alignSelf: 'flex-start', padding: 4 },
  phoneSection: { flex: 1, gap: 16 },
  header: { gap: 8 },
  title: {
    fontSize: 28,
    fontFamily: 'Fraunces_600SemiBold',
    color: '#F5F2FB',
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#C0B8D4',
    lineHeight: 22,
  },
  authOptions: { gap: 12 },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1A1730',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  authButtonText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#F5F2FB',
  },
  phoneInput: {
    backgroundColor: '#121024',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 16,
    paddingHorizontal: 18,
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#F5F2FB',
    letterSpacing: 1,
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 28,
    letterSpacing: 8,
  },
  resendBtn: { alignItems: 'center', paddingVertical: 8 },
  resendText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: '#C0B8D4' },
  emailNotice: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#A8D8A8',
    lineHeight: 19,
    backgroundColor: 'rgba(168,216,168,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(168,216,168,0.2)',
    borderRadius: radius.sm,
    padding: 12,
  },
  demoSection: { gap: 10 },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#948BAC',
  },
  demoBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  demoBtnText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#C3B1E1',
  },
  demoNote: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#948BAC',
    textAlign: 'center',
  },
  legal: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#948BAC',
    textAlign: 'center',
    lineHeight: 16,
  },
  legalLink: {
    color: '#C0B8D4',
    textDecorationLine: 'underline',
  },
});
