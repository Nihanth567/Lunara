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
import { useApp } from '@/context/AppContext';

type AuthMode = 'choose' | 'phone' | 'phone-otp';

function afterSignIn(router: ReturnType<typeof useRouter>, name: string) {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  if (name) {
    router.replace('/(onboarding)/pairing');
  } else {
    router.replace('/(onboarding)/profile-setup');
  }
}

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithApple, signInWithGoogle, sendPhoneOtp, verifyPhoneOtp, refreshSharedState } = useApp();
  const [mode, setMode] = useState<AuthMode>('choose');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleApple = async () => {
    setLoading(true);
    try {
      await signInWithApple();
      await refreshSharedState();
      afterSignIn(router, '');
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
      await refreshSharedState();
      afterSignIn(router, '');
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
      await refreshSharedState();
      afterSignIn(router, '');
    } catch (error: any) {
      Alert.alert('Could not verify code', error?.message ?? 'Please check the code and try again.');
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
      <LinearGradient colors={['#0F0C29', '#1A1635', '#24243E']} style={styles.container}>
        <StarField />
        <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }]}>
          <Pressable
            onPress={() => setMode(mode === 'phone-otp' ? 'phone' : 'choose')}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color="#9B89C2" />
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

  return (
    <LinearGradient colors={['#0F0C29', '#1A1635', '#24243E']} style={styles.container}>
      <StarField />
      <View style={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
        <Animated.View style={styles.header}>
          <Text style={styles.title}>Welcome to Lunara</Text>
          <Text style={styles.subtitle}>Sign in to keep your Lunara memories safe and in sync</Text>
        </Animated.View>

        <Animated.View style={styles.authOptions}>
          {Platform.OS === 'ios' && (
            <Pressable style={styles.authButton} onPress={handleApple} disabled={loading}>
              <Ionicons name="logo-apple" size={22} color="#F8F5FF" />
              <Text style={styles.authButtonText}>Continue with Apple</Text>
            </Pressable>
          )}

          <Pressable style={styles.authButton} onPress={handleGoogle} disabled={loading}>
            <Ionicons name="logo-google" size={20} color="#F8F5FF" />
            <Text style={styles.authButtonText}>Continue with Google</Text>
          </Pressable>

          <Pressable style={styles.authButton} onPress={() => setMode('phone')} disabled={loading}>
            <Ionicons name="call-outline" size={20} color="#F8F5FF" />
            <Text style={styles.authButtonText}>Continue with phone</Text>
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
            By continuing, you agree to our Terms of Service and Privacy Policy.
            We take your privacy seriously — especially for users under 18.
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
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    color: '#F8F5FF',
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
    lineHeight: 22,
  },
  authOptions: { gap: 12 },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1E1B3A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  authButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: '#F8F5FF',
  },
  phoneInput: {
    backgroundColor: '#181532',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 16,
    paddingHorizontal: 18,
    fontSize: 18,
    fontFamily: 'Inter_400Regular',
    color: '#F8F5FF',
    letterSpacing: 1,
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 28,
    letterSpacing: 8,
  },
  resendBtn: { alignItems: 'center', paddingVertical: 8 },
  resendText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#9B89C2' },
  demoSection: { gap: 10 },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#7A6D98',
  },
  demoBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  demoBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: '#C3B1E1',
  },
  demoNote: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#7A6D98',
    textAlign: 'center',
  },
  legal: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#7A6D98',
    textAlign: 'center',
    lineHeight: 16,
  },
});
