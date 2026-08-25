import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StarField } from '@/components/StarField';
import { RitualCard, CardType } from '@/components/RitualCard';
import { MoonPhaseIndicator } from '@/components/MoonPhaseIndicator';
import { LunaraButton } from '@/components/LunaraButton';
import { useApp } from '@/context/AppContext';
import { sendNudgeNotification } from '@/services/notifications';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WaitingState({ partnerName }: { partnerName: string }) {
  const [nudgeSent, setNudgeSent] = useState(false);
  const opacity = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  useEffect(() => { opacity.value = withTiming(1, { duration: 600 }); }, []);

  const handleNudge = async () => {
    if (nudgeSent) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNudgeSent(true);
    await sendNudgeNotification(partnerName);
    // Reset after 5 s so user can nudge again if needed
    setTimeout(() => setNudgeSent(false), 5000);
  };

  return (
    <Animated.View style={[styles.waitingCard, animStyle]}>
      <Ionicons name="moon-outline" size={28} color="#C3B1E1" />
      <Text style={styles.waitingTitle}>Waiting for {partnerName}</Text>
      <Text style={styles.waitingBody}>
        Your answers are safe and private. You'll know the moment they share theirs.
      </Text>
      <Pressable style={[styles.nudgeBtn, nudgeSent && styles.nudgeBtnSent]} onPress={handleNudge}>
        <Ionicons
          name={nudgeSent ? 'checkmark-circle-outline' : 'notifications-outline'}
          size={15}
          color={nudgeSent ? '#A8D8A8' : '#9B89C2'}
        />
        <Text style={[styles.nudgeText, nudgeSent && styles.nudgeTextSent]}>
          {nudgeSent ? 'Nudge sent!' : 'Send a gentle nudge'}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function RevealReadyState({
  partnerName,
  onReveal,
}: {
  partnerName: string;
  onReveal: () => void;
}) {
  const opacity = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  useEffect(() => { opacity.value = withTiming(1, { duration: 700 }); }, []);
  return (
    <Animated.View style={[styles.revealReadyCard, animStyle]}>
      <Text style={styles.revealReadyTitle}>Both of you have shared</Text>
      <Text style={styles.revealReadyBody}>
        {partnerName} is ready. Tap below to reveal your answers together.
      </Text>
      <Pressable style={styles.revealBtn} onPress={onReveal}>
        <View style={styles.revealBtnGradient}>
          <Ionicons name="sparkles" size={20} color="#1A0E18" />
          <Text style={styles.revealBtnText}>Reveal</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function AlreadyRevealedState({ onView }: { onView: () => void }) {
  const opacity = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  useEffect(() => { opacity.value = withTiming(1, { duration: 600 }); }, []);
  return (
    <Animated.View style={[styles.revealedCard, animStyle]}>
      <Ionicons name="checkmark-circle" size={28} color="#A8D8A8" />
      <Text style={styles.revealedTitle}>Tonight's ritual is complete</Text>
      <Text style={styles.revealedBody}>You'll see tomorrow's cards at sunset.</Text>
      <Pressable onPress={onView} style={styles.viewBtn}>
        <Text style={styles.viewBtnText}>View tonight's entries</Text>
        <Ionicons name="chevron-forward" size={14} color="#9B89C2" />
      </Pressable>
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TonightScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    user,
    couple,
    todayEntry,
    updateTodayEntry,
    submitTodayEntry,
    revealTodayEntry,
    refreshSharedState,
  } = useApp();

  const [grateful, setGrateful] = useState(todayEntry?.grateful ?? '');
  const [cute, setCute] = useState(todayEntry?.cute ?? '');
  const [grow, setGrow] = useState(todayEntry?.grow ?? '');
  const [activeCard, setActiveCard] = useState<CardType | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const partnerName = couple?.partnerName ?? 'your partner';
  const streak = couple?.currentStreak ?? 0;
  const allFilled = grateful.trim().length > 0 && cute.trim().length > 0 && grow.trim().length > 0;

  const handleCardExpand = useCallback((type: CardType) => {
    setActiveCard(type);
  }, []);

  const handleCardDone = useCallback(
    async (type: CardType, value: string) => {
      setActiveCard(null);
      // Persist to storage immediately so nothing is lost
      await updateTodayEntry({ [type]: value });
    },
    [updateTodayEntry]
  );

  const handleSubmit = async () => {
    if (!allFilled || submitting) return;
    setSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateTodayEntry({ grateful, cute, grow });
    await submitTodayEntry();
    setSubmitting(false);
  };

  const handleReveal = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await revealTodayEntry();
    router.push('/reveal');
  };

  const handleViewRevealed = () => {
    router.push('/reveal');
  };

  // Determine screen state
  const isSubmitted = todayEntry?.submitted ?? false;
  const partnerSubmitted = todayEntry?.partnerSubmitted ?? false;
  const isRevealed = todayEntry?.revealed ?? false;

  useFocusEffect(
    useCallback(() => {
      refreshSharedState().catch(() => {
        // Keep the last synced state visible while a connection is unavailable.
      });
    }, [refreshSharedState]),
  );

  useEffect(() => {
    if (!isSubmitted || partnerSubmitted || couple?.isDemoMode) return;
    const refreshTimer = setInterval(() => {
      refreshSharedState().catch(() => {
        // A future poll will retry after a temporary network failure.
      });
    }, 10000);
    return () => clearInterval(refreshTimer);
  }, [couple?.isDemoMode, isSubmitted, partnerSubmitted, refreshSharedState]);

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const bottomPad = insets.bottom + 90 + (Platform.OS === 'web' ? 34 : 0);

  return (
    <LinearGradient
      colors={['#0F0C29', '#1A1635', '#302B63', '#1A1635', '#0F0C29']}
      locations={[0, 0.3, 0.55, 0.8, 1]}
      style={styles.container}
    >
      <StarField />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: topPad + 16, paddingBottom: bottomPad },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.greeting}>
                {getGreeting()}{user?.name ? `, ${user.name}` : ''}
              </Text>
              <Text style={styles.dateText}>{formatDate()}</Text>
            </View>
            <MoonPhaseIndicator streak={streak} size="small" />
          </View>

          {/* Ritual cards — only when not submitted */}
          {!isSubmitted && (
             <Animated.View style={styles.cards}>
              <RitualCard
                type="grateful"
                value={grateful}
                isExpanded={activeCard === 'grateful'}
                onExpand={() => handleCardExpand('grateful')}
                onDone={() => handleCardDone('grateful', grateful)}
                onChange={setGrateful}
                isSubmitted={isSubmitted}
              />
              <RitualCard
                type="cute"
                value={cute}
                isExpanded={activeCard === 'cute'}
                onExpand={() => handleCardExpand('cute')}
                onDone={() => handleCardDone('cute', cute)}
                onChange={setCute}
                isSubmitted={isSubmitted}
              />
              <RitualCard
                type="grow"
                value={grow}
                isExpanded={activeCard === 'grow'}
                onExpand={() => handleCardExpand('grow')}
                onDone={() => handleCardDone('grow', grow)}
                onChange={setGrow}
                isSubmitted={isSubmitted}
              />
            </Animated.View>
          )}

          {/* Submit button — shown when all filled and not submitted */}
          {!isSubmitted && (
             <Animated.View style={styles.submitArea}>
              {allFilled && (
                <Animated.View>
                  <LunaraButton
                    title="Share my thoughts"
                    onPress={handleSubmit}
                    loading={submitting}
                  />
                </Animated.View>
              )}
              {!allFilled && (
                <View style={styles.progressHint}>
                  <Text style={styles.progressText}>
                    {[grateful, cute, grow].filter((v) => v.trim().length > 0).length} of 3 answered
                  </Text>
                </View>
              )}
            </Animated.View>
          )}

          {/* Post-submit states */}
          {isSubmitted && !partnerSubmitted && (
            <WaitingState partnerName={partnerName} />
          )}

          {isSubmitted && partnerSubmitted && !isRevealed && (
            <RevealReadyState partnerName={partnerName} onReveal={handleReveal} />
          )}

          {isRevealed && (
            <AlreadyRevealedState onView={handleViewRevealed} />
          )}

          {/* Partner status indicator when submitted */}
          {isSubmitted && (
             <Animated.View style={styles.partnerBadge}>
              <View style={[styles.partnerDot, partnerSubmitted && styles.partnerDotActive]} />
              <Text style={styles.partnerBadgeText}>
                {partnerSubmitted
                  ? `${partnerName} has shared their thoughts`
                  : `Waiting for ${partnerName}...`}
              </Text>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 22 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerLeft: { flex: 1, gap: 2 },
  greeting: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#F8F5FF',
    lineHeight: 28,
  },
  dateText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#7A6D98',
  },

  cards: { gap: 12, marginBottom: 24 },

  submitArea: { marginBottom: 16, gap: 12 },
  progressHint: {
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  progressText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#7A6D98',
  },

  partnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    alignSelf: 'center',
  },
  partnerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  partnerDotActive: { backgroundColor: '#A8D8A8' },
  partnerBadgeText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
  },

  // Waiting state
  waitingCard: {
    backgroundColor: '#1E1B3A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(195,177,225,0.15)',
    padding: 28,
    alignItems: 'flex-start',
    gap: 12,
  },
  waitingTitle: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    color: '#F8F5FF',
    textAlign: 'left',
  },
  waitingBody: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
    textAlign: 'left',
    lineHeight: 21,
  },
  nudgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  nudgeBtnSent: {
    backgroundColor: 'rgba(168,216,168,0.08)',
    borderColor: 'rgba(168,216,168,0.2)',
  },
  nudgeText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#9B89C2' },
  nudgeTextSent: { color: '#A8D8A8' },

  // Reveal ready
  revealReadyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,154,139,0.25)',
    backgroundColor: '#1E1B3A',
    padding: 28,
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  revealReadyTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#F8F5FF',
    textAlign: 'center',
  },
  revealReadyBody: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
    textAlign: 'center',
    lineHeight: 22,
  },
  revealBtn: { width: '100%', marginTop: 8 },
  revealBtnGradient: {
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  revealBtnText: {
    fontSize: 19,
    fontFamily: 'Inter_700Bold',
    color: '#1A0E18',
    letterSpacing: 0.3,
  },

  // Already revealed
  revealedCard: {
    backgroundColor: '#1E1B3A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,216,168,0.2)',
    padding: 28,
    alignItems: 'center',
    gap: 10,
  },
  revealedTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#F8F5FF',
    textAlign: 'center',
  },
  revealedBody: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
    textAlign: 'center',
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingVertical: 8,
  },
  viewBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#9B89C2',
  },
});
