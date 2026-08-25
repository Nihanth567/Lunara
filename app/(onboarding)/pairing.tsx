import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';
import { useApp } from '@/context/AppContext';

type Mode = 'choose' | 'create' | 'join';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function PairingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { createCouple, joinCouple, setCouple } = useApp();

  const [mode, setMode] = useState<Mode>('choose');
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleShareCode = () => {
    Share.share({
      message: `Join me on Lunara — our private daily ritual app. Enter code ${inviteCode} or use this link: lunara://join/${inviteCode}`,
      title: 'Join me on Lunara',
    });
  };

  const handleCreateCouple = async () => {
    router.push('/(onboarding)/tutorial');
  };

  const handleJoinCouple = async () => {
    if (joinCode.length < 6) return;
    setLoading(true);
    try {
      await joinCouple(joinCode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/(onboarding)/tutorial');
    } catch (error) {
      Alert.alert('Could not join this couple', error instanceof Error ? error.message : 'Please check the code and try again.');
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
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
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
      <LinearGradient colors={['#0F0C29', '#1A1635', '#24243E']} style={styles.container}>
        <StarField />
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => setMode('choose')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#9B89C2" />
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
            <Ionicons name="time-outline" size={16} color="#9B89C2" />
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
      <LinearGradient colors={['#0F0C29', '#1A1635', '#24243E']} style={styles.container}>
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
            <Ionicons name="arrow-back" size={22} color="#9B89C2" />
          </Pressable>

           <Animated.View style={styles.header}>
            <Text style={styles.title}>Enter the code{'\n'}from your partner</Text>
            <Text style={styles.subtitle}>
              Ask them to share their invite code from Lunara
            </Text>
          </Animated.View>

           <Animated.View style={styles.joinInput}>
            <TextInput
              style={styles.codeInput}
              value={joinCode}
              onChangeText={(t) => setJoinCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="XXXXXX"
              placeholderTextColor="rgba(255,255,255,0.2)"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              autoFocus
            />
          </Animated.View>

           <Animated.View>
            <LunaraButton
              title="Join couple"
              onPress={handleJoinCouple}
              loading={loading}
              disabled={joinCode.length < 6}
            />
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    );
  }

  // ─── Choose mode ───────────────────────────────────────────────────────────

  return (
    <LinearGradient colors={['#0F0C29', '#1A1635', '#24243E']} style={styles.container}>
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
            <Ionicons name="chevron-forward" size={20} color="#7A6D98" />
          </Pressable>

          <Pressable style={styles.bigOption} onPress={() => setMode('join')}>
            <View style={[styles.bigOptionIcon, styles.iconLavender]}>
              <Ionicons name="enter-outline" size={28} color="#C3B1E1" />
            </View>
            <View style={styles.bigOptionText}>
              <Text style={styles.bigOptionTitle}>Join an existing couple</Text>
              <Text style={styles.bigOptionSub}>Enter the code from your partner</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#7A6D98" />
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
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#FF9A8B',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    color: '#F8F5FF',
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
    lineHeight: 22,
  },
  options: { gap: 14 },
  bigOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
     backgroundColor: '#1E1B3A',
     borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 20,
  },
   bigOptionIcon: { width: 28, alignItems: 'center' },
   iconLavender: {},
  bigOptionText: { flex: 1, gap: 2 },
  bigOptionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#F8F5FF',
  },
  bigOptionSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
  },
  codeCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(195,177,225,0.2)',
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  codeLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#9B89C2',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  code: {
    fontSize: 44,
    fontFamily: 'Inter_700Bold',
    color: '#F8F5FF',
    letterSpacing: 8,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,154,139,0.12)',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,154,139,0.25)',
  },
  shareText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: '#FF9A8B',
  },
  waitingNote: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  waitingText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
    lineHeight: 19,
  },
  joinInput: { alignItems: 'center' },
  codeInput: {
    fontSize: 38,
    fontFamily: 'Inter_700Bold',
    color: '#F8F5FF',
    letterSpacing: 10,
    textAlign: 'center',
     backgroundColor: '#1E1B3A',
     borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(195,177,225,0.3)',
    paddingVertical: 18,
    paddingHorizontal: 24,
    width: '100%',
  },
  demoRow: { gap: 12, alignItems: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' },
  divLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  divText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#7A6D98' },
  demoBtn: { paddingVertical: 8 },
  demoBtnText: { fontSize: 16, fontFamily: 'Inter_500Medium', color: '#C3B1E1' },
  demoNote: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#7A6D98',
    textAlign: 'center',
    lineHeight: 17,
  },
});
