import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';
import { radius } from '@/constants/tokens';

const GOALS = [
  { key: 'connection', label: 'Feeling more connected', icon: 'heart-outline' as const, color: '#FF9A8B' },
  { key: 'communication', label: 'Communicating more openly', icon: 'chatbubbles-outline' as const, color: '#C3B1E1' },
  { key: 'gratitude', label: 'Noticing the good, daily', icon: 'sunny-outline' as const, color: '#F0C07A' },
  { key: 'growth', label: 'Growing together, gently', icon: 'trending-up-outline' as const, color: '#A8D8A8' },
  { key: 'memories', label: 'Keeping our memories close', icon: 'sparkles-outline' as const, color: '#A5C8FF' },
] as const;

export default function GoalsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(onboarding)/intro');
  };

  return (
    <LinearGradient colors={['#0A0817', '#141127', '#23203D']} style={styles.container}>
      <StarField />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(500)} style={styles.header}>
          <Text style={styles.title}>What brings you closest?</Text>
          <Text style={styles.subtitle}>
            Pick whatever feels true tonight — Lunara will lean into it. Nothing here is permanent.
          </Text>
        </Animated.View>

        <View style={styles.goals}>
          {GOALS.map((goal, i) => {
            const isSelected = selected.has(goal.key);
            return (
              <Animated.View key={goal.key} entering={FadeIn.delay(80 * i).duration(400)}>
                <Pressable
                  style={[
                    styles.goalRow,
                    isSelected && { borderColor: goal.color + '55', backgroundColor: goal.color + '14' },
                  ]}
                  onPress={() => toggle(goal.key)}
                >
                  <View style={[styles.goalIcon, { backgroundColor: goal.color + '20' }]}>
                    <Ionicons name={goal.icon} size={18} color={goal.color} />
                  </View>
                  <Text style={styles.goalLabel}>{goal.label}</Text>
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={isSelected ? goal.color : 'rgba(255,255,255,0.2)'}
                  />
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        <View style={styles.footer}>
          <LunaraButton title="Continue" onPress={handleContinue} />
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 26 },
  header: { marginBottom: 28, gap: 10 },
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
  goals: { gap: 10, marginBottom: 32 },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#1A1730',
    padding: 14,
  },
  goalIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalLabel: { flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: '#F5F2FB' },
  footer: {},
});
