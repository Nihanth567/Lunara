import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';
import { useApp } from '@/context/AppContext';
import { radius } from '@/constants/tokens';
import {
  requestNotificationPermissions,
  formatReminderTime,
} from '@/services/notifications';

const { width } = Dimensions.get('window');

const STEPS = [
  {
    icon: 'pencil-outline' as const,
    color: '#FF9A8B',
    title: 'Answer privately',
    body: 'Fill in your three cards — Grateful, Cute, Grow. Your partner won\'t see your answers until you both reveal.',
    example: 'e.g. "You made me laugh at the exact right moment today"',
    image: require('../../assets/images/tutorial-1.jpg'),
  },
  {
    icon: 'time-outline' as const,
    color: '#C3B1E1',
    title: 'Wait for each other',
    body: 'Once you share your answers, you\'ll see when your partner has also shared theirs.',
    example: 'A gentle nudge can be sent if they forget',
    image: require('../../assets/images/tutorial-2.jpg'),
  },
  {
    icon: 'sparkles-outline' as const,
    color: '#F0C07A',
    title: 'Reveal together',
    body: 'When you\'re both ready, tap Reveal — and see what your partner wrote just for you.',
    example: 'A quiet, beautiful moment every night',
    image: require('../../assets/images/tutorial-3.jpg'),
  },
];

/** The hours a nightly ritual actually happens. Three choices, not nine. */
const REMINDER_CHOICES = [
  { hour: 20, minute: 0 },
  { hour: 21, minute: 0 },
  { hour: 22, minute: 0 },
];

export default function TutorialScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { couple, notificationSettings, setNotificationSettings, registerPushToken } = useApp();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  /**
   * The reminder time is asked for here rather than left in settings, because a
   * nightly ritual with no nightly trigger is a ritual people forget by day 3.
   * It's one tap on a row that's already correct by default — picking a time is
   * optional, and so is the permission itself.
   */
  const pickTime = async (hour: number, minute: number) => {
    Haptics.selectionAsync();
    await setNotificationSettings({
      ...notificationSettings,
      enabled: true,
      reminderHour: hour,
      reminderMinute: minute,
    }).catch(() => {});
  };

  const handleNext = async () => {
    if (!isLast) {
      Haptics.selectionAsync();
      setStep((s) => s + 1);
      return;
    }
    // Ask for the permission at the moment its value is obvious, not at launch.
    setBusy(true);
    if (notificationSettings.enabled) {
      const granted = await requestNotificationPermissions().catch(() => false);
      // iOS drops anything scheduled before authorisation and never redelivers
      // it, so the reminders have to be laid down *after* the grant — not when
      // the time chip was tapped.
      await setNotificationSettings({ ...notificationSettings, enabled: granted }).catch(() => {});
      // The grant is also what makes the two *remote* pushes deliverable, and
      // those need a token on the profile row, not just a local schedule.
      if (granted) await registerPushToken().catch(() => {});
    }
    setBusy(false);
    router.push('/(onboarding)/pro-preview');
  };

  return (
    <LinearGradient colors={['#0A0817', '#141127', '#221D40', '#0A0817']} style={styles.container}>
      <StarField />
      <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 44 }]}>

        {/* Step dots */}
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === step && styles.dotActive,
                i < step && styles.dotPast,
              ]}
            />
          ))}
        </View>

        {/* Main card */}
         <Animated.View key={step} style={styles.card}>
           <View style={styles.stepImageFrame}>
             <Image
               source={current.image}
               style={styles.stepImage}
               resizeMode="cover"
             />
           </View>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.body}>{current.body}</Text>
          <View style={styles.exampleBubble}>
            <Text style={styles.exampleText}>{current.example}</Text>
          </View>
        </Animated.View>

        {/* Partner greeting for demo mode */}
        {isLast && couple?.isDemoMode && (
           <Animated.View style={styles.demoGreeting}>
             <View>
              <Ionicons name="moon" size={20} color="#C3B1E1" />
            </View>
            <View style={styles.demoText}>
              <Text style={styles.demoName}>Luna is waiting for you</Text>
              <Text style={styles.demoSub}>She has already shared her thoughts for tonight</Text>
            </View>
          </Animated.View>
        )}

        {/* Nightly reminder — the trigger half of the habit loop */}
        {isLast && (
          <Animated.View style={styles.reminderCard}>
            <View style={styles.reminderHeader}>
              <Ionicons name="moon-outline" size={16} color="#C3B1E1" />
              <Text style={styles.reminderTitle}>A gentle nudge each night</Text>
            </View>
            {/*
              The priming, and it has to come before the OS dialog rather than
              after it. Lunara sends three things and only three, and two of
              them are the other person — a prompt that arrives cold reads as
              "this app wants to interrupt you", which on iOS is a decision
              nobody can take back from inside the app.
            */}
            <Text style={styles.reminderWhy}>
              Three things, and nothing else: this nightly reminder, a note when
              your partner has shared theirs, and the moment you&apos;re both
              ready to reveal.
            </Text>
            <View style={styles.reminderRow}>
              {REMINDER_CHOICES.map(({ hour, minute }) => {
                const active =
                  notificationSettings.enabled &&
                  notificationSettings.reminderHour === hour &&
                  notificationSettings.reminderMinute === minute;
                return (
                  <Pressable
                    key={`${hour}:${minute}`}
                    style={[styles.reminderChip, active && styles.reminderChipActive]}
                    onPress={() => pickTime(hour, minute)}
                  >
                    <Text style={[styles.reminderChipText, active && styles.reminderChipTextActive]}>
                      {formatReminderTime(hour, minute)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() =>
                setNotificationSettings({ ...notificationSettings, enabled: false }).catch(() => {})
              }
            >
              <Text style={styles.reminderSkip}>
                {notificationSettings.enabled ? 'No reminder, thanks' : 'Reminders are off'}
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Button */}
        <View style={styles.footer}>
          <LunaraButton
            title={isLast ? "Let's begin" : 'Next'}
            onPress={handleNext}
            loading={busy}
          />
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  reminderWhy: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#C0B8D4',
    lineHeight: 19,
  },
  reminderCard: {
    width: '100%',
    gap: 10,
    backgroundColor: '#1A1730',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: 16,
    marginBottom: 4,
  },
  reminderHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  reminderTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#F5F2FB',
  },
  reminderRow: { flexDirection: 'row', gap: 8 },
  reminderChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
  },
  reminderChipActive: {
    borderColor: 'rgba(195,177,225,0.55)',
    backgroundColor: 'rgba(195,177,225,0.14)',
  },
  reminderChipText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#C0B8D4',
  },
  reminderChipTextActive: { color: '#F5F2FB' },
  reminderSkip: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#948BAC',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dotActive: { backgroundColor: '#FF9A8B', width: 24 },
  dotPast: { backgroundColor: 'rgba(255,154,139,0.4)' },
  card: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 8,
  },
  stepImageFrame: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  stepImage: { width: '100%', height: '100%' },
  title: {
    fontSize: 28,
    fontFamily: 'Fraunces_600SemiBold',
    color: '#F5F2FB',
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#C0B8D4',
    textAlign: 'center',
    lineHeight: 26,
  },
  exampleBubble: {
     backgroundColor: '#1A1730',
     borderRadius: radius.lg,
     borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  exampleText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#C3B1E1',
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  demoGreeting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(195,177,225,0.1)',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(195,177,225,0.2)',
    padding: 16,
    marginBottom: 8,
    width: '100%',
  },
  demoText: { flex: 1, gap: 2 },
  demoName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#F5F2FB',
  },
  demoSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#C0B8D4',
  },
  footer: { width: '100%' },
});
