import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Share,
  ScrollView,
  Alert,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';
import { SpringPressable } from '@/components/SpringPressable';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { haptic } from '@/lib/haptics';
import { GuestSignInError, useApp } from '@/context/AppContext';
import { maybeAskForNotifications } from '@/services/notifications';
import { toDateKey } from '@/lib/streak';
import { hitSlopFor, pressScale, radius } from '@/constants/tokens';
import { palette, tint } from '@/constants/colors';
import {
  INVITE_CODE_LENGTH,
  clearPendingInvite,
  inviteShareMessage,
  isWellFormedInviteCode,
  normalizeInviteCode,
  readPendingInvite,
} from '@/lib/inviteLinks';

type Mode = 'choose' | 'create' | 'join';

/**
 * The end of onboarding — every path out of this screen goes through here.
 *
 * ─── Why pairing is the last screen ──────────────────────────────────────────
 *
 * It used to be followed by a tutorial, a "who pays" explainer and a Premium
 * preview: three screens between someone finishing setup and seeing the thing
 * they signed up for. Every one of them was a screen about the app rather than
 * the app, and the last of them pushed a paywall at a person who had not yet
 * had a single good night in the product. Nothing sells a couples app like the
 * first mutual reveal, and nothing kills one like being charged before it.
 *
 * So the chain is now promise → fox → both of you → auth → invite, and this is
 * the door. The three cut screens still exist and are still routable; they are
 * simply no longer in the way. Premium is introduced later, from inside the
 * product, once there is something to be premium *about*.
 */
async function finishOnboarding(
  registerPushToken: () => Promise<void>,
  completeOnboarding: () => Promise<void>,
): Promise<void> {
  await maybeAskForNotifications(registerPushToken);
  await completeOnboarding();
}

/** Room under the code field for the Join button: its height plus the gap above it. */
const JOIN_BUTTON_CLEARANCE = 58 + 28 + 16;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function PairingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    user,
    isGuest,
    createCouple,
    joinCouple,
    joinCoupleAsGuest,
    setCouple,
    completeOnboarding,
    registerPushToken,
  } = useApp();
  // `code` arrives from an invite link (lunara://join/<code> → app/join/[code].tsx);
  // `intent=invite` from signing in after choosing "Invite my partner".
  const { code: invitedCode, intent } = useLocalSearchParams<{ code?: string; intent?: string }>();
  const prefilled = normalizeInviteCode(invitedCode);

  /**
   * The joining partner doesn't sign in with Apple or Google — they give a
   * name here and an anonymous account is made for them on Join. A guest whose
   * first code didn't work still has that account, so they keep the name field.
   */
  const joinsAsGuest = !user || isGuest;

  // Someone who followed an invite link came here to join, not to choose —
  // open straight onto the join form with their code already in it, so all
  // that's left is the one tap they came for.
  const [mode, setMode] = useState<Mode>(prefilled ? 'join' : 'choose');
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState(prefilled);
  const [guestName, setGuestName] = useState(user?.name ?? '');
  const [loading, setLoading] = useState(false);
  /**
   * Why a join didn't work, shown inline under the field rather than in an
   * Alert. A modal that has to be dismissed before the code is even visible
   * again is the wrong shape for "check this and try once more" — and this is
   * the screen where a mistyped or expired code is the *expected* outcome, not
   * an exceptional one.
   */
  const [joinError, setJoinError] = useState<string | null>(null);
  /** So "next" on the name field lands in the code field. */
  const codeInputRef = useRef<TextInput>(null);

  /**
   * An invite tapped before signing in. `app/join/[code].tsx` stashed the code
   * and sent them to auth; this is the far side of that detour, so the code
   * they tapped is waiting for them instead of an empty field.
   */
  useEffect(() => {
    if (prefilled) return;
    let cancelled = false;
    readPendingInvite().then((pending) => {
      if (cancelled || !pending) return;
      setJoinCode(pending);
      setMode('join');
    });
    return () => { cancelled = true; };
  }, [prefilled]);

  const handleShareCode = () => {
    // A dismissed share sheet rejects on some platforms; that's a choice, not
    // a failure, and must not surface as an unhandled promise.
    Share.share({
      message: inviteShareMessage(inviteCode),
      title: 'Join me on Lunara',
    }).catch(() => {});
  };

  /**
   * The last step of onboarding, from either path. Unguarded, a failed local
   * write here rejected into nothing and "Continue to app" became a button
   * that did nothing — on the one tap between someone and the product.
   */
  const enterApp = async () => {
    try {
      await finishOnboarding(registerPushToken, completeOnboarding);
      router.replace('/(app)/' as never);
    } catch {
      haptic.error();
      Alert.alert('Almost in', 'Something got in the way opening Lunara. Try once more.');
    }
  };

  const handleCreateCouple = async () => {
    if (loading) return;
    setLoading(true);
    await enterApp();
    setLoading(false);
  };

  /**
   * Only the server can tell a real code from one that's expired, already used,
   * or simply never existed — so every one of those arrives here as a failed
   * RPC. They are all the same thing to the person holding the phone ("this
   * code isn't working"), and none of them are their fault, so they get one
   * warm sentence and the field they need, rather than a raw Postgres message.
   */
  const handleJoinCouple = async () => {
    const code = normalizeInviteCode(joinCode);
    if (!isWellFormedInviteCode(code)) return;
    if (joinsAsGuest && guestName.trim().length < 2) return;
    Keyboard.dismiss();
    setLoading(true);
    setJoinError(null);
    try {
      if (joinsAsGuest) await joinCoupleAsGuest(guestName, code);
      else await joinCouple(code);
    } catch (error) {
      haptic.error();
      setJoinError(
        error instanceof GuestSignInError
          ? 'We couldn’t set up your place in Lunara just now. Check your connection and try again — your code is still here.'
          : 'That code isn’t opening anything on our side. Codes expire once a couple is full, so it may already have been used — ask your partner to share a fresh one from their Lunara.',
      );
      setLoading(false);
      return;
    }
    // Joined. Nothing past this point is the code's fault, so a failure here
    // must not be reported as one — retrying the join would now genuinely fail,
    // because this person already fills the couple.
    haptic.success();
    await clearPendingInvite().catch(() => {});
    await enterApp();
    setLoading(false);
  };

  const handleStartNewCouple = async () => {
    setLoading(true);
    try {
      const couple = await createCouple();
      setInviteCode(couple.inviteCode);
      setMode('create');
    } catch (error) {
      haptic.error();
      Alert.alert(
        'Your invite didn’t come through',
        `${error instanceof Error && error.message ? error.message : 'We couldn’t reach Lunara just now.'} Try again in a moment.`,
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Starting a couple is the one path that asks for Apple or Google: the person
   * who invites holds the account the couple is built around. Signed out (or
   * only a guest), they sign in first and come back with `intent=invite`.
   */
  const handleInvite = () => {
    if (joinsAsGuest) {
      router.push('/(onboarding)/auth?intent=invite' as never);
      return;
    }
    void handleStartNewCouple();
  };

  // Back from sign-in after choosing "Invite my partner": go straight on to the
  // code they asked for rather than asking the same question twice.
  const autoInvitedRef = useRef(false);
  useEffect(() => {
    if (intent !== 'invite' || autoInvitedRef.current || joinsAsGuest) return;
    autoInvitedRef.current = true;
    void handleStartNewCouple();
  }, [intent, joinsAsGuest]);

  const handleDemoMode = async () => {
    setLoading(true);
    try {
      await setCouple({
        id: generateId(),
        partnerName: 'Luna',
        partnerJoined: true,
        startDate: toDateKey(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
        currentStreak: 7,
        longestStreak: 7,
        inviteCode: 'DEMO01',
        isDemoMode: true,
        isSubscribed: false,
        // Demo seeds seven completed nights; AppContext derives the real total
        // from those entries, so this is only the value before they load.
        togetherPoints: 7,
      });
    } catch {
      // Unhandled, a failed local write left this link reading "Setting up
      // demo..." forever.
      setLoading(false);
      haptic.error();
      Alert.alert('The demo didn’t start', 'Something went wrong setting it up. Try once more.');
      return;
    }
    setLoading(false);
    haptic.success();
    await enterApp();
  };

  // ─── Create mode ───────────────────────────────────────────────────────────

  if (mode === 'create') {
    return (
      <LinearGradient colors={[palette.ink[0], palette.ink[1], palette.ink[3]]} style={styles.container}>
        <StarField />
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <SpringPressable
            onPress={() => setMode('choose')}
            style={styles.backBtn}
            scaleTo={pressScale.icon}
            hitSlop={hitSlopFor(30)}
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={22} color={palette.content[1]} />
          </SpringPressable>

           <Animated.View style={styles.header}>
            <Text style={styles.title}>Share this code{'\n'}with your partner</Text>
            <Text style={styles.subtitle}>
              They enter it in Lunara to join your private space
            </Text>
          </Animated.View>

           <Animated.View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Your invite code</Text>
            <Text style={styles.code}>{inviteCode}</Text>
            <SpringPressable style={styles.shareButton} onPress={handleShareCode}>
              <Ionicons name="share-outline" size={18} color={palette.accent.glow} />
              <Text style={styles.shareText}>Share invite link</Text>
            </SpringPressable>
          </Animated.View>

           <Animated.View style={styles.waitingNote}>
            <Ionicons name="time-outline" size={16} color={palette.content[1]} />
            <Text style={styles.waitingText}>
              You can start tonight while you wait
            </Text>
          </Animated.View>

           <Animated.View style={{ gap: 12 }}>
            <LunaraButton title="Continue to app" onPress={handleCreateCouple} loading={loading} />
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    );
  }

  // ─── Join mode ─────────────────────────────────────────────────────────────

  if (mode === 'join') {
    return (
      <LinearGradient colors={[palette.ink[0], palette.ink[1], palette.ink[3]]} style={styles.container}>
        <StarField />
        {/* The name field, the code field and the Join button all stay above
            the keyboard — on a small phone the button used to sit under it. */}
        <KeyboardAwareScrollViewCompat
          bottomOffset={JOIN_BUTTON_CLEARANCE}
          keyboardDismissMode="interactive"
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <SpringPressable
            onPress={() => setMode('choose')}
            style={styles.backBtn}
            scaleTo={pressScale.icon}
            hitSlop={hitSlopFor(30)}
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={22} color={palette.content[1]} />
          </SpringPressable>

           <Animated.View style={styles.header}>
            <Text style={styles.title}>Enter the code{'\n'}from your partner</Text>
            <Text style={styles.subtitle}>
              Ask them to share their invite code from Lunara
            </Text>
          </Animated.View>

           <Animated.View style={styles.joinInput}>
            {joinsAsGuest && (
              <View style={styles.nameField}>
                <Text style={styles.nameLabel}>Your name or nickname</Text>
                <TextInput
                  style={styles.nameInput}
                  value={guestName}
                  onChangeText={setGuestName}
                  placeholder="What your partner calls you"
                  placeholderTextColor={tint.cream(0.22)}
                  autoCapitalize="words"
                  autoComplete="given-name"
                  textContentType="givenName"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => codeInputRef.current?.focus()}
                  maxLength={40}
                  autoFocus
                />
              </View>
            )}
            <TextInput
              ref={codeInputRef}
              style={[styles.codeInput, joinError ? styles.codeInputError : null]}
              value={joinCode}
              onChangeText={(t) => {
                setJoinCode(normalizeInviteCode(t));
                // The moment they start fixing it, stop telling them it's wrong.
                if (joinError) setJoinError(null);
              }}
              placeholder="XXXXXX"
              placeholderTextColor={tint.cream(0.2)}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={INVITE_CODE_LENGTH}
              autoFocus={!joinsAsGuest}
              returnKeyType="join"
              onSubmitEditing={handleJoinCouple}
              accessibilityLabel="Invite code"
            />
            {joinError && (
              <View style={styles.joinErrorRow}>
                <Ionicons name="moon-outline" size={15} color={palette.accent.streak} />
                <Text style={styles.joinErrorText}>{joinError}</Text>
              </View>
            )}
          </Animated.View>

           <Animated.View>
            <LunaraButton
              title="Join couple"
              onPress={handleJoinCouple}
              loading={loading}
              disabled={
                !isWellFormedInviteCode(joinCode) || (joinsAsGuest && guestName.trim().length < 2)
              }
            />
          </Animated.View>
        </KeyboardAwareScrollViewCompat>
      </LinearGradient>
    );
  }

  // ─── Choose mode ───────────────────────────────────────────────────────────

  return (
    <LinearGradient colors={[palette.ink[0], palette.ink[1], palette.ink[3]]} style={styles.container}>
      <StarField />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          styles.chooseContent,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
         <Animated.View style={styles.header}>
          <Text style={styles.title}>Join your partner{'\n'}or invite them?</Text>
        </Animated.View>

         <Animated.View style={styles.options}>
          <SpringPressable
            style={styles.bigOption}
            onPress={handleInvite}
            disabled={loading}
            scaleTo={pressScale.card}
          >
            <View style={styles.bigOptionIcon}>
              <Ionicons name="sparkles-outline" size={28} color={palette.accent.glow} />
            </View>
            <View style={styles.bigOptionText}>
              <Text style={styles.bigOptionTitle}>Invite my partner</Text>
              <Text style={styles.bigOptionSub}>Generate a code to share</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={palette.content[2]} />
          </SpringPressable>

          <SpringPressable
            style={styles.bigOption}
            onPress={() => setMode('join')}
            disabled={loading}
            scaleTo={pressScale.card}
          >
            <View style={[styles.bigOptionIcon, styles.iconLavender]}>
              <Ionicons name="enter-outline" size={28} color={palette.content[1]} />
            </View>
            <View style={styles.bigOptionText}>
              <Text style={styles.bigOptionTitle}>I have an invite code</Text>
              <Text style={styles.bigOptionSub}>Enter the code from your partner</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={palette.content[2]} />
          </SpringPressable>
        </Animated.View>

        {/* `marginTop: 'auto'` in a grown container pins this to the bottom edge. */}
        <SpringPressable
          onPress={handleDemoMode}
          style={styles.demoLink}
          disabled={loading}
          dimWhenDisabled={false}
          feedback="highlight"
          hitSlop={8}
        >
          <Text style={styles.demoLinkText}>
            {loading ? 'Setting up demo…' : 'Explore in demo mode'}
          </Text>
        </SpringPressable>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 26, gap: 28 },
  chooseContent: { flexGrow: 1 },
  backBtn: { alignSelf: 'flex-start', padding: 4, marginBottom: 8 },
  header: { gap: 8 },
  title: {
    fontSize: 26,
    fontFamily: 'Nunito_800ExtraBold',
    color: palette.content[0],
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Nunito_400Regular',
    color: palette.content[1],
    lineHeight: 22,
  },
  options: { gap: 14 },
  bigOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
     backgroundColor: palette.ink[2],
     borderRadius: radius.lg,
     borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(247, 241, 232,0.1)',
    padding: 20,
  },
   bigOptionIcon: { width: 28, alignItems: 'center' },
   iconLavender: {},
  bigOptionText: { flex: 1, gap: 2 },
  bigOptionTitle: {
    fontSize: 16,
    fontFamily: 'Nunito_700Bold',
    color: palette.content[0],
  },
  bigOptionSub: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: palette.content[1],
  },
  codeCard: {
    backgroundColor: 'rgba(247, 241, 232,0.05)',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(247, 241, 232,0.2)',
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  codeLabel: {
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
    color: palette.content[1],
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  code: {
    fontSize: 34,
    fontFamily: 'Nunito_800ExtraBold',
    color: palette.content[0],
    letterSpacing: 8,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255, 184, 107,0.12)',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 107,0.25)',
  },
  shareText: {
    fontSize: 14,
    fontFamily: 'Nunito_600SemiBold',
    color: palette.accent.glow,
  },
  waitingNote: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(247, 241, 232,0.04)',
    borderRadius: radius.md,
    borderCurve: 'continuous',
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(247, 241, 232,0.08)',
  },
  waitingText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: palette.content[1],
    lineHeight: 19,
  },
  joinInput: { alignItems: 'center', gap: 14 },
  nameField: { gap: 6, width: '100%' },
  nameLabel: {
    fontSize: 14,
    fontFamily: 'Nunito_600SemiBold',
    color: palette.content[1],
  },
  nameInput: {
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(247, 241, 232,0.1)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'Nunito_400Regular',
    color: palette.content[0],
  },
  codeInput: {
    fontSize: 34,
    fontFamily: 'Nunito_800ExtraBold',
    color: palette.content[0],
    letterSpacing: 10,
    textAlign: 'center',
     backgroundColor: palette.ink[2],
     borderRadius: radius.lg,
     borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(247, 241, 232,0.3)',
    paddingVertical: 18,
    paddingHorizontal: 24,
    width: '100%',
  },
  codeInputError: { borderColor: 'rgba(240, 199, 94,0.45)' },
  joinErrorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    backgroundColor: 'rgba(240, 199, 94,0.08)',
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(240, 199, 94,0.22)',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  joinErrorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: palette.accent.streak,
    lineHeight: 19,
  },
  demoLink: { marginTop: 'auto', alignSelf: 'center', paddingVertical: 8 },
  demoLinkText: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', color: palette.content[2] },
});
