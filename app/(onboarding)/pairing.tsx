import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Share,
  ScrollView,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';
import { useApp } from '@/context/AppContext';
import { toDateKey } from '@/lib/streak';
import { radius } from '@/constants/tokens';
import {
  INVITE_CODE_LENGTH,
  clearPendingInvite,
  inviteShareMessage,
  isWellFormedInviteCode,
  normalizeInviteCode,
  readPendingInvite,
} from '@/lib/inviteLinks';

type Mode = 'choose' | 'create' | 'join';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function PairingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { createCouple, joinCouple, setCouple } = useApp();
  // Arrives from an invite link (lunara://join/<code> → app/join/[code].tsx).
  const { code: invitedCode } = useLocalSearchParams<{ code?: string }>();
  const prefilled = normalizeInviteCode(invitedCode);

  // Someone who followed an invite link came here to join, not to choose —
  // open straight onto the join form with their code already in it, so all
  // that's left is the one tap they came for.
  const [mode, setMode] = useState<Mode>(prefilled ? 'join' : 'choose');
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState(prefilled);
  const [loading, setLoading] = useState(false);
  /**
   * Why a join didn't work, shown inline under the field rather than in an
   * Alert. A modal that has to be dismissed before the code is even visible
   * again is the wrong shape for "check this and try once more" — and this is
   * the screen where a mistyped or expired code is the *expected* outcome, not
   * an exceptional one.
   */
  const [joinError, setJoinError] = useState<string | null>(null);

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
    Share.share({
      message: inviteShareMessage(inviteCode),
      title: 'Join me on Lunara',
    });
  };

  const handleCreateCouple = async () => {
    router.push('/(onboarding)/tutorial');
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
    setLoading(true);
    setJoinError(null);
    try {
      await joinCouple(code);
      await clearPendingInvite();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/(onboarding)/tutorial');
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setJoinError(
        'That code isn’t opening anything on our side. Codes expire once a couple is full, so it may already have been used — ask your partner to share a fresh one from their Lunara.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStartNewCouple = async () => {
    setLoading(true);
    try {
      const couple = await createCouple();
      setInviteCode(couple.inviteCode);
      setMode('create');
    } catch (error) {
      Alert.alert('Could not create your invite', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoMode = async () => {
    setLoading(true);
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
    });
    setLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push('/(onboarding)/tutorial');
  };

  // ─── Create mode ───────────────────────────────────────────────────────────

  if (mode === 'create') {
    return (
      <LinearGradient colors={['#0A0817', '#141127', '#23203D']} style={styles.container}>
        <StarField />
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => setMode('choose')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#C0B8D4" />
          </Pressable>

           <Animated.View style={styles.header}>
            <Text style={styles.title}>Share this code{'\n'}with your partner</Text>
            <Text style={styles.subtitle}>
              They enter it in Lunara to join your private space
            </Text>
          </Animated.View>

           <Animated.View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Your invite code</Text>
            <Text style={styles.code}>{inviteCode}</Text>
            <Pressable style={styles.shareButton} onPress={handleShareCode}>
              <Ionicons name="share-outline" size={18} color="#FF9A8B" />
              <Text style={styles.shareText}>Share invite link</Text>
            </Pressable>
          </Animated.View>

           <Animated.View style={styles.waitingNote}>
            <Ionicons name="time-outline" size={16} color="#C0B8D4" />
            <Text style={styles.waitingText}>
              You can keep using Lunara while you wait for your partner to join
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
      <LinearGradient colors={['#0A0817', '#141127', '#23203D']} style={styles.container}>
        <StarField />
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => setMode('choose')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#C0B8D4" />
          </Pressable>

           <Animated.View style={styles.header}>
            <Text style={styles.title}>Enter the code{'\n'}from your partner</Text>
            <Text style={styles.subtitle}>
              Ask them to share their invite code from Lunara
            </Text>
          </Animated.View>

           <Animated.View style={styles.joinInput}>
            <TextInput
              style={[styles.codeInput, joinError ? styles.codeInputError : null]}
              value={joinCode}
              onChangeText={(t) => {
                setJoinCode(normalizeInviteCode(t));
                // The moment they start fixing it, stop telling them it's wrong.
                if (joinError) setJoinError(null);
              }}
              placeholder="XXXXXX"
              placeholderTextColor="rgba(255,255,255,0.2)"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={INVITE_CODE_LENGTH}
              autoFocus
            />
            {joinError && (
              <View style={styles.joinErrorRow}>
                <Ionicons name="moon-outline" size={15} color="#F0C07A" />
                <Text style={styles.joinErrorText}>{joinError}</Text>
              </View>
            )}
          </Animated.View>

           <Animated.View>
            <LunaraButton
              title="Join couple"
              onPress={handleJoinCouple}
              loading={loading}
              disabled={!isWellFormedInviteCode(joinCode)}
            />
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    );
  }

  // ─── Choose mode ───────────────────────────────────────────────────────────

  return (
    <LinearGradient colors={['#0A0817', '#141127', '#23203D']} style={styles.container}>
      <StarField />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
         <Animated.View style={styles.header}>
          <Text style={styles.eyebrow}>Connect</Text>
          <Text style={styles.title}>Ready to connect{'\n'}with your partner?</Text>
          <Text style={styles.subtitle}>
            Create a private shared space, or join one your partner already started
          </Text>
        </Animated.View>

         <Animated.View style={styles.options}>
          <Pressable style={styles.bigOption} onPress={handleStartNewCouple} disabled={loading}>
            <View style={styles.bigOptionIcon}>
              <Ionicons name="sparkles-outline" size={28} color="#FF9A8B" />
            </View>
            <View style={styles.bigOptionText}>
              <Text style={styles.bigOptionTitle}>Start a new couple</Text>
              <Text style={styles.bigOptionSub}>Generate an invite code to share</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#948BAC" />
          </Pressable>

          <Pressable style={styles.bigOption} onPress={() => setMode('join')}>
            <View style={[styles.bigOptionIcon, styles.iconLavender]}>
              <Ionicons name="enter-outline" size={28} color="#C3B1E1" />
            </View>
            <View style={styles.bigOptionText}>
              <Text style={styles.bigOptionTitle}>Join an existing couple</Text>
              <Text style={styles.bigOptionSub}>Enter the code from your partner</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#948BAC" />
          </Pressable>
        </Animated.View>

         <Animated.View style={styles.demoRow}>
          <View style={styles.divider}>
            <View style={styles.divLine} />
            <Text style={styles.divText}>or</Text>
            <View style={styles.divLine} />
          </View>
          <Pressable onPress={handleDemoMode} style={styles.demoBtn} disabled={loading}>
            {loading ? (
              <Text style={styles.demoBtnText}>Setting up demo...</Text>
            ) : (
              <Text style={styles.demoBtnText}>Explore in demo mode</Text>
            )}
          </Pressable>
          <Text style={styles.demoNote}>Meet Luna — your simulated partner — and try the full experience</Text>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 26, gap: 28 },
  backBtn: { alignSelf: 'flex-start', padding: 4, marginBottom: 8 },
  header: { gap: 8 },
  eyebrow: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#FF9A8B',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Fraunces_600SemiBold',
    color: '#F5F2FB',
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#C0B8D4',
    lineHeight: 22,
  },
  options: { gap: 14 },
  bigOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
     backgroundColor: '#1A1730',
     borderRadius: radius.lg,
     borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 20,
  },
   bigOptionIcon: { width: 28, alignItems: 'center' },
   iconLavender: {},
  bigOptionText: { flex: 1, gap: 2 },
  bigOptionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#F5F2FB',
  },
  bigOptionSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#C0B8D4',
  },
  codeCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(195,177,225,0.2)',
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  codeLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#C0B8D4',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  code: {
    fontSize: 40,
    fontFamily: 'Fraunces_600SemiBold',
    color: '#F5F2FB',
    letterSpacing: 8,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,154,139,0.12)',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,154,139,0.25)',
  },
  shareText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#FF9A8B',
  },
  waitingNote: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.md,
    borderCurve: 'continuous',
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  waitingText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#C0B8D4',
    lineHeight: 19,
  },
  joinInput: { alignItems: 'center', gap: 14 },
  codeInput: {
    fontSize: 40,
    fontFamily: 'Fraunces_600SemiBold',
    color: '#F5F2FB',
    letterSpacing: 10,
    textAlign: 'center',
     backgroundColor: '#1A1730',
     borderRadius: radius.lg,
     borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(195,177,225,0.3)',
    paddingVertical: 18,
    paddingHorizontal: 24,
    width: '100%',
  },
  codeInputError: { borderColor: 'rgba(255,214,165,0.45)' },
  joinErrorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    backgroundColor: 'rgba(255,214,165,0.08)',
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,214,165,0.22)',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  joinErrorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#F0C07A',
    lineHeight: 19,
  },
  demoRow: { gap: 12, alignItems: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' },
  divLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  divText: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: '#948BAC' },
  demoBtn: { paddingVertical: 8 },
  demoBtnText: { fontSize: 16, fontFamily: 'PlusJakartaSans_500Medium', color: '#C3B1E1' },
  demoNote: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#948BAC',
    textAlign: 'center',
    lineHeight: 17,
  },
});
