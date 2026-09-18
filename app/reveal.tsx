import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Dimensions,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StarField } from '@/components/StarField';
import { MilestoneBanner } from '@/components/MilestoneBanner';
import { GrowGuidance } from '@/components/GrowGuidance';
import { ConfettiBurst } from '@/components/ConfettiBurst';
import { CoupleCompanion } from '@/components/CoupleCompanion';
import { VoiceNotePlayer } from '@/components/VoiceNotePlayer';
import { NotSignedInError, useApp } from '@/context/AppContext';
import { useGrowCheckBack } from '@/hooks/useGrowCheckBack';
import { isPro } from '@/lib/entitlements';
import { partnerLabel } from '@/lib/partner';
import { REACTIONS } from '@/lib/reactions';
import { radius, space, elevation, duration, touchTarget } from '@/constants/tokens';
import { gradients, glow, palette, tint } from '@/constants/colors';
import { type as text, maxFontScale } from '@/constants/typography';

const { width } = Dimensions.get('window');

// ─── The lights coming up ─────────────────────────────────────────────────────

/**
 * The warm wash that fades in behind the whole reveal.
 *
 * ─── Why this and not a bigger animation ─────────────────────────────────────
 *
 * The brief for this moment is "short lights-up, not a long cinematic". The
 * temptation on a payoff screen is a sequence — a curtain, a shimmer, a
 * particle field — and every one of those is something the couple has to wait
 * out before they can read what their partner wrote. That is exactly backwards:
 * the words are the reward, the animation is the frame.
 *
 * So it is one property (opacity) on one layer, over `duration.reveal`. Nothing
 * blocks, nothing sequences, and the cards underneath start their own stagger
 * immediately. What it buys is the impression that the room got warmer when the
 * screen opened — which is the feeling — for one interpolated value.
 *
 * Reduce Motion gets the end state immediately rather than losing the warmth:
 * the wash is colour, not movement, and removing it would change what the
 * screen *means* rather than how it arrives.
 */
function WarmWash() {
  const reduceMotion = useReducedMotion();
  const lit = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    lit.value = withTiming(1, { duration: duration.reveal });
  }, [lit, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: lit.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <LinearGradient
        colors={gradients.foxHalo}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0.1 }}
        end={{ x: 0.5, y: 0.85 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// ─── Animated reveal card ─────────────────────────────────────────────────────

interface RevealCardProps {
  label: string;
  text: string;
  owner: 'me' | 'partner';
  accentColor: string;
  delay?: number;
  myName?: string;
  partnerName?: string;
  /** Voice note attached to this card, if there is one. */
  voice?: string | null;
}

function RevealCard({ label, text, owner, accentColor, delay = 0, myName, partnerName, voice }: RevealCardProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(24);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 600 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 18, stiffness: 120 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const displayName = owner === 'me' ? (myName || 'You') : (partnerName || 'Partner');

  return (
    <Animated.View style={[styles.revealCard, style]}>
      <View style={[styles.cardStripe, { backgroundColor: accentColor }]} />
      <View style={styles.cardContent}>
        <Text
          style={[
            styles.cardOwner,
            owner === 'partner' && { color: accentColor },
          ]}
        >
          {displayName}
        </Text>
        <Text style={styles.cardText}>{text}</Text>
        {voice ? (
          <View style={styles.cardVoice}>
            <VoiceNotePlayer source={voice} color={accentColor} label="In their voice" compact />
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

/**
 * One prompt, both answers. The partner's card comes first on purpose: you
 * already know what you wrote, so leading with their words makes the reveal a
 * gift rather than a summary of your own evening.
 */
function RevealPair({
  label,
  accentColor,
  mine,
  theirs,
  myVoice,
  theirVoice,
  baseDelay,
  myName,
  partnerName,
  children,
}: {
  label: string;
  accentColor: string;
  mine: string;
  theirs: string;
  myVoice?: string | null;
  theirVoice?: string | null;
  baseDelay: number;
  myName: string;
  partnerName: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.cardPair}>
      <View style={styles.pairLabel}>
        <View style={[styles.pairDot, { backgroundColor: accentColor }]} />
        <Text style={[styles.pairTitle, { color: accentColor }]}>{label}</Text>
      </View>
      {theirs ? (
        <RevealCard
          label={label}
          text={theirs}
          voice={theirVoice}
          owner="partner"
          accentColor={accentColor}
          delay={baseDelay}
          myName={myName}
          partnerName={partnerName}
        />
      ) : null}
      <RevealCard
        label={label}
        text={mine}
        voice={myVoice}
        owner="me"
        accentColor={accentColor}
        delay={baseDelay + 300}
        myName={myName}
        partnerName={partnerName}
      />
      {children}
    </View>
  );
}

// ─── Reaction button ──────────────────────────────────────────────────────────

// ─── Main reveal screen ───────────────────────────────────────────────────────

export default function RevealScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { todayEntry, couple, user, entries, setMyReaction, checkMilestone } = useApp();
  const [milestone, setMilestone] = React.useState<number | null>(null);
  const [confetti, setConfetti] = React.useState(0);
  const { markGuidanceSeen } = useGrowCheckBack(entries);

  const streak = couple?.currentStreak ?? 0;

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const bottomPad = insets.bottom + 24 + (Platform.OS === 'web' ? 34 : 0);

  const partnerName = partnerLabel(couple, 'Partner');
  const myName = user?.name ?? 'You';

  useEffect(() => {
    // The reveal is paced rather than instant: a soft tap as the first cards
    // rise, then the warmer confirmation once both sides are on screen. The
    // timings line up with the card stagger below.
    const timers = [
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 250),
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 900),
      setTimeout(() => setConfetti((c) => c + 1), 950),
    ];
    checkMilestone().then(setMilestone).catch(() => {});
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!todayEntry) {
    return (
      <LinearGradient colors={gradients.screen} style={styles.container}>
        <View style={styles.noEntry}>
          <Ionicons name="moon-outline" size={26} color={palette.content[1]} />
          <Text style={styles.noEntryText}>Nothing to open here yet tonight</Text>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="arrow-back" size={20} color="#C9BDB0" />
            <Text style={styles.closeBtnText}>Go back</Text>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={gradients.reveal}
      locations={gradients.revealLocations}
      style={styles.container}
    >
      <StarField />
      {/*
        The lights coming up. A warm apricot wash that fades in over the night
        ground across `duration.reveal` — the one transition in the app allowed
        to exceed the responsive band, because it is the payoff rather than a
        state change. Absolutely positioned and non-interactive, so it costs the
        scroll view nothing.
      */}
      <WarmWash />

      {/* Close button */}
      <Pressable
        style={[styles.closeButton, { top: topPad + 12 }]}
        onPress={() => router.back()}
      >
        <Ionicons name="close" size={22} color="#C9BDB0" />
      </Pressable>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 60, paddingBottom: bottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
          <Animated.View style={styles.titleSection}>
          {/*
            Replaces a static moon glyph. This is the payoff screen, so it gets
            the companion at hero size in its brightest state — the one visual
            in the app that is different tonight because of something the two of
            them did tonight.
          */}
          <CoupleCompanion state="glowing" streak={streak} size="hero" />
          <Text style={styles.title}>Both of you showed up</Text>
          <Text style={styles.subtitle}>
            Everything you each kept sealed tonight, open at the same time
          </Text>
          {streak > 0 && (
            <View style={styles.streakChip}>
              <Ionicons name="flame" size={12} color={palette.accent.streak} />
              <Text style={styles.streakChipText}>Day {streak} together</Text>
            </View>
          )}
          <ConfettiBurst trigger={confetti} />
        </Animated.View>

        {milestone && <MilestoneBanner milestone={milestone} />}

        <RevealPair
          label="Grateful"
          accentColor={palette.accent.heart}
          mine={todayEntry.grateful}
          theirs={todayEntry.partnerGrateful}
          myVoice={todayEntry.voiceGrateful}
          theirVoice={todayEntry.partnerVoiceGrateful}
          baseDelay={200}
          myName={myName}
          partnerName={partnerName}
        />

        <RevealPair
          label="Cute"
          accentColor={palette.accent.moon}
          mine={todayEntry.cute}
          theirs={todayEntry.partnerCute}
          myVoice={todayEntry.voiceCute}
          theirVoice={todayEntry.partnerVoiceCute}
          baseDelay={700}
          myName={myName}
          partnerName={partnerName}
        />

        <RevealPair
          label="Grow"
          accentColor={palette.accent.success}
          mine={todayEntry.grow}
          theirs={todayEntry.partnerGrow}
          myVoice={todayEntry.voiceGrow}
          theirVoice={todayEntry.partnerVoiceGrow}
          baseDelay={1200}
          myName={myName}
          partnerName={partnerName}
        >
          {todayEntry.partnerGrow ? (
            isPro(couple) ? (
              <GrowGuidance
                growTexts={[todayEntry.grow, todayEntry.partnerGrow]}
                onShown={() => markGuidanceSeen(todayEntry.date)}
              />
            ) : (
              <Pressable style={styles.aiLockedCard} onPress={() => router.push('/(modals)/paywall')}>
                <View style={styles.aiLockedIcon}>
                  <Ionicons name="sparkles" size={16} color="#FFB86B" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.aiLockedTitle}>A gentle way forward</Text>
                  <Text style={styles.aiLockedBody}>Premium turns tonight&apos;s Grow notes into one small idea</Text>
                </View>
                <Ionicons name="lock-closed" size={16} color="#9A9084" />
              </Pressable>
            )
          ) : null}
        </RevealPair>

        {/* Reactions */}
        <Animated.View style={styles.reactions}>
          <Text style={styles.reactionsLabel}>How did that land?</Text>
          <View style={styles.reactionRow}>
            {REACTIONS.map((r) => (
              <Pressable
                key={r.label}
                style={[
                  styles.reactionBtn,
                  todayEntry.myReaction === r.label && {
                    borderColor: r.color + '70',
                    backgroundColor: r.color + '18',
                  },
                ]}
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  // `setMyReaction` throws now (an expired session, a failed
                  // write) where it used to return quietly. Unhandled, that is
                  // a rejection with no UI; caught, it is a sentence. The
                  // reaction is the softest thing on this screen, so a failure
                  // says so gently and doesn't drag anyone off the reveal.
                  try {
                    await setMyReaction(r.label);
                  } catch (error) {
                    Alert.alert(
                      'That didn’t save',
                      error instanceof NotSignedInError
                        ? 'Your session ended. Sign in again and you can leave it then.'
                        : 'We couldn’t save your reaction just now — tonight itself is safe. Try again in a moment.',
                    );
                  }
                }}
              >
                <Ionicons name={r.icon as any} size={22} color={r.color} />
                <Text style={[styles.reactionLabel, { color: r.color }]}>{r.label}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Closing — the afterglow, then the way out */}
        <View style={styles.backSection}>
          <Text style={styles.afterglowText}>
            {streak > 1
              ? `Day ${streak} together. Your fox is lit till morning.`
              : `${partnerName} is on the other side of tonight. Sleep well.`}
          </Text>
          <Pressable style={styles.doneBtn} onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.doneBtnText}>Close this moment</Text>
          </Pressable>
          <Text style={styles.seeYouText}>Three new ones tomorrow night.</Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Locked Grow guidance ──────────────────────────────────────────────────
  aiLockedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: tint.glow(0.18),
    padding: space.lg,
  },
  aiLockedIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    backgroundColor: tint.glow(0.12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiLockedTitle: { ...text.caption, color: palette.content[0] },
  aiLockedBody: { ...text.caption, color: palette.content[2] },

  closeButton: {
    position: 'absolute',
    right: space.xl,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: tint.cream(0.08),
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { paddingHorizontal: space.xl },

  // ── Title ─────────────────────────────────────────────────────────────────
  titleSection: { alignItems: 'center', marginBottom: space.xxl, gap: space.sm + 2 },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.xxs,
    paddingVertical: 6,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: tint.streak(0.26),
    backgroundColor: tint.streak(0.12),
  },
  streakChipText: { ...text.caption, color: palette.accent.streak },
  title: { ...text.hero, color: palette.content[0], textAlign: 'center' },
  subtitle: {
    ...text.callout,
    color: palette.content[1],
    textAlign: 'center',
    paddingHorizontal: space.md,
  },

  // ── One prompt, both answers ──────────────────────────────────────────────
  cardPair: { gap: space.sm + 2, marginBottom: space.xl },
  pairLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: space.xxs,
  },
  pairDot: { width: 7, height: 7, borderRadius: radius.full },
  pairTitle: { ...text.overline, textTransform: 'uppercase' },

  /**
   * A reveal card is a gift, not a form result.
   *
   * Three things carry that, and none of them is an illustration: the surface
   * is *raised* rather than outlined (a hairline box is a field, a lifted one is
   * an object); the corners are the widest on the ramp; and the words inside are
   * set in the serif at reading size. What their partner wrote should not be
   * typeset like a settings row, which is what 14px Plus Jakarta made it.
   */
  revealCard: {
    flexDirection: 'row',
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 0,
    overflow: 'hidden',
    ...elevation.raised,
  },
  cardStripe: { width: 4, flexShrink: 0 },
  cardContent: { flex: 1, paddingVertical: space.lg + 2, paddingHorizontal: space.lg, gap: space.sm },
  cardOwner: { ...text.overline, color: palette.content[2], textTransform: 'uppercase' },
  cardText: { ...text.prose, color: palette.content[0] },
  cardVoice: { marginTop: 6 },

  // ── Reactions ─────────────────────────────────────────────────────────────
  // Big, round and few. A reaction row that looks like a toolbar gets used like
  // one; this one is meant to feel like reaching over and squeezing a hand.
  reactions: { marginTop: space.sm, marginBottom: space.xl, gap: space.lg, alignItems: 'center' },
  reactionsLabel: { ...text.callout, color: palette.content[1], textAlign: 'center' },
  reactionRow: {
    flexDirection: 'row',
    gap: space.md,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  reactionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.lg,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: tint.cream(0.09),
    backgroundColor: tint.cream(0.04),
    minWidth: 92,
    minHeight: 84,
  },
  reactionLabel: { ...text.caption },

  // ── Afterglow ─────────────────────────────────────────────────────────────
  backSection: { alignItems: 'center', marginBottom: space.lg, gap: space.md + 2 },
  afterglowText: {
    ...text.prose,
    color: palette.content[1],
    textAlign: 'center',
    paddingHorizontal: space.sm,
  },
  doneBtn: {
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingVertical: space.md + 2,
    paddingHorizontal: space.xxl,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: tint.cream(0.14),
  },
  doneBtnText: { ...text.label, color: palette.content[0] },
  seeYouText: { ...text.caption, color: palette.content[2], textAlign: 'center' },

  noEntry: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: space.lg },
  noEntryText: { ...text.body, color: palette.content[1] },
  closeBtn: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  closeBtnText: { ...text.callout, color: palette.content[1] },
});
