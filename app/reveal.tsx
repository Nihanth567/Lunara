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
import { radius } from '@/constants/tokens';

const { width } = Dimensions.get('window');

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

const REACTIONS = [
  { icon: 'heart', label: 'Love', color: '#FF9A8B' },
  { icon: 'hand-right-outline', label: 'Hug', color: '#C3B1E1' },
  { icon: 'sunny-outline', label: 'Warm', color: '#F0C07A' },
  { icon: 'star-outline', label: 'Star', color: '#A8D8A8' },
] as const;

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
      <LinearGradient colors={['#0A0817', '#221D40']} style={styles.container}>
        <View style={styles.noEntry}>
          <Ionicons name="moon-outline" size={26} color="#C0B8D4" />
          <Text style={styles.noEntryText}>There's nothing to reveal here yet tonight</Text>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="arrow-back" size={20} color="#C0B8D4" />
            <Text style={styles.closeBtnText}>Go back</Text>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#0A0817', '#141127', '#221D40', '#23203D']}
      locations={[0, 0.3, 0.6, 1]}
      style={styles.container}
    >
      <StarField />

      {/* Close button */}
      <Pressable
        style={[styles.closeButton, { top: topPad + 12 }]}
        onPress={() => router.back()}
      >
        <Ionicons name="close" size={22} color="#C0B8D4" />
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
          <CoupleCompanion state="glowing" streak={streak} size="lg" />
          <Text style={styles.title}>Tonight's Reveal</Text>
          <Text style={styles.subtitle}>
            The words you both kept just for each other — now shared
          </Text>
          {streak > 0 && (
            <View style={styles.streakChip}>
              <Ionicons name="moon" size={11} color="#C3B1E1" />
              <Text style={styles.streakChipText}>
                {streak} {streak === 1 ? 'night' : 'nights'} together
              </Text>
            </View>
          )}
          <ConfettiBurst trigger={confetti} />
        </Animated.View>

        {milestone && <MilestoneBanner milestone={milestone} />}

        <RevealPair
          label="Grateful"
          accentColor="#FF9A8B"
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
          accentColor="#C3B1E1"
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
          accentColor="#A8D8A8"
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
                  <Ionicons name="sparkles" size={16} color="#FF9A8B" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.aiLockedTitle}>A gentle way forward</Text>
                  <Text style={styles.aiLockedBody}>Lunara Pro turns tonight's Grow notes into one small idea</Text>
                </View>
                <Ionicons name="lock-closed" size={16} color="#948BAC" />
              </Pressable>
            )
          ) : null}
        </RevealPair>

        {/* Reactions */}
        <Animated.View style={styles.reactions}>
          <Text style={styles.reactionsLabel}>How does this land for you tonight?</Text>
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
              ? `That's ${streak} nights you've both shown up. Sleep well.`
              : `${partnerName} is on the other side of tonight. Sleep well.`}
          </Text>
          <Pressable style={styles.doneBtn} onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.doneBtnText}>Close this moment</Text>
          </Pressable>
          <Text style={styles.seeYouText}>Three new cards tomorrow night.</Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  aiLockedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1A1730',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,154,139,0.18)',
    padding: 16,
  },
  aiLockedIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,154,139,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiLockedTitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#F5F2FB' },
  aiLockedBody: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: '#C0B8D4' },
  closeButton: {
    position: 'absolute',
    right: 22,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: '#1A1730',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { paddingHorizontal: 22 },

  titleSection: {
    alignItems: 'center',
    marginBottom: 36,
    gap: 10,
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(195,177,225,0.22)',
    backgroundColor: 'rgba(195,177,225,0.08)',
  },
  streakChipText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#C3B1E1',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Fraunces_600SemiBold',
    color: '#F5F2FB',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#C0B8D4',
    textAlign: 'center',
  },

  cardPair: { gap: 10, marginBottom: 24 },
  pairLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 2,
  },
  pairDot: { width: 7, height: 7, borderRadius: 3.5 },
  pairTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  revealCard: {
    flexDirection: 'row',
    backgroundColor: '#1A1730',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  cardStripe: { width: 3, flexShrink: 0 },
  cardContent: { flex: 1, padding: 16, gap: 6 },
  cardOwner: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#948BAC',
    letterSpacing: 0.3,
  },
  cardText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#DCD1EF',
    lineHeight: 22,
  },
  cardVoice: { marginTop: 6 },

  reactions: {
    marginTop: 8,
    marginBottom: 24,
    gap: 16,
    alignItems: 'center',
  },
  reactionsLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#C0B8D4',
    textAlign: 'center',
  },
  reactionRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  reactionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    minWidth: 72,
    minHeight: 72,
  },
  reactionLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
  },

  backSection: { alignItems: 'center', marginBottom: 16, gap: 14 },
  afterglowText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#C3B1E1',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  doneBtn: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  doneBtnText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#F5F2FB',
  },
  seeYouText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#948BAC',
    textAlign: 'center',
  },

  noEntry: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  noEntryText: { fontSize: 16, fontFamily: 'PlusJakartaSans_400Regular', color: '#C0B8D4' },
  closeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  closeBtnText: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: '#C0B8D4' },
});
