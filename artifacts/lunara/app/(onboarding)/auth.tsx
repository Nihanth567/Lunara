import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';
import { useApp } from '@/context/AppContext';

type AuthMode = 'choose' | 'phone';

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useApp();
  const [mode, setMode] = useState<AuthMode>('choose');
  const [phone, setPhone] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerifyOtp = async () => {
    if (phone.length < 8 || backupCode.length < 6) return;
    setLoading(true);
    try {
      const restored = await signIn(phone, backupCode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (restored) {
        router.replace('/(app)/' as never);
      } else {
        router.replace('/(onboarding)/profile-setup');
      }
    } catch (error) {
      Alert.alert(
        'Could not sign in',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = () => {
    // Skip auth entirely — go straight to profile setup
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(onboarding)/profile-setup');
  };

  if (mode === 'phone') {
    return (
      <LinearGradient colors={['#0F0C29', '#1A1635', '#24243E']} style={styles.container}>
        <StarField />
        <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }]}>
          <Pressable onPress={() => setMode('choose')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#9B89C2" />
          </Pressable>

          <Animated.View style={styles.phoneSection}>
            <Text style={styles.title}>Restore your memories</Text>
            <Text style={styles.subtitle}>
              Sign in with the phone number and private backup code you chose when setting up Lunara.
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
            <TextInput
              style={styles.phoneInput}
              value={backupCode}
              onChangeText={setBackupCode}
              placeholder="Private backup code"
              placeholderTextColor="rgba(255,255,255,0.25)"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={64}
            />

            <LunaraButton
              title="Restore account"
              onPress={handleVerifyOtp}
              loading={loading}
              disabled={phone.length < 8 || backupCode.length < 6}
            />
          </Animated.View>
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
          {/* Apple Sign In */}
          <Pressable
            style={styles.authButton}
            onPress={() => router.push('/(onboarding)/profile-setup')}
          >
            <Ionicons name="logo-apple" size={22} color="#F8F5FF" />
            <Text style={styles.authButtonText}>Continue with Apple</Text>
          </Pressable>

          {/* Google Sign In */}
          <Pressable
            style={styles.authButton}
            onPress={() => router.push('/(onboarding)/profile-setup')}
          >
            <Ionicons name="logo-google" size={20} color="#F8F5FF" />
            <Text style={styles.authButtonText}>Continue with Google</Text>
          </Pressable>

          {/* Phone */}
          <Pressable style={styles.authButton} onPress={() => setMode('phone')}>
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
