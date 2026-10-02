import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Share,
  Alert,
  Keyboard,
  type ScrollView,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StarField } from '@/components/StarField';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { SpringPressable } from '@/components/SpringPressable';
import { RitualCard, CardType } from '@/components/RitualCard';
import { StreakSpotlight } from '@/components/StreakSpotlight';
import { TogetherPointsChip } from '@/components/TogetherPointsChip';
import { CoupleCompanion } from '@/components/CoupleCompanion';
import { LunaraButton } from '@/components/LunaraButton';
import { SingleNudgeSlot } from '@/components/SingleNudgeSlot';
import { ConfettiBurst } from '@/components/ConfettiBurst';
import { NotSignedInError, useApp, type DailyEntry } from '@/context/AppContext';
import { useCompanion } from '@/hooks/useCompanion';
import { useNudge } from '@/hooks/useNudge';
import { isPartnerJoined, partnerLabel } from '@/lib/partner';
import { inviteShareMessage } from '@/lib/inviteLinks';
import {
  deleteVoiceNote,
  transcribeVoiceNote,
  uploadVoiceNote,
  type VoiceSlot,
} from '@/lib/voiceNotes';
import { dailyPrompt } from '@/lib/dailyPrompts';
import { tonightPhase } from '@/lib/nudge';
import { haptic } from '@/lib/haptics';
import { radius, elevation, space, duration, spring } from '@/constants/tokens';
import { gradients, glow, palette, tint } from '@/constants/colors';
import { type as text, maxFontScale, tabularNumerals } from '@/constants/typography';

const CARD_ORDER: CardType[] = ['grateful', 'cute', 'grow'];

/**
 * How far above the keyboard the focused answer sits. Enough to keep the
 * "Or say it out loud" row beneath the input visible, so typing never hides
 * the other way to answer.
 */
const KEYBOARD_CLEARANCE = 88;

const VOICE_FIELD = {
  grateful: 'voiceGrateful',
  cute: 'voiceCute',
  grow: 'voiceGrow',
} as const;

const VOICE_DURATION_FIELD = {
  grateful: 'voiceGratefulDurationMs',
  cute: 'voiceCuteDurationMs',
  grow: 'voiceGrowDurationMs',
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * The line above the fox. Warm, short, and second person — "your night" rather
 * than "Good evening, Sam", which is the register of a hotel check-in.
 */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Morning, you two';
  if (h >= 12 && h < 17) return 'Afternoon, you two';
  if (h >= 17 && h < 21) return 'Your night is open';
  return 'Late one tonight';
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
 * The shared streak, as a chip rather than a stat.
 *
 * Small, gold, and always phrased in the plural — "Day 7 together", never "7 day
 * streak". A streak is the most gamified object in the app and the fastest way
 * for it to turn into a scoreboard is to let it speak like one. It sits beside
 * the date, above the fox, at a size that reads as a detail of the night rather
 * than the point of it.
 */
function StreakChip({ streak }: { streak: number }) {
  if (streak <= 0) return null;
  return (
    <View style={styles.streakChip}>
      <Ionicons name="flame" size={13} color={palette.accent.streak} />
      <Text style={styles.streakChipText} maxFontSizeMultiplier={maxFontScale}>
        Day {streak} together
      </Text>
    </View>
  );
}

/**
 * The hero zone: the fox, big, with one line under it saying what it is doing.
 *
 * ─── Why the fox is the top of the screen ────────────────────────────────────
 *
 * Previously it was a 44pt glyph in the top-right corner, which is where you
 * put a *status indicator*. The whole argument for a companion is that it is a
 * third thing in the room that belongs to both of them, and nothing you put in
 * a corner at 44pt belongs to anybody. At 188pt with a halo it is the subject
 * of the screen, which is what makes opening the app feel like checking on
 * something rather than filing a report.
 *
 * ─── The status line is never optional here ──────────────────────────────────
 *
 * Elsewhere the label is opt-in and the art speaks first. On this screen the
 * line is always on, because this is the one surface where the *history* states
 * (streak-lit, resting, sleeping) are visible, and the difference between
 * "resting" and "sleeping" is legible in the art but not nameable from it.
 * One short line removes the ambiguity without explaining the animal.
 */
function TonightHero({
  state,
  streak,
  togetherPoints,
  label,
  dateLabel,
  greeting,
}: {
  state: React.ComponentProps<typeof CoupleCompanion>['state'];
  streak: number;
  togetherPoints: number;
  label: string;
  dateLabel: string;
  greeting: string;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroTopRow}>
        <Text style={styles.dateText} maxFontSizeMultiplier={maxFontScale}>
          {dateLabel}
        </Text>
        <StreakChip streak={streak} />
      </View>
      {/*
        The greeting goes ABOVE the fox and the fox's own line stays below it.

        Stacked underneath each other they were two centred serif lines two
        steps apart, which reads as a headline and a sub-headline for the same
        thing — and they are not the same thing. The greeting is the screen
        addressing the couple; the line under the fox is the fox's status. One
        above and one below, in different faces, and each is legible as what it
        actually is.
      */}
      <Text style={styles.heroGreeting} maxFontSizeMultiplier={maxFontScale}>
        {greeting}
      </Text>
      <CoupleCompanion state={state} streak={streak} size="hero" showLabel label={label} />
      <TogetherPointsChip points={togetherPoints} />
    </View>
  );
}


/**
 * Shown while the couple exists but nobody has joined it yet. Without this the
 * screen quietly told a solo user their partner had "shared their heart" — the
 * one state where "what do I do next?" has a concrete answer, so it gets the
 * answer and the invite code directly, not a link to a settings screen.
 */
function InvitePartnerCard({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const result = await Share.share({
      message: inviteShareMessage(inviteCode),
      title: 'Join me on Lunara',
    }).catch(() => null);
    // "Sent" only once it was: this flipped on the tap, so closing the share
    // sheet without sending still told the person their invite had gone.
    if (result?.action !== Share.sharedAction) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Animated.View entering={FadeIn.duration(duration.base)} style={styles.inviteCard}>
      <View style={styles.inviteHeader}>
        <Ionicons name="heart" size={20} color={palette.accent.heart} />
        <Text style={styles.inviteTitle}>It takes both of you</Text>
      </View>
      <Text style={styles.inviteBody}>
        Your fox is curled up waiting for the other half. Write tonight&apos;s three
        anyway — they&apos;ll be here the moment your person arrives.
      </Text>
      <View style={styles.inviteCodeRow}>
        <Text style={styles.inviteCodeLabel}>Your code</Text>
        <Text style={styles.inviteCode}>{inviteCode}</Text>
      </View>
      <SpringPressable style={styles.inviteBtn} onPress={handleShare} hitSlop={8}>
        <Ionicons
          name={copied ? 'checkmark-circle-outline' : 'share-outline'}
          size={17}
          color={palette.ink[0]}
        />
        <Text style={styles.inviteBtnText}>{copied ? 'Sent — go bug them' : 'Invite your person'}</Text>
      </SpringPressable>
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

  const handleNudge = async () => {
    if (nudge !== 'idle') return;
    setNudge('sending');
    try {
      await sendNudge();
      haptic.success();
      setNudge('sent');
      // Long enough to read, short enough to try again the same evening.
      setTimeout(() => setNudge('idle'), 8000);
    } catch (error) {
      // Previously this failure was swallowed and the button still claimed
      // "Nudge sent!" — which is the worst possible lie in a waiting state.
      haptic.error();
      setNudge('idle');
      Alert.alert(
        'Couldn’t send that nudge',
        error instanceof Error
          ? error.message
          : 'Something went wrong on our side. Your night is still saved — try again in a moment.',
      );
    }
  };

  // Softens as the wait runs on. Nothing here ever counts the nights *at* the
  // person waiting, and nothing here implies the other one is failing anybody.
  const body =
    nightsWaiting >= 3
      ? `Every night you've written is still here, held. Life gets loud — they all open the moment ${partnerName} does.`
      : nightsWaiting === 2
        ? `Two nights waiting now. Nothing's lost — they'll open together whenever ${partnerName} arrives.`
        : `Yours is safe and still sealed. The second ${partnerName} adds theirs, you open them together.`;

  const handleShare = async () => {
    await Share.share({
      message: `I've done tonight's three on Lunara 🦊 your fox is waiting up for you`,
    }).catch(() => {});
  };

  return (
    <Animated.View entering={FadeIn.duration(duration.base)} style={styles.waitingCard}>
      {/*
        The companion is the whole point of this card. Half a night is the
        loneliest state in a couples app, and a fox sitting up with a small
        light is a better answer to it than a moon glyph: it says someone is
        still waiting up, without saying anything about the partner who hasn't
        arrived. At hero size it is the screen rather than an illustration on it.
      */}
      <CoupleCompanion
        state="waiting"
        streak={streak}
        size="hero"
        showLabel
        style={styles.companionSlot}
      />
      <Text style={styles.waitingTitle}>{partnerName} hasn't shared yet</Text>
      <Text style={styles.waitingBody}>{body}</Text>
      {/*
        Two ways out of a wait, both cheerful. The nudge is the in-app path; the
        share sheet is the one that works when your partner hasn't opened Lunara
        in a week, which is exactly when a push notification won't.
      */}
      <View style={styles.waitingActions}>
        <SpringPressable
          style={[styles.nudgeBtn, nudge === 'sent' && styles.nudgeBtnSent]}
          onPress={handleNudge}
          disabled={nudge !== 'idle'}
          // "Sent" is done, not unavailable — it keeps its success colour.
          dimWhenDisabled={nudge === 'sending'}
          accessibilityState={{ busy: nudge === 'sending' }}
        >
          <Ionicons
            name={nudge === 'sent' ? 'checkmark-circle' : 'hand-left-outline'}
            size={15}
            color={nudge === 'sent' ? palette.accent.success : palette.accent.glow}
          />
          <Text
            style={[styles.nudgeText, nudge === 'sent' && styles.nudgeTextSent]}
            numberOfLines={1}
          >
            {nudge === 'sent'
              ? 'Nudge sent'
              : nudge === 'sending'
                ? 'Sending…'
                : 'Nudge them'}
          </Text>
        </SpringPressable>
        <SpringPressable style={styles.shareBtn} onPress={handleShare}>
          <Ionicons name="paper-plane-outline" size={15} color={palette.content[1]} />
          <Text style={styles.shareText}>Text them</Text>
        </SpringPressable>
      </View>
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
  return (
    <Animated.View entering={FadeIn.duration(duration.base)} style={styles.revealReadyCard}>
      <CoupleCompanion state="ready" streak={streak} size="hero" style={styles.companionSlot} />
      <Text style={styles.revealReadyTitle}>Both of you showed up</Text>
      <Text style={styles.revealReadyBody}>
        {partnerName} wrote theirs too. Open tonight whenever you&apos;re ready — the fox has been holding it.
      </Text>
      {/* Its own haptic (`unlock`) fires in the handler — this is the one tap
          in the app that unseals something, so it doesn't say "tap". */}
      <SpringPressable style={styles.revealBtn} onPress={onReveal} haptic="none">
        <View style={styles.revealBtnGradient}>
          <Ionicons name="sparkles" size={20} color={palette.ink[0]} />
          <Text style={styles.revealBtnText}>Open tonight</Text>
        </View>
      </SpringPressable>
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
  onShare,
  streak,
  partnerName,
}: {
  onView: () => void;
  onShare: () => void;
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
    opacity.value = withTiming(1, { duration: duration.base });
    scale.value = withSpring(1, spring.settle);
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
        size="hero"
        style={styles.companionSlot}
      />
      <View style={styles.revealedMeta}>
        <Ionicons name="checkmark-circle" size={15} color={palette.accent.success} />
        <Text style={styles.revealedStreak}>
          {streak > 0 ? `Day ${streak} together` : 'Tonight is shared'}
        </Text>
      </View>
      <Text style={styles.revealedTitle}>That&apos;s tonight, together</Text>
      <Text style={styles.revealedBody}>
        Nothing left to do. Your fox is lit until morning — and {partnerName} is on the other side of tomorrow&apos;s three.
      </Text>
      {/*
        Two low-stakes ways to stay in the moment: read it again, or send the
        night out into the world. The share is the app's only viral surface that
        costs the couple nothing — it carries a day count and no content.
      */}
      <View style={styles.revealedActions}>
        <SpringPressable onPress={onView} style={styles.viewBtn}>
          <Text style={styles.viewBtnText}>Read it again</Text>
          <Ionicons name="arrow-forward" size={14} color={palette.accent.glow} />
        </SpringPressable>
        <SpringPressable onPress={onShare} style={styles.shareBtn}>
          <Ionicons name="share-outline" size={15} color={palette.content[1]} />
          <Text style={styles.shareText}>Share</Text>
        </SpringPressable>
      </View>
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

  const companion = useCompanion();


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

  const handleCardExpand = useCallback((type: CardType) => {
    setActiveCard(type);
  }, []);

  const values: Record<CardType, string> = { grateful, cute, grow };

  // A card is answered by writing *or* by speaking — a recording on its own
  // counts, so someone can do the whole night out loud.
  const isAnswered = (t: CardType) =>
    values[t].trim().length > 0 || Boolean(todayEntry?.[VOICE_FIELD[t]]);
  const filledCount = CARD_ORDER.filter(isAnswered).length;
  const allFilled = filledCount === 3;

  // Tonight is a state machine, not a feed — see lib/nudge.ts. The phase picks
  // the one thing this screen is for right now, and whether the single growth
  // nudge slot may show at all (only on a new day's first visit, or after the
  // reveal — never while writing or waiting).
  const phase = tonightPhase({
    answeredCount: filledCount,
    submitted: todayEntry?.submitted ?? false,
    partnerJoined: partnerHere,
    partnerSubmitted: todayEntry?.partnerSubmitted ?? false,
    revealed: todayEntry?.revealed ?? false,
  });
  const nudge = useNudge(phase);

  /**
   * Finishing one card hands straight to the next empty one. Three separate
   * tap-open-close trips is most of the friction in the ritual; this makes it
   * a single pass that ends on the submit button.
   */
  const handleCardDone = useCallback(
    async (type: CardType, value: string) => {
      const nextEmpty = CARD_ORDER.find((t) => t !== type && !isAnswered(t));
      setActiveCard(nextEmpty ?? null);
      // The last card closing is the end of typing: put the keyboard away so
      // the submit button is what's left on screen, not a keyboard over it.
      if (!nextEmpty) Keyboard.dismiss();
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
    if (autoOpenedRef.current || isLoading || !nudge.ready) return;
    autoOpenedRef.current = true;
    if (todayEntry?.submitted) return;
    // A new day with yesterday's follow-up waiting: let it be seen above the
    // cards first, rather than opening a keyboard over it. Tapping a card
    // starts the night as usual.
    if (nudge.nudge) return;
    const first = CARD_ORDER.find((t) => !isAnswered(t));
    if (first) setActiveCard(first);
  }, [isLoading, nudge.ready, nudge.nudge, todayEntry?.submitted, values]);

  // The night this screen is writing. Pinned by AppContext for the length of
  // the session, so a voice note recorded at 12:01am still lands on the night
  // the rest of the ritual was written.
  const today = ritualDate;

  const scrollRef = React.useRef<ScrollView>(null);

  // Failures are left to throw: the recorder still holds the take and offers
  // to try the upload again, which only it can do.
  const handleRecordVoice = useCallback(
    async (slot: VoiceSlot, localUri: string, durationMs: number) => {
      if (!couple) return;
      const previous = todayEntry?.[VOICE_FIELD[slot]] ?? null;
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
      await setVoiceNote(slot, stored, durationMs);
      // A server re-record overwrote the same path already. A demo re-record is
      // a new file, so the take it replaced is dropped here, once the new one
      // is safely stored.
      if (previous && previous !== stored) await deleteVoiceNote(previous).catch(() => {});
    },
    [couple, setVoiceNote, today, todayEntry, user],
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

  /**
   * Turn one of tonight's recordings into text for the same card.
   *
   * Three rules, all of them about not taking anything away from someone:
   *
   *  - It never overwrites silently. Writing over a line they typed, with a
   *    machine's guess at what they said, is the one outcome that would make
   *    this feature not worth having — so text already in the field is only
   *    replaced after they say so.
   *  - A failure is a sentence, not an error. The transcript is a convenience
   *    on top of a recording that is already saved; nothing is lost when it
   *    doesn't work, and the copy says that rather than apologising.
   *  - It never touches the audio. The recording stays exactly as it is
   *    whether the transcript lands, fails, or is declined.
   */
  const handleTranscribeVoice = useCallback(
    async (slot: VoiceSlot, current: string, setValue: (next: string) => void) => {
      const path = todayEntry?.[VOICE_FIELD[slot]] ?? null;
      if (!path) return;

      const transcript = await transcribeVoiceNote(path);
      if (!transcript) {
        Alert.alert(
          'Voice note',
          'We couldn’t quite make that out. Your recording is safe — you can write the line yourself, or leave it as just your voice.',
        );
        return;
      }

      const apply = () => {
        setValue(transcript);
        // Persist immediately, the same as finishing a card by hand — the text
        // is on screen, so it has to be saved.
        void updateTodayEntry({ [slot]: transcript } as Partial<DailyEntry>).catch(() => {});
        haptic.success();
      };

      if (current.trim().length === 0) {
        apply();
        return;
      }

      Alert.alert(
        'Replace what you wrote?',
        'Your recording stays either way — this only changes the written line.',
        [
          { text: 'Keep mine', style: 'cancel' },
          { text: 'Use the transcript', onPress: apply },
        ],
      );
    },
    [todayEntry, updateTodayEntry],
  );

  const handleSubmit = async () => {
    if (!allFilled || submitting) return;
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      // One write, carrying the answers with it. Saving and then submitting was
      // two round trips where the second could overwrite the first with text it
      // had captured a render earlier.
      await submitTodayEntry({ grateful, cute, grow });
      // Celebrate only once the night is actually saved. Firing on tap meant
      // the phone congratulated people for writes that never landed.
      haptic.success();
      // The screen is about to become a different screen (the cards give way
      // to the waiting fox), and it would otherwise keep the scroll offset of
      // the submit button — landing someone halfway down a card they have
      // never seen the top of.
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (error) {
      haptic.error();
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
    haptic.unlock();
    // Marking the night opened is a per-device flag. If writing it fails the
    // answers are still there to read, so the reveal opens regardless rather
    // than leaving a button that did nothing.
    await revealTodayEntry().catch(() => {});
    router.push('/reveal');
  };

  const handleViewRevealed = () => {
    router.push('/reveal');
  };

  /**
   * The share. Deliberately carries a *count* and nothing either of them wrote
   * — the ritual is private and a share sheet is the last place to leak it. It
   * is a screenshot-shaped sentence, which is the only form of virality this
   * product is entitled to.
   */
  const handleShareNight = useCallback(async () => {
    const line =
      streak > 1
        ? `Day ${streak} together on Lunara 🦊 both of us showed up again tonight`
        : `Both of us showed up tonight 🦊 (Lunara)`;
    await Share.share({ message: line }).catch(() => {});
  }, [streak]);

  // Determine screen state
  const isSubmitted = todayEntry?.submitted ?? false;
  const partnerSubmitted = todayEntry?.partnerSubmitted ?? false;
  const isRevealed = todayEntry?.revealed ?? false;

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

  /**
   * The room changes temperature with the night.
   *
   * Cool violet while the evening is unresolved — nobody has arrived, or only
   * one of you has. Warm apricot from the moment you are both in it. It is the
   * slowest, least noticeable piece of feedback in the app and probably the
   * most effective: you can tell across a room whether tonight closed, without
   * reading a word.
   */
  const warmNight = (todayEntry?.submitted ?? false) && (todayEntry?.partnerSubmitted ?? false);

  return (
    <LinearGradient
      colors={warmNight ? gradients.warm : gradients.screen}
      locations={warmNight ? gradients.warmLocations : gradients.screenLocations}
      style={styles.container}
    >
      <StarField />

      {/*
        Keyboard-aware rather than keyboard-avoiding. The old
        KeyboardAvoidingView padded the whole screen by the keyboard's height
        and hoped the focused card was still visible — on a small phone the
        Grow card's input sat under the keyboard, and the padding lingered
        after the keyboard left. This scrolls the *focused input* (and follows
        its caret as a multiline answer grows) to sit `bottomOffset` above the
        keyboard, which keeps the voice row under it in view too.

        Taps on empty space put the keyboard away (`keyboardShouldPersistTaps`
        = handled, the Compat default); dragging the page does too.
      */}
      <KeyboardAwareScrollViewCompat
        ref={scrollRef}
        bottomOffset={KEYBOARD_CLEARANCE}
        keyboardDismissMode="interactive"
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 16, paddingBottom: bottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/*
          The fox owns the top of the screen while the night is unfinished —
          and this is the only surface where the *history* states (streak-lit,
          resting, sleeping) are ever visible, since those are by definition
          what an unfinished evening looks like.

          It stands down once tonight is submitted, because from that point
          one of the state cards below is showing the same creature at hero
          size, and two of it on one screen turns a companion into a motif.
        */}
        {!isSubmitted ? (
          <TonightHero
            state={companion.state}
            streak={companion.streak}
            togetherPoints={couple?.togetherPoints ?? 0}
            label={companion.label}
            dateLabel={formatDate(ritualDate)}
            greeting={getGreeting()}
          />
        ) : (
          <Animated.View entering={FadeIn.duration(duration.base)} style={styles.headerDone}>
            <Text style={styles.dateText} maxFontSizeMultiplier={maxFontScale}>
              {formatDate(ritualDate)}
            </Text>
            <StreakChip streak={streak} />
          </Animated.View>
        )}

        {/* Not paired yet — the one thing worth doing before the ritual */}
        {couple && !partnerHere && (
          <InvitePartnerCard inviteCode={couple.inviteCode} />
        )}

        {/* next_open: yesterday's follow-up, once, before tonight begins */}
        {phase === 'not_started' && <SingleNudgeSlot {...nudge} />}

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
              const hasNext = CARD_ORDER.some((t) => t !== type && !isAnswered(t));
              return (
                <RitualCard
                  key={type}
                  type={type}
                  value={value}
                  isExpanded={activeCard === type}
                  onExpand={() => handleCardExpand(type)}
                  onDone={() => handleCardDone(type, value)}
                  onChange={setValue}
                  prompt={dailyPrompt(type, ritualDate)}
                  isSubmitted={isSubmitted}
                  doneLabel={hasNext ? 'Next' : 'Done'}
                  voiceValue={todayEntry?.[VOICE_FIELD[type]] ?? null}
                  voiceDurationMs={todayEntry?.[VOICE_DURATION_FIELD[type]] ?? null}
                  // No Pro check here: the whole app sits behind the entitlement
                  // gate in app/index.tsx, so voice is simply part of the ritual.
                  onRecordVoice={(uri, durationMs) => handleRecordVoice(type, uri, durationMs)}
                  onDeleteVoice={() => handleDeleteVoice(type)}
                  onTranscribeVoice={
                    // Demo recordings were never uploaded, so there is
                    // nothing on a server for the transcriber to read.
                    !couple?.isDemoMode && todayEntry?.[VOICE_FIELD[type]]
                      ? () => handleTranscribeVoice(type, value, setValue)
                      : undefined
                  }
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
                    isAnswered(type) && styles.progressDotFilled,
                  ]}
                />
              ))}
              <Text style={styles.progressText}>
                {allFilled ? 'Ready to send' : `${filledCount} of 3`}
              </Text>
            </View>
            <LunaraButton
              title={allFilled ? 'Send tonight' : 'Answer all three'}
              onPress={handleSubmit}
              loading={submitting}
              disabled={!allFilled}
            />
          </Animated.View>
        )}

        {/* Post-submit states — the single next step, whatever it is tonight */}
        {phase === 'waiting' && partnerHere && (
          <WaitingState partnerName={partnerName} nightsWaiting={nightsWaiting} streak={streak} />
        )}

        {phase === 'waiting' && !partnerHere && (
          <Animated.View entering={FadeIn.duration(duration.base)} style={styles.soloDoneCard}>
            <CoupleCompanion
              state="nesting"
              streak={streak}
              size="lg"
              showLabel
              style={styles.companionSlot}
            />
            <Text style={styles.soloDoneTitle}>Tonight&apos;s safe with the fox</Text>
            <Text style={styles.soloDoneBody}>
              Sealed until your person joins — then you open it together, the
              way every night after this one works.
            </Text>
          </Animated.View>
        )}

        {phase === 'ready_to_reveal' && (
          <RevealReadyState partnerName={partnerName} onReveal={handleReveal} streak={streak} />
        )}

        {phase === 'revealed' && (
          <AlreadyRevealedState
            onView={handleViewRevealed}
            onShare={handleShareNight}
            streak={streak}
            partnerName={partnerName}
          />
        )}

        {/* Streak — the reward once tonight is handled. Before that, the chip
            in the header is enough; a second streak card under the button was
            one more thing to read between someone and "Send tonight". */}
        {couple && partnerHere && isSubmitted && (
          <StreakSpotlight
            streak={streak}
            longestStreak={couple.longestStreak ?? 0}
            atRisk={streakState.atRisk}
            protectedNight={streakState.protectedDate !== null}
          />
        )}

        {/* After the reveal: at most one gentle growth nudge, and only here.
            Priority lives in lib/nudge.ts — don't add cards beside it. */}
        {phase === 'revealed' && <SingleNudgeSlot {...nudge} />}
      </KeyboardAwareScrollViewCompat>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: space.xl },

  // ── Hero ──────────────────────────────────────────────────────────────────
  // Generous, and deliberately so. This block is one creature, one date, one
  // line of copy; crowding it would turn the fox back into an icon.
  hero: { alignItems: 'center', gap: space.md, marginBottom: space.xl },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  headerDone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.xl,
  },
  // Sentence case, not shouted. An uppercase tracked-out date is a dashboard
  // convention and this is not a dashboard.
  dateText: { ...text.caption, color: palette.content[2] },
  heroGreeting: {
    ...text.title,
    color: palette.content[0],
    textAlign: 'center',
    marginTop: space.xs,
  },

  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingVertical: 6,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: tint.streak(0.12),
    borderWidth: 1,
    borderColor: tint.streak(0.24),
  },
  streakChipText: {
    ...text.caption,
    ...tabularNumerals,
    color: palette.accent.streak,
  },

  cards: { gap: space.md, marginBottom: space.xl },

  // The companion sits centred inside cards that are otherwise left-aligned —
  // a creature hugging the left edge reads as an icon, which is the one thing
  // it must not read as.
  companionSlot: { alignSelf: 'center' },

  // ── Submit ────────────────────────────────────────────────────────────────
  submitArea: { marginBottom: space.lg, gap: space.md },
  progressDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: space.xs,
  },
  progressDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
    backgroundColor: tint.cream(0.14),
  },
  progressDotFilled: { backgroundColor: palette.accent.glow },
  progressText: { ...text.caption, marginLeft: space.xs, color: palette.content[2] },

  // ── Invite partner (not paired yet) ───────────────────────────────────────
  // The warmest card in the app that is not the reveal. The product is
  // genuinely incomplete with one person in it, and this card is allowed to say
  // so — but as an invitation, never as a lockout.
  inviteCard: {
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: tint.heart(0.24),
    padding: space.xl,
    gap: space.md,
    marginBottom: space.xl,
    ...elevation.raised,
  },
  inviteHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 1 },
  inviteTitle: { ...text.heading, color: palette.content[0] },
  inviteBody: { ...text.callout, color: palette.content[1], lineHeight: 21 },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: palette.ink[1],
    borderWidth: 1,
    borderColor: palette.ink[4],
  },
  inviteCodeLabel: { ...text.caption, color: palette.content[2] },
  inviteCode: {
    ...text.heading,
    ...tabularNumerals,
    color: palette.content[0],
    letterSpacing: 3,
  },
  inviteBtn: {
    height: 52,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm + 1,
    backgroundColor: palette.accent.heart,
    ...glow.heart,
  },
  inviteBtnText: { ...text.label, color: palette.ink[0] },

  // ── Submitted, but there is nobody to reveal with yet ─────────────────────
  soloDoneCard: {
    // Room before the streak card that follows; they were touching.
    marginBottom: space.xl,
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 0,
    ...elevation.raised,
    padding: space.xl + space.xs,
    alignItems: 'center',
    gap: space.sm + 2,
  },
  soloDoneTitle: { ...text.heading, color: palette.content[0], textAlign: 'center' },
  soloDoneBody: {
    ...text.callout,
    color: palette.content[1],
    textAlign: 'center',
    lineHeight: 21,
  },

  // ── Waiting ───────────────────────────────────────────────────────────────
  // Centred, unlike the other cards. This one is a *scene* — a fox sitting up
  // with a light on — and a scene that is left-aligned reads as a notice.
  waitingCard: {
    // Room before the streak card that follows; they were touching.
    marginBottom: space.xl,
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: tint.glow(0.16),
    paddingVertical: space.xl + space.xs,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    gap: space.md,
    ...elevation.raised,
  },
  waitingTitle: { ...text.heading, color: palette.content[0], textAlign: 'center' },
  waitingBody: {
    ...text.callout,
    color: palette.content[1],
    textAlign: 'center',
    lineHeight: 21,
  },
  waitingActions: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.xs,
    alignSelf: 'stretch',
  },
  nudgeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 46,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    backgroundColor: tint.glow(0.1),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: tint.glow(0.28),
  },
  nudgeBtnSent: {
    backgroundColor: tint.success(0.1),
    borderColor: tint.success(0.26),
  },
  nudgeText: { ...text.caption, color: palette.accent.glow, flexShrink: 1 },
  nudgeTextSent: { color: palette.accent.success },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 46,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    backgroundColor: tint.cream(0.05),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: tint.cream(0.1),
  },
  shareText: { ...text.caption, color: palette.content[1] },

  // ── Reveal ready ──────────────────────────────────────────────────────────
  // The only card in the app that is pink rather than apricot. Both of you are
  // here; that is a love moment, not an action item.
  revealReadyCard: {
    // Room before the streak card that follows; they were touching.
    marginBottom: space.xl,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: tint.heart(0.28),
    backgroundColor: palette.ink[2],
    paddingVertical: space.xl + space.xs,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    gap: space.md,
    overflow: 'hidden',
    ...elevation.raised,
  },
  revealReadyTitle: { ...text.hero, color: palette.content[0], textAlign: 'center' },
  revealReadyBody: {
    ...text.callout,
    color: palette.content[1],
    textAlign: 'center',
    lineHeight: 22,
  },
  revealBtn: { width: '100%', marginTop: space.sm },
  revealBtnGradient: {
    height: 58,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm + 2,
    backgroundColor: palette.accent.heart,
    ...glow.heart,
  },
  revealBtnText: { ...text.label, fontSize: 18, color: palette.ink[0] },

  // ── Already revealed ──────────────────────────────────────────────────────
  revealedCard: {
    // Room before the streak card that follows; they were touching.
    marginBottom: space.xl,
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    // Depth instead of an outline. A 1px hairline on every card is what made
    // three different pieces of content read as three identical boxes.
    borderWidth: 0,
    ...elevation.raised,
    paddingVertical: space.xl + space.xs,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    gap: space.sm + 2,
    overflow: 'hidden',
  },
  revealedMeta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  revealedStreak: {
    ...text.overline,
    color: palette.accent.success,
    textTransform: 'uppercase',
  },
  revealedTitle: { ...text.hero, color: palette.content[0], textAlign: 'center' },
  revealedBody: {
    ...text.callout,
    color: palette.content[1],
    textAlign: 'center',
    lineHeight: 23,
  },
  revealedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xs,
    alignSelf: 'stretch',
  },
  // A real affordance in the accent colour, not grey-on-grey pretending to be
  // a link. Min height keeps it on the 48pt touch floor.
  viewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 46,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: tint.glow(0.1),
    borderWidth: 1,
    borderColor: tint.glow(0.26),
  },
  viewBtnText: { ...text.caption, color: palette.accent.glow },

});
