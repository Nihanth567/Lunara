import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
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

const STEPS = [
  {
    icon: 'pencil-outline' as const,
    color: '#E8A0B4',
    title: 'Answer privately',
    body: 'Fill in your three cards — Grateful, Cute, Grow. Your partner won\'t see your answers until you both reveal.',
    example: 'e.g. "You made me laugh at the exact right moment today"',
  },
  {
    icon: 'time-outline' as const,
    color: '#CBB9C9',
    title: 'Wait for each other',
    body: 'Once you share your answers, you\'ll see when your partner has also shared theirs.',
    example: 'A gentle nudge can be sent if they forget',
  },
  {
    icon: 'sparkles-outline' as const,
    color: '#E8B98A',
    title: 'Reveal together',
    body: 'When you\'re both ready, tap Reveal — and see what your partner wrote just for you.',
    example: 'A quiet, beautiful moment every night',
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
    router.push('/(onboarding)/who-pays');
  };

  return (
    <LinearGradient colors={['#150F19', '#1B1421', '#150F19']} style={styles.container}>
      <StarField />
      <View style={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 28 }]}>

        {/* Progress. Left-aligned with everything else — a centred rail above a
            left-aligned page is the seam that made this screen look assembled
            rather than composed. */}
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotPast]} />
          ))}
        </View>

        <Animated.View key={step} style={styles.block}>
          <Text style={styles.eyebrow}>{`Step ${step + 1} of ${STEPS.length}`}</Text>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.body}>{current.body}</Text>

          {/* A quote, set against a rule rather than boxed. Three stacked
              rounded rectangles of near-identical weight is what made the old
              version read as a template. */}
          <View style={styles.quote}>
            <Text style={styles.quoteText}>{current.example}</Text>
          </View>
        </Animated.View>

        {isLast && couple?.isDemoMode && (
          <Animated.View style={styles.rule}>
            <Text style={styles.ruleTitle}>Luna is waiting for you</Text>
            <Text style={styles.ruleBody}>She has already shared her thoughts for tonight.</Text>
          </Animated.View>
        )}

        {/* The trigger half of the habit loop. A section, not a card. */}
        {isLast && (
          <Animated.View style={styles.rule}>
            <Text style={styles.ruleTitle}>A gentle nudge each night</Text>
            <Text style={styles.ruleBody}>
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
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => pickTime(hour, minute)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
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
              hitSlop={8}
            >
              <Text style={styles.skip}>
                {notificationSettings.enabled ? 'No reminder, thanks' : 'Reminders are off'}
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Pushed down by margin rather than by `space-between`, so the content
            above stays anchored to the top instead of floating in the slack. */}
        <View style={styles.footer}>
          <LunaraButton title={isLast ? "Let's begin" : 'Next'} onPress={handleNext} loading={busy} />
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /*
   * Was `justifyContent: 'space-between'` with `alignItems: 'center'` over five
   * children. On the last step that distributed the slack *between* the blocks,
   * which is what opened ~390pt of void above the title while the content below
   * it stayed cramped. Content now stacks from the top on a fixed rhythm and
   * the footer is pushed down on its own.
   */
  content: {
    flex: 1,
    paddingHorizontal: 26,
    gap: 22,
  },

  dots: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(248, 241, 246,0.14)',
  },
  dotActive: { backgroundColor: '#E8A0B4', width: 18 },
  dotPast: { backgroundColor: 'rgba(232, 160, 180,0.35)' },

  block: { gap: 14 },
  eyebrow: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#A492A6',
  },
  title: {
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.8,
    fontFamily: 'Fraunces_600SemiBold',
    color: '#F8F1F6',
  },
  body: {
    fontSize: 16,
    lineHeight: 25,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#CBB9C9',
    maxWidth: 340,
  },

  /* A rule and an indent. No fill, no border box, no radius. */
  quote: {
    borderLeftWidth: 1,
    borderLeftColor: '#42304A',
    paddingLeft: 14,
    marginTop: 2,
  },
  quoteText: {
    fontSize: 16,
    lineHeight: 26,
    fontFamily: 'Fraunces_400Regular',
    color: '#CBB9C9',
  },

  /* Sections divide with a hairline instead of floating as tinted cards. */
  rule: {
    gap: 8,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#42304A',
  },
  ruleTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#F8F1F6',
  },
  ruleBody: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#A492A6',
  },

  reminderRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  chip: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#42304A',
    alignItems: 'center',
  },
  /* Selection reads through the one accent, not a second hue. */
  chipActive: {
    borderColor: '#E8A0B4',
    backgroundColor: 'rgba(232, 160, 180,0.10)',
  },
  chipText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#CBB9C9',
  },
  chipTextActive: { color: '#F8F1F6' },
  skip: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#A492A6',
    paddingTop: 2,
  },

  footer: { marginTop: 'auto', paddingTop: 8 },
});
