import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';
import { useApp } from '@/context/AppContext';
import { proFeatureSummary } from '@/lib/entitlements';
import { requestNotificationPermissions, getNotificationPermissionStatus } from '@/services/notifications';
import { radius } from '@/constants/tokens';

const { width } = Dimensions.get('window');
const PHONE_WIDTH = Math.min(width - 96, 240);
const PHONE_HEIGHT = PHONE_WIDTH * 2.05;

/** Mirrors the pre-ask used at the end of the tutorial step this screen replaced. */
async function maybeAskForNotifications(onGranted: () => Promise<void>): Promise<void> {
  if (Platform.OS === 'web') return;
  const status = await getNotificationPermissionStatus();
  if (status !== 'undetermined') return;
  await new Promise<void>((resolve) => {
    Alert.alert(
      'One quiet reminder a night?',
      'If the night is slipping by and you haven’t shared with your partner yet, we’ll send one gentle nudge — never more than that.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve() },
        {
          text: 'Sounds good',
          onPress: async () => {
            const granted = await requestNotificationPermissions().catch(() => false);
            // A grant with no token stored is a permission nobody can use — the
            // remote pushes address a device, not an account.
            if (granted) await onGranted().catch(() => {});
            resolve();
          },
        },
      ],
    );
  });
}

function PhonePreview() {
  const float = useSharedValue(0);
  const glow = useSharedValue(0.35);

  useEffect(() => {
    float.value = withRepeat(
      withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    glow.value = withDelay(
      200,
      withRepeat(
        withTiming(0.6, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [float, glow]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 + float.value * 12 }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }));

  return (
    <View style={styles.phoneWrap}>
      <Animated.View style={[styles.phoneGlow, glowStyle]} />
      <Animated.View style={[styles.phoneFrame, floatStyle]}>
        <Image
          source={require('../../assets/images/ob-benefits.jpg')}
          style={styles.phoneScreen}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['rgba(15,12,41,0.55)', 'transparent', 'rgba(15,12,41,0.75)']}
          locations={[0, 0.35, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.notch} />
        <Text style={styles.lockTime}>9:41</Text>

        <Animated.View entering={FadeIn.delay(400).duration(600)} style={styles.widgetCard}>
          <View style={styles.widgetHeader}>
            <View style={styles.widgetIcon}>
              <Ionicons name="moon" size={11} color="#F5F2FB" />
            </View>
            <Text style={styles.widgetLabel}>Lunara</Text>
          </View>
          <Text style={styles.widgetMessage}>
            Thinking of you during my morning study break ☕️❤️
          </Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

export default function ProPreviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completeOnboarding, couple, registerPushToken } = useApp();
  const [loading, setLoading] = useState(false);

  const enterApp = () => {
    router.replace('/(app)/' as never);
    if (couple) {
      router.push('/keepsakes?intro=1' as never);
    }
  };

  const handleContinue = async () => {
    setLoading(true);
    await maybeAskForNotifications(registerPushToken);
    await completeOnboarding();
    setLoading(false);
    router.push({ pathname: '/(modals)/paywall', params: { source: 'onboarding' } } as never);
  };

  const handleSkip = async () => {
    await maybeAskForNotifications(registerPushToken);
    await completeOnboarding();
    enterApp();
  };

  return (
    <LinearGradient colors={['#0A0817', '#141127', '#221D40', '#0A0817']} style={styles.container}>
      <StarField />
      <View style={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}>
        <PhonePreview />

        <Animated.View entering={FadeIn.delay(200).duration(500)} style={styles.copy}>
          <Text style={styles.title}>Feel close, even when you're apart.</Text>
          <Text style={styles.subtitle}>
            Lunara Pro keeps every night you&apos;ve shared, in both your hands.{' '}
            {proFeatureSummary()} One subscription, for the two of you.
          </Text>
        </Animated.View>

        <View style={styles.footer}>
          <LunaraButton title="Continue to Lunara Pro" onPress={handleContinue} loading={loading} />
          <Text style={styles.covers}>1 Subscription Covers Both of You</Text>
          <LunaraButton title="Maybe later" variant="ghost" onPress={handleSkip} disabled={loading} />
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phoneWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  phoneGlow: {
    position: 'absolute',
    width: PHONE_WIDTH * 1.3,
    height: PHONE_WIDTH * 1.3,
    borderRadius: PHONE_WIDTH,
    backgroundColor: '#FF9A8B',
    opacity: 0.35,
    // Soft radial-style glow behind the phone frame.
    shadowColor: '#FF9A8B',
    shadowRadius: 60,
    shadowOpacity: 1,
  },
  phoneFrame: {
    width: PHONE_WIDTH,
    height: PHONE_HEIGHT,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: '#0A0817',
  },
  phoneScreen: { ...StyleSheet.absoluteFillObject },
  notch: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    width: PHONE_WIDTH * 0.32,
    height: 18,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  lockTime: {
    position: 'absolute',
    top: 38,
    alignSelf: 'center',
    fontSize: 28,
    fontFamily: 'Fraunces_600SemiBold',
    color: '#FFFFFF',
  },
  widgetCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 22,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: 10,
    backgroundColor: 'rgba(20,16,40,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    gap: 5,
  },
  widgetHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  widgetIcon: {
    width: 16,
    height: 16,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,154,139,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  widgetLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#F5F2FB',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  widgetMessage: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#F5F2FB',
    lineHeight: 17,
  },
  copy: { alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  title: {
    fontSize: 28,
    fontFamily: 'Fraunces_600SemiBold',
    color: '#F5F2FB',
    textAlign: 'center',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#C0B8D4',
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: { width: '100%', gap: 10, alignItems: 'center' },
  covers: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#C3B1E1',
    textAlign: 'center',
  },
});
