import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Share,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StarField } from '@/components/StarField';
import { RitualCard, CardType } from '@/components/RitualCard';
import { StreakSpotlight } from '@/components/StreakSpotlight';
import { CoupleCompanion } from '@/components/CoupleCompanion';
import { LunaraButton } from '@/components/LunaraButton';
import { GrowthTipCard } from '@/components/GrowthTipCard';
import { GrowthFollowUpCard } from '@/components/GrowthFollowUpCard';
import { GrowCheckBackCard } from '@/components/GrowCheckBackCard';
import { ConfettiBurst } from '@/components/ConfettiBurst';
import { NotSignedInError, useApp } from '@/context/AppContext';
import { useGrowth } from '@/hooks/useGrowth';
import { useCompanion } from '@/hooks/useCompanion';
import { useGrowCheckBack } from '@/hooks/useGrowCheckBack';
import { isPro } from '@/lib/entitlements';
import { isPartnerJoined, partnerLabel } from '@/lib/partner';
import { inviteShareMessage } from '@/lib/inviteLinks';
import { deleteVoiceNote, uploadVoiceNote, type VoiceSlot } from '@/lib/voiceNotes';
import { cancelGrowCheckBack } from '@/services/notifications';
import { radius, elevation } from '@/constants/tokens';

const CARD_ORDER: CardType[] = ['grateful', 'cute', 'grow'];

const VOICE_FIELD = {
  grateful: 'voiceGrateful',
  cute: 'voiceCute',
  grow: 'voiceGrow',
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
}

/**
 * The date shown in the header — the night being written, not the wall clock.
 * Reading `new Date()` here meant that someone who started at 11:58pm watched
 * the header roll over to tomorrow while their answers were still filed under
 * tonight, which is the same date confusion the write path had.
 */
function formatDate(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Shown while the couple exists but nobody has joined it yet. Without this the
 * screen quietly told a solo user their partner had "shared their heart" — the
 * one state where "what do I do next?" has a concrete answer, so it gets the
 * answer and the invite code directly, not a link to a settings screen.
 */
function InvitePartnerCard({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);
  const opacity = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  useEffect(() => { opacity.value = withTiming(1, { duration: 600 }); }, []);

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    await Share.share({
      message: inviteShareMessage(inviteCode),
      title: 'Join me on Lunara',
    }).catch(() => {});
  };

  return (
    <Animated.View style={[styles.inviteCard, animStyle]}>
      <View style={styles.inviteHeader}>
        <Ionicons name="heart-outline" size={20} color="#FF9A8B" />
        <Text style={styles.inviteTitle}>Bring your partner in</Text>
      </View>
      <Text style={styles.inviteBody}>
        Lunara opens up once you're both here. Write tonight's three whenever you
        like — they'll be waiting the moment your partner joins.
      </Text>
      <View style={styles.inviteCodeRow}>
        <Text style={styles.inviteCodeLabel}>Your code</Text>
        <Text style={styles.inviteCode}>{inviteCode}</Text>
      </View>
      <Pressable style={styles.inviteBtn} onPress={handleShare} hitSlop={8}>
        <Ionicons
          name={copied ? 'checkmark-circle-outline' : 'share-outline'}
          size={17}
          color="#0A0817"
        />
        <Text style={styles.inviteBtnText}>{copied ? 'Invite shared' : 'Send the invite'}</Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * The half-finished night. This is the single most fragile state in a couples
 * app: one person has done their part and the loop can't close without someone
 * else. It has to reward the person who showed up, give them one real action,
 * and never imply their partner is failing them.
 *
 * `nightsWaiting` softens the copy the longer the wait runs — a partner who
 * hasn't opened the app in three days needs an invitation, not a scoreboard.
 */
function WaitingState({
  partnerName,
  nightsWaiting,
  streak,
}: {
  partnerName: string;
  nightsWaiting: number;
  streak: number;
}) {
  const { sendNudge } = useApp();
  const [nudge, setNudge] = useState<'idle' | 'sending' | 'sent'>('idle');
  const opacity = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  useEffect(() => { opacity.value = withTiming(1, { duration: 600 }); }, []);

  const handleNudge = async () => {
    if (nudge !== 'idle') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNudge('sending');
    try {
      await sendNudge();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNudge('sent');
      // Long enough to read, short enough to try again the same evening.
      setTimeout(() => setNudge('idle'), 8000);
    } catch (error) {
      // Previously this failure was swallowed and the button still claimed
      // "Nudge sent!" — which is the worst possible lie in a waiting state.
      setNudge('idle');
      Alert.alert(
        'Couldn’t send that nudge',
        error instanceof Error
          ? error.message
          : 'Something went wrong on our side. Your night is still saved — try again in a moment.',
      );
    }
  };

  const body =
    nightsWaiting >= 3
      ? `Your last few nights are all here, waiting. Life gets loud — whenever ${partnerName} opens Lunara, every one of them opens with it.`
      : nightsWaiting === 2
        ? `Two nights are waiting now. Nothing is lost — they’ll all be here the moment ${partnerName} joins you.`
        : `Your words are already safe and kept close. The moment ${partnerName} shares theirs, you'll both be ready to open them together.`;

  return (
    <Animated.View style={[styles.waitingCard, animStyle]}>
      {/*
        The companion is the whole point of this card now. Half a night is the
        loneliest state in a couples app, and a fox sitting up with a small
        light is a better answer to it than a moon glyph: it says someone is
        still waiting up, without saying anything about the partner who hasn't
        arrived.
      */}
      <CoupleCompanion
        state="waiting"
        streak={streak}
        size="lg"
        showLabel
        style={styles.companionSlot}
      />
      <Text style={styles.waitingTitle}>Waiting for {partnerName}</Text>
      <Text style={styles.waitingBody}>{body}</Text>
      <Pressable
        style={[styles.nudgeBtn, nudge === 'sent' && styles.nudgeBtnSent]}
        onPress={handleNudge}
        disabled={nudge !== 'idle'}
      >
        <Ionicons
          name={nudge === 'sent' ? 'checkmark-circle-outline' : 'notifications-outline'}
          size={15}
          color={nudge === 'sent' ? '#A8D8A8' : '#C0B8D4'}
        />
        <Text style={[styles.nudgeText, nudge === 'sent' && styles.nudgeTextSent]}>
          {nudge === 'sent'
            ? `${partnerName} will get a soft ping`
            : nudge === 'sending'
              ? 'Sending…'
              : 'Send a gentle nudge'}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function RevealReadyState({
  partnerName,
  onReveal,
  streak,
}: {
  partnerName: string;
  onReveal: () => void;
  streak: number;
}) {
  const opacity = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  useEffect(() => { opacity.value = withTiming(1, { duration: 700 }); }, []);
  return (
    <Animated.View style={[styles.revealReadyCard, animStyle]}>
      <CoupleCompanion state="ready" streak={streak} size="md" />
      <Text style={styles.revealReadyTitle}>You're both here tonight</Text>
      <Text style={styles.revealReadyBody}>
        {partnerName} has opened their heart for tonight, just like you did. Whenever you're ready, reveal it together.
      </Text>
      <Pressable style={styles.revealBtn} onPress={onReveal}>
        <View style={styles.revealBtnGradient}>
          <Ionicons name="sparkles" size={20} color="#0A0817" />
          <Text style={styles.revealBtnText}>Reveal</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * The "you're done for today" moment. This is the last thing a couple sees
 * each night, so it does three jobs at once: confirm completion, name what the
 * streak now is, and leave an open loop for tomorrow.
 */
function AlreadyRevealedState({
  onView,
  streak,
  partnerName,
}: {
  onView: () => void;
  streak: number;
  partnerName: string;
}) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.96);
  const [confetti, setConfetti] = useState(0);
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 600 });
    scale.value = withSpring(1, { damping: 16, stiffness: 130 });
    // One quiet burst as the card settles — the reward, not a slot machine.
    const t = setTimeout(() => setConfetti((c) => c + 1), 260);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[styles.revealedCard, animStyle]}>
      <ConfettiBurst trigger={confetti} />
      {/* The reward. Brightest state the companion has, on the last card a
          couple sees each night. */}
      <CoupleCompanion
        state="glowing"
        streak={streak}
        size="md"
        style={styles.companionSlot}
      />
      <View style={styles.revealedMeta}>
        <Ionicons name="checkmark-circle" size={15} color="#A8D8A8" />
        <Text style={styles.revealedStreak}>
          {streak > 0
            ? `${streak} ${streak === 1 ? 'NIGHT' : 'NIGHTS'} IN A ROW`
            : 'COMPLETE'}
        </Text>
      </View>
      <Text style={styles.revealedTitle}>That&apos;s tonight, together</Text>
      <Text style={styles.revealedBody}>
        Nothing left to do tonight. Tomorrow, three new cards — and {partnerName} on the other side of them.
      </Text>
      <Pressable onPress={onView} style={styles.viewBtn} accessibilityRole="button">
        <Text style={styles.viewBtnText}>Read tonight&apos;s again</Text>
        <Ionicons name="arrow-forward" size={15} color="#FF9A8B" />
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
    entries,
    todayEntry,
    updateTodayEntry,
    submitTodayEntry,
    isLoading,
    streakState,
    revealTodayEntry,
    refreshEntries,
    realtimeConnected,
    ritualDate,
    setVoiceNote,
    setGrowFollowUp,
  } = useApp();

  const [grateful, setGrateful] = useState(todayEntry?.grateful ?? '');
  const [cute, setCute] = useState(todayEntry?.cute ?? '');
  const [grow, setGrow] = useState(todayEntry?.grow ?? '');
  const [activeCard, setActiveCard] = useState<CardType | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Entries load asynchronously, so the seeds above can be empty even when
  // tonight's answers already exist on the server. Adopt them once, the first
  // time the entry arrives, before anything has been typed.
  const hydratedRef = React.useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !todayEntry) return;
    hydratedRef.current = true;
    if (todayEntry.grateful) setGrateful(todayEntry.grateful);
    if (todayEntry.cute) setCute(todayEntry.cute);
    if (todayEntry.grow) setGrow(todayEntry.grow);
  }, [todayEntry]);

  const { todayTip, markTodayTipViewed, pendingFollowUp, respondToFollowUp, connectionStreak } = useGrowth();
  const { pending: growCheckBack } = useGrowCheckBack(entries);
  const companion = useCompanion();

  // Snapshot so the acknowledgement stays on screen for a beat after answering.
  const [activeCheckBack, setActiveCheckBack] = useState(growCheckBack);
  useEffect(() => {
    if (growCheckBack) setActiveCheckBack(growCheckBack);
  }, [growCheckBack]);

  // Snapshot the pending follow-up so the card stays mounted (result + confetti)
  // for a beat after the couple answers, rather than vanishing instantly.
  const [activeFollowUp, setActiveFollowUp] = useState(pendingFollowUp);
  useEffect(() => {
    if (pendingFollowUp) setActiveFollowUp(pendingFollowUp);
  }, [pendingFollowUp]);

  const partnerName = partnerLabel(couple);
  const partnerHere = isPartnerJoined(couple);
  const streak = streakState.current;

  /**
   * How many nights in a row you've submitted without your partner. Drives the
   * softening in WaitingState — counted off your own submitted-but-unrevealed
   * nights, so it's the wait you've actually experienced.
   */
  const nightsWaiting = React.useMemo(() => {
    let count = 0;
    let cursor = ritualDate;
    const byDate = new Map(entries.map((e) => [e.date, e]));
    for (;;) {
      const entry = byDate.get(cursor);
      if (!entry?.submitted || entry.partnerSubmitted) break;
      count += 1;
      const d = new Date(`${cursor}T00:00:00`);
      d.setDate(d.getDate() - 1);
      cursor = `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
    }
    return count;
  }, [entries, ritualDate]);
  const filledCount = [grateful, cute, grow].filter((v) => v.trim().length > 0).length;
  const allFilled = filledCount === 3;
  const proUser = isPro(couple);

  const handleCardExpand = useCallback((type: CardType) => {
    setActiveCard(type);
  }, []);

  const values: Record<CardType, string> = { grateful, cute, grow };

  /**
   * Finishing one card hands straight to the next empty one. Three separate
   * tap-open-close trips is most of the friction in the ritual; this makes it
   * a single pass that ends on the submit button.
   */
  const handleCardDone = useCallback(
    async (type: CardType, value: string) => {
      const nextEmpty = CARD_ORDER.find((t) => t !== type && values[t].trim().length === 0);
      setActiveCard(nextEmpty ?? null);
      // Persist immediately so nothing is lost mid-pass. A failure here stays
      // quiet on purpose — the text is still on screen and still in state, and
      // Submit is where the user finds out whether the night saved.
      await updateTodayEntry({ [type]: value }).catch(() => {});
    },
    // `values` is read fresh on each call; the compiler keeps this honest.
    [updateTodayEntry, values],
  );

  // Open the first unanswered card on arrival so the ritual starts with a
  // keyboard rather than a tap. This waits on the context load rather than on
  // `todayEntry`: a fresh night has no entry row at all until something is
  // typed, which is exactly the night the head start matters most.
  const autoOpenedRef = React.useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current || isLoading) return;
    autoOpenedRef.current = true;
    if (todayEntry?.submitted) return;
    const first = CARD_ORDER.find((t) => values[t].trim().length === 0);
    if (first) setActiveCard(first);
  }, [isLoading, todayEntry?.submitted, values]);

  // The night this screen is writing. Pinned by AppContext for the length of
  // the session, so a voice note recorded at 12:01am still lands on the night
  // the rest of the ritual was written.
  const today = ritualDate;

  const handleRecordVoice = useCallback(
    async (slot: VoiceSlot, localUri: string) => {
      if (!couple) return;
      try {
        // Demo couples have no server — the local URI is the stored value.
        const stored = couple.isDemoMode || !user
          ? localUri
          : await uploadVoiceNote({
              coupleId: couple.id,
              date: today,
              userId: user.id,
              slot,
              localUri,
            });
        await setVoiceNote(slot, stored);
      } catch {
        Alert.alert(
          'Voice note',
          'That recording couldn’t be saved just now. Your written note is safe — you can try again any time.',
        );
      }
    },
    [couple, setVoiceNote, today, user],
  );

  const handleDeleteVoice = useCallback(
    async (slot: VoiceSlot) => {
      const existing = todayEntry?.[VOICE_FIELD[slot]] ?? null;
      await setVoiceNote(slot, null);
      // Clear the row first: an orphaned object is harmless, a path pointing at
      // a deleted object is a broken player.
      if (existing) await deleteVoiceNote(existing).catch(() => {});
    },
    [setVoiceNote, todayEntry],
  );

  const handleCheckBackRespond = useCallback(
    (response: Parameters<typeof setGrowFollowUp>[1]) => {
      if (!activeCheckBack) return;
      const { date } = activeCheckBack;
      setGrowFollowUp(date, response).catch(() => {
        // The reply is a nicety, not the ritual — a failure here stays quiet.
      });
      cancelGrowCheckBack(date).catch(() => {});
    },
    [activeCheckBack, setGrowFollowUp],
  );

  const handleSubmit = async () => {
    if (!allFilled || submitting) return;
    setSubmitting(true);
    try {
      // One write, carrying the answers with it. Saving and then submitting was
      // two round trips where the second could overwrite the first with text it
      // had captured a render earlier.
      await submitTodayEntry({ grateful, cute, grow });
      // Celebrate only once the night is actually saved. Firing on tap meant
      // the phone congratulated people for writes that never landed.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (error instanceof NotSignedInError) {
        Alert.alert(
          'Sign in to save tonight',
          'Your session ended. Sign in again and everything you just wrote is still here.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Sign in', onPress: () => router.push('/(onboarding)/auth' as never) },
          ],
        );
      } else {
        // The old code had no catch at all: a failed write left `submitting`
        // true forever, so an offline submit spun until the app was killed.
        Alert.alert(
          'Tonight didn’t save',
          error instanceof Error && error.message
            ? `${error.message}\n\nYour words are still on screen — try again in a moment.`
            : 'We couldn’t reach Lunara just now. Your words are still on screen — try again in a moment.',
        );
      }
    } finally {
      setSubmitting(false);
    }
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

  // Once the ritual is complete, today's Growth Tip is on screen — record it so
  // tomorrow's follow-up card knows to ask about it.
  useEffect(() => {
    if (isSubmitted) markTodayTipViewed();
  }, [isSubmitted, markTodayTipViewed]);

  // Returning to the tab re-reads the one table that can have moved while you
  // were on another screen. The couple row and its members arrive over realtime
  // and are re-read in full on every foreground, so a tab switch does not need
  // to pull them again.
  useFocusEffect(
    useCallback(() => {
      refreshEntries().catch(() => {
        // Keep the last synced state visible while a connection is unavailable.
      });
    }, [refreshEntries]),
  );

  /**
   * A slow fallback for the wait, and only when there is nothing better.
   *
   * This was a ten-second full-dataset poll that ran the entire time a partner
   * was waiting — duplicating the realtime subscription that already pushes the
   * same change within a second of it happening, and dragging the notification
   * and widget effects along behind it on every tick. While realtime is joined
   * there is nothing here worth doing; when it isn't (cellular handover, a
   * backgrounded socket), a minute is quick enough for a partner who is by
   * definition not there yet, and reads one table instead of five.
   */
  useEffect(() => {
    if (!isSubmitted || partnerSubmitted || couple?.isDemoMode || !partnerHere) return;
    if (realtimeConnected) return;
    const refreshTimer = setInterval(() => {
      refreshEntries().catch(() => {
        // A future poll will retry after a temporary network failure.
      });
    }, 60000);
    return () => clearInterval(refreshTimer);
  }, [couple?.isDemoMode, isSubmitted, partnerHere, partnerSubmitted, realtimeConnected, refreshEntries]);

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const bottomPad = insets.bottom + 90 + (Platform.OS === 'web' ? 34 : 0);

  return (
    <LinearGradient
      colors={['#0A0817', '#141127', '#221D40', '#141127', '#0A0817']}
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
              <Text style={styles.dateText}>{formatDate(ritualDate).toUpperCase()}</Text>
              <Text style={styles.greeting}>
                {getGreeting()}{user?.name ? `, ${user.name}` : ''}
              </Text>
            </View>
            {/*
              The persistent presence — and the only place the *history* states
              (streak-lit, resting, sleeping) are ever visible, since those are
              by definition what an unfinished evening looks like.

              Hidden once tonight is submitted because from that point one of
              the state cards below is showing the same creature at hero size,
              and two of it on one screen turns a companion into a motif.
            */}
            {!isSubmitted && (
              <CoupleCompanion
                state={companion.state}
                streak={companion.streak}
                size="sm"
                style={styles.headerCompanion}
              />
            )}
          </View>

          {/* Not paired yet — the one thing worth doing before the ritual */}
          {couple && !partnerHere && (
            <InvitePartnerCard inviteCode={couple.inviteCode} />
          )}

          {/*
            Order is the whole design of this screen.

            While tonight is unfinished the three cards come FIRST — before the
            streak, before anything about yesterday. Everything above the action
            is a thing to read instead of doing, and the promise is "under two
            minutes", so the first tap has to be the ritual itself.

            Once it's done that inverts: the streak becomes the payoff rather
            than a stat you scroll past, and yesterday's soft questions finally
            have room. Nothing here is ever on screen at the same time as a
            competing call to action.
          */}
          {!isSubmitted && (
            <Animated.View style={styles.cards}>
              {CARD_ORDER.map((type) => {
                const value = values[type];
                const setValue =
                  type === 'grateful' ? setGrateful : type === 'cute' ? setCute : setGrow;
                // "Next" while there's still an empty card ahead, so the pass
                // reads as one motion ending at the submit button.
                const hasNext = CARD_ORDER.some((t) => t !== type && values[t].trim().length === 0);
                return (
                  <RitualCard
                    key={type}
                    type={type}
                    value={value}
                    isExpanded={activeCard === type}
                    onExpand={() => handleCardExpand(type)}
                    onDone={() => handleCardDone(type, value)}
                    onChange={setValue}
                    isSubmitted={isSubmitted}
                    doneLabel={hasNext ? 'Next' : 'Done'}
                    voiceValue={todayEntry?.[VOICE_FIELD[type]] ?? null}
                    onRecordVoice={proUser ? (uri) => handleRecordVoice(type, uri) : undefined}
                    onDeleteVoice={proUser ? () => handleDeleteVoice(type) : undefined}
                    onVoiceLocked={proUser ? undefined : () => router.push('/(modals)/paywall')}
                  />
                );
              })}
            </Animated.View>
          )}

          {/* Submit — always present, so the end of the ritual is never a
              button that appears out of nowhere. Progress is shown on it. */}
          {!isSubmitted && (
             <Animated.View style={styles.submitArea}>
              <View style={styles.progressDots}>
                {CARD_ORDER.map((type) => (
                  <View
                    key={type}
                    style={[
                      styles.progressDot,
                      values[type].trim().length > 0 && styles.progressDotFilled,
                    ]}
                  />
                ))}
                <Text style={styles.progressText}>
                  {allFilled
                    ? 'All three — ready when you are'
                    : `${filledCount} of 3 shared so far`}
                </Text>
              </View>
              <LunaraButton
                title={allFilled ? 'Share my thoughts' : 'Finish all three to share'}
                onPress={handleSubmit}
                loading={submitting}
                disabled={!allFilled}
              />
            </Animated.View>
          )}

          {/* Post-submit states — the single next step, whatever it is tonight */}
          {isSubmitted && partnerHere && !partnerSubmitted && (
            <WaitingState partnerName={partnerName} nightsWaiting={nightsWaiting} streak={streak} />
          )}

          {isSubmitted && !partnerHere && (
            <View style={styles.soloDoneCard}>
              <CoupleCompanion
                state="nesting"
                streak={streak}
                size="md"
                style={styles.companionSlot}
              />
              <Text style={styles.soloDoneTitle}>Tonight's three are saved</Text>
              <Text style={styles.soloDoneBody}>
                They stay private until your partner joins — then you'll open
                them together, just like every night after.
              </Text>
            </View>
          )}

          {isSubmitted && partnerHere && partnerSubmitted && !isRevealed && (
            <RevealReadyState partnerName={partnerName} onReveal={handleReveal} streak={streak} />
          )}

          {isRevealed && (
            <AlreadyRevealedState
              onView={handleViewRevealed}
              streak={streak}
              partnerName={partnerName}
            />
          )}

          {/* Streak — the reward once tonight is handled, never a hurdle before it */}
          {couple && partnerHere && (
            <StreakSpotlight
              streak={streak}
              longestStreak={couple.longestStreak ?? 0}
              atRisk={streakState.atRisk}
              protectedNight={streakState.protectedDate !== null}
              compact={!isSubmitted}
            />
          )}

          {/* Yesterday's soft questions — deferred until tonight is dealt with,
              so they can never intercept the first tap of the evening. */}
          {isSubmitted && activeCheckBack && (
            <GrowCheckBackCard
              growText={activeCheckBack.growText}
              onRespond={handleCheckBackRespond}
              onDismiss={() => setActiveCheckBack(null)}
            />
          )}

          {/* Suppressed while the Grow check-back is up: the two ask nearly the
              same question, and the check-back is about the couple's own words
              rather than a curated tip, so it wins. */}
          {isSubmitted && activeFollowUp && !activeCheckBack && (
            <GrowthFollowUpCard
              tip={activeFollowUp.tip}
              connectionStreak={connectionStreak}
              onRespond={respondToFollowUp}
              onDismiss={() => setActiveFollowUp(null)}
            />
          )}

          {/* Growth Tip — actionable nudge shown below the completed prompt */}
          {isSubmitted && <GrowthTipCard tip={todayTip} />}

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
  headerLeft: { flex: 1, gap: 6 },
  greeting: {
    fontSize: 28,
    fontFamily: 'Fraunces_600SemiBold',
    color: '#F5F2FB',
    lineHeight: 36,
    letterSpacing: -0.8,
  },
  // Overline: small, tracked-out, uppercase. Carries the date without
  // competing with the greeting for the eye.
  dateText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#948BAC',
    letterSpacing: 1.4,
  },

  cards: { gap: 12, marginBottom: 24 },

  // The companion sits centred inside cards that are otherwise left-aligned —
  // a creature hugging the left edge reads as an icon, which is the one thing
  // it must not read as.
  companionSlot: { alignSelf: 'center' },
  headerCompanion: { marginTop: 2 },


  submitArea: { marginBottom: 16, gap: 12 },
  progressDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  progressDotFilled: { backgroundColor: '#FF9A8B' },
  progressText: {
    marginLeft: 4,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#948BAC',
  },


  // Invite partner (not paired yet)
  inviteCard: {
    backgroundColor: '#1A1730',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,154,139,0.22)',
    padding: 24,
    gap: 12,
    marginBottom: 24,
  },
  inviteHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  inviteTitle: {
    fontSize: 22,
    fontFamily: 'Fraunces_600SemiBold',
    color: '#F5F2FB',
    letterSpacing: -0.4,
  },
  inviteBody: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#C0B8D4',
    lineHeight: 21,
  },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  inviteCodeLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#948BAC',
  },
  inviteCode: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#F5F2FB',
    letterSpacing: 3,
  },
  inviteBtn: {
    height: 52,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: '#FF9A8B',
  },
  inviteBtnText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0A0817',
    letterSpacing: 0.2,
  },

  // Submitted, but there is nobody to reveal with yet
  soloDoneCard: {
    backgroundColor: '#1A1730',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(195,177,225,0.15)',
    padding: 28,
    alignItems: 'flex-start',
    gap: 10,
  },
  soloDoneTitle: {
    fontSize: 22,
    fontFamily: 'Fraunces_600SemiBold',
    color: '#F5F2FB',
    letterSpacing: -0.4,
  },
  soloDoneBody: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#C0B8D4',
    lineHeight: 21,
  },

  // Waiting state
  waitingCard: {
    backgroundColor: '#1A1730',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(195,177,225,0.15)',
    padding: 28,
    alignItems: 'flex-start',
    gap: 12,
  },
  waitingTitle: {
    fontSize: 22,
    fontFamily: 'Fraunces_600SemiBold',
    color: '#F5F2FB',
    textAlign: 'left',
    letterSpacing: -0.4,
  },
  waitingBody: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#C0B8D4',
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
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  nudgeBtnSent: {
    backgroundColor: 'rgba(168,216,168,0.08)',
    borderColor: 'rgba(168,216,168,0.2)',
  },
  nudgeText: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: '#C0B8D4' },
  nudgeTextSent: { color: '#A8D8A8' },

  // Reveal ready
  revealReadyCard: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,154,139,0.25)',
    backgroundColor: '#1A1730',
    padding: 28,
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  revealReadyTitle: {
    fontSize: 28,
    fontFamily: 'Fraunces_600SemiBold',
    color: '#F5F2FB',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  revealReadyBody: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#C0B8D4',
    textAlign: 'center',
    lineHeight: 22,
  },
  revealBtn: { width: '100%', marginTop: 8 },
  revealBtnGradient: {
    height: 56,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FF9A8B',
  },
  revealBtnText: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0A0817',
    letterSpacing: 0.3,
  },

  // Already revealed
  revealedCard: {
    backgroundColor: '#1A1730',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    // Depth instead of an outline. A 1px hairline on every card is what made
    // three different pieces of content read as three identical boxes.
    borderWidth: 0,
    ...elevation.raised,
    padding: 26,
    alignItems: 'flex-start',
    gap: 10,
    overflow: 'hidden',
  },
  revealedMeta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  revealedStreak: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#A8D8A8',
    letterSpacing: 1.3,
  },
  revealedTitle: {
    fontSize: 28,
    fontFamily: 'Fraunces_600SemiBold',
    color: '#F5F2FB',
    textAlign: 'left',
    lineHeight: 32,
    letterSpacing: -0.6,
  },
  revealedBody: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#C0B8D4',
    textAlign: 'left',
    lineHeight: 23,
  },
  // A real affordance in the accent colour, not grey-on-grey pretending to be
  // a link. Min height keeps it on the 48pt touch floor.
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 6,
    minHeight: 44,
  },
  viewBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#FF9A8B',
  },
});
