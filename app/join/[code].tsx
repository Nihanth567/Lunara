import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';
import { useApp } from '@/context/AppContext';
import { radius } from '@/constants/tokens';
import {
  isWellFormedInviteCode,
  normalizeInviteCode,
  stashPendingInvite,
} from '@/lib/inviteLinks';

/**
 * `lunara://join/ABC123` — the link a partner shares from the pairing screen.
 *
 * No route answered to it, so the single most important link Lunara sends
 * anyone opened the app straight onto the not-found screen.
 *
 * This screen holds no pairing logic of its own — the pairing screen already
 * knows how to redeem a code, and duplicating that would give the app two ways
 * to join a couple that could drift apart. All this does is work out *where*
 * the tap should land, which depends entirely on who is holding the phone:
 *
 *   signed in, no couple   → pairing, join form, code already filled in
 *   not signed in          → sign-in, with the code kept for the far side
 *   already paired         → a warm "you're already here", not a failed join
 *   malformed code         → a warm way to type it by hand
 *
 * The one case that *can't* be settled here is a code that is well-formed but
 * unknown or expired — only the server knows that, so it is answered where it
 * is redeemed, inline on the pairing screen.
 */
type Outcome = 'working' | 'malformed' | 'already-paired';

export default function JoinDeepLink() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { isLoading, couple, user } = useApp();
  const [outcome, setOutcome] = useState<Outcome>('working');

  const normalized = normalizeInviteCode(code);

  useEffect(() => {
    if (isLoading) return;
    let cancelled = false;

    (async () => {
      if (!isWellFormedInviteCode(normalized)) {
        if (!cancelled) setOutcome('malformed');
        return;
      }

      // A re-tap of an old message by someone who already paired. Not an error
      // and not worth a redirect they didn't ask for.
      if (couple) {
        if (!cancelled) setOutcome('already-paired');
        return;
      }

      // Cold start: no account yet. Keep the code so sign-in can hand it back
      // rather than dropping them on an empty pairing form.
      if (!user) {
        await stashPendingInvite(normalized);
        if (cancelled) return;
        router.replace('/(onboarding)/auth' as never);
        return;
      }

      if (cancelled) return;
      router.replace(`/(onboarding)/pairing?code=${encodeURIComponent(normalized)}` as never);
    })();

    return () => { cancelled = true; };
  }, [couple, isLoading, normalized, router, user]);

  if (outcome === 'working') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#FF9A8B" size="large" />
      </View>
    );
  }

  const malformed = outcome === 'malformed';

  return (
    <LinearGradient
      colors={['#0A0817', '#141127', '#221D40', '#141127', '#0A0817']}
      locations={[0, 0.3, 0.55, 0.8, 1]}
      style={styles.container}
    >
      <StarField />
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
        ]}
      >
        <View style={styles.icon}>
          <Ionicons
            name={malformed ? 'moon-outline' : 'heart-outline'}
            size={26}
            color={malformed ? '#C3B1E1' : '#FF9A8B'}
          />
        </View>

        <Text style={styles.title}>
          {malformed ? 'That link didn’t carry a code' : 'You’re already here'}
        </Text>
        <Text style={styles.body}>
          {malformed
            ? 'Invite links sometimes get clipped on their way through a message. Nothing is lost — ask your partner for the six-character code and type it in.'
            : 'You and your partner are already connected, so there’s nothing to join. Tonight’s three are waiting whenever you are.'}
        </Text>

        <View style={styles.actions}>
          <LunaraButton
            title={malformed ? 'Enter the code' : 'Go to tonight'}
            onPress={() =>
              router.replace((malformed ? '/(onboarding)/pairing' : '/(app)/') as never)
            }
          />
          {malformed && (
            <Pressable style={styles.secondary} onPress={() => router.replace('/(app)/' as never)}>
              <Text style={styles.secondaryText}>Not now</Text>
            </Pressable>
          )}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#0A0817', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Fraunces_600SemiBold',
    color: '#F5F2FB',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  body: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#C0B8D4',
    textAlign: 'center',
    lineHeight: 21,
  },
  actions: { alignSelf: 'stretch', marginTop: 14, gap: 4 },
  secondary: { alignItems: 'center', paddingVertical: 12 },
  secondaryText: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: '#C0B8D4' },
});
