import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Dimensions,
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
import { useApp } from '@/context/AppContext';

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
}

function RevealCard({ label, text, owner, accentColor, delay = 0, myName, partnerName }: RevealCardProps) {
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
        <View style={styles.cardMeta}>
          <Text style={[styles.cardLabel, { color: accentColor }]}>{label}</Text>
          <Text style={styles.cardOwner}>{displayName}</Text>
        </View>
        <Text style={styles.cardText}>{text}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Reaction button ──────────────────────────────────────────────────────────

const REACTIONS = [
  { icon: 'heart', label: 'Love', color: '#FF9A8B' },
  { icon: 'hand-right-outline', label: 'Hug', color: '#C3B1E1' },
  { icon: 'sunny-outline', label: 'Warm', color: '#FFD6A5' },
  { icon: 'star-outline', label: 'Star', color: '#A8D8A8' },
] as const;

// ─── Main reveal screen ───────────────────────────────────────────────────────

export default function RevealScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { todayEntry, couple, user, setMyReaction } = useApp();

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const bottomPad = insets.bottom + 24 + (Platform.OS === 'web' ? 34 : 0);

  const partnerName = couple?.partnerName ?? 'Partner';
  const myName = user?.name ?? 'You';

  useEffect(() => {
    // Haptic burst on mount — moment of reveal
    setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 400);
  }, []);

  if (!todayEntry) {
    return (
      <LinearGradient colors={['#0F0C29', '#302B63']} style={styles.container}>
        <View style={styles.noEntry}>
          <Text style={styles.noEntryText}>No entry found for tonight</Text>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="arrow-back" size={20} color="#9B89C2" />
            <Text style={styles.closeBtnText}>Go back</Text>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#0F0C29', '#1A1635', '#302B63', '#24243E']}
      locations={[0, 0.3, 0.6, 1]}
      style={styles.container}
    >
      <StarField />

      {/* Close button */}
      <Pressable
        style={[styles.closeButton, { top: topPad + 12 }]}
        onPress={() => router.back()}
      >
        <Ionicons name="close" size={22} color="#9B89C2" />
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
           <View>
            <Ionicons name="moon" size={28} color="#C3B1E1" />
          </View>
          <Text style={styles.title}>Tonight's Reveal</Text>
          <Text style={styles.subtitle}>
            A quiet moment just for the two of you
          </Text>
        </Animated.View>

        {/* Grateful pair */}
        <View style={styles.cardPair}>
            <Animated.View style={styles.pairLabel}>
            <View style={[styles.pairDot, { backgroundColor: '#FF9A8B' }]} />
            <Text style={[styles.pairTitle, { color: '#FF9A8B' }]}>Grateful</Text>
          </Animated.View>
          <RevealCard
            label="Grateful"
            text={todayEntry.grateful}
            owner="me"
            accentColor="#FF9A8B"
            delay={200}
            myName={myName}
            partnerName={partnerName}
          />
          {todayEntry.partnerGrateful ? (
            <RevealCard
              label="Grateful"
              text={todayEntry.partnerGrateful}
              owner="partner"
              accentColor="#FF9A8B"
              delay={500}
              myName={myName}
              partnerName={partnerName}
            />
          ) : null}
        </View>

        {/* Cute pair */}
        <View style={styles.cardPair}>
            <Animated.View style={styles.pairLabel}>
            <View style={[styles.pairDot, { backgroundColor: '#C3B1E1' }]} />
            <Text style={[styles.pairTitle, { color: '#C3B1E1' }]}>Cute</Text>
          </Animated.View>
          <RevealCard
            label="Cute"
            text={todayEntry.cute}
            owner="me"
            accentColor="#C3B1E1"
            delay={700}
            myName={myName}
            partnerName={partnerName}
          />
          {todayEntry.partnerCute ? (
            <RevealCard
              label="Cute"
              text={todayEntry.partnerCute}
              owner="partner"
              accentColor="#C3B1E1"
              delay={1000}
              myName={myName}
              partnerName={partnerName}
            />
          ) : null}
        </View>

        {/* Grow pair */}
        <View style={styles.cardPair}>
            <Animated.View style={styles.pairLabel}>
            <View style={[styles.pairDot, { backgroundColor: '#A8D8A8' }]} />
            <Text style={[styles.pairTitle, { color: '#A8D8A8' }]}>Grow</Text>
          </Animated.View>
          <RevealCard
            label="Grow"
            text={todayEntry.grow}
            owner="me"
            accentColor="#A8D8A8"
            delay={1200}
            myName={myName}
            partnerName={partnerName}
          />
          {todayEntry.partnerGrow ? (
            <RevealCard
              label="Grow"
              text={todayEntry.partnerGrow}
              owner="partner"
              accentColor="#A8D8A8"
              delay={1500}
              myName={myName}
              partnerName={partnerName}
            />
          ) : null}
        </View>

        {/* Reactions */}
        <Animated.View style={styles.reactions}>
          <Text style={styles.reactionsLabel}>How did tonight's reveal feel?</Text>
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
                  await setMyReaction(r.label);
                }}
              >
                <Ionicons name={r.icon as any} size={22} color={r.color} />
                <Text style={[styles.reactionLabel, { color: r.color }]}>{r.label}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Back button */}
        <Animated.View style={styles.backSection}>
          <Pressable style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>Done for tonight</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  closeButton: {
    position: 'absolute',
    right: 22,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#1E1B3A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { paddingHorizontal: 22 },

  titleSection: {
    alignItems: 'center',
    marginBottom: 36,
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: '#F8F5FF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
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
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  revealCard: {
    flexDirection: 'row',
    backgroundColor: '#1E1B3A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  cardStripe: { width: 3, flexShrink: 0 },
  cardContent: { flex: 1, padding: 16, gap: 6 },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardOwner: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#7A6D98',
  },
  cardText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#E8E0FF',
    lineHeight: 22,
  },

  reactions: {
    marginTop: 8,
    marginBottom: 24,
    gap: 16,
    alignItems: 'center',
  },
  reactionsLabel: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
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
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    minWidth: 68,
  },
  reactionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },

  backSection: { alignItems: 'center', marginBottom: 16 },
  doneBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  doneBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: '#7A6D98',
  },

  noEntry: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  noEntryText: { fontSize: 16, fontFamily: 'Inter_400Regular', color: '#9B89C2' },
  closeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  closeBtnText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: '#9B89C2' },
});
