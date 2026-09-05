import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';
import { useApp } from '@/context/AppContext';
import { radius } from '@/constants/tokens';

const OPTIONS = [
  {
    key: 'me' as const,
    label: 'I will take care of it',
    sub: 'Your partner gets full access automatically',
    icon: 'person-outline' as const,
  },
  {
    key: 'partner' as const,
    label: 'My partner will handle it',
    sub: 'They can upgrade from their side',
    icon: 'people-outline' as const,
  },
  {
    key: 'later' as const,
    label: "We'll decide together later",
    sub: 'You can always upgrade in Settings',
    icon: 'time-outline' as const,
  },
];

export default function WhoPayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setWhoPays } = useApp();
  const [selected, setSelected] = useState<'me' | 'partner' | 'later' | null>(null);

  const handleSelect = (key: 'me' | 'partner' | 'later') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(key);
  };

  const handleContinue = async () => {
    if (!selected) return;
    await setWhoPays(selected);
    router.push('/(onboarding)/auth');
  };

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
          <Text style={styles.eyebrow}>Subscription</Text>
          <Text style={styles.title}>One of you pays.{'\n'}Both of you get everything.</Text>
          <Text style={styles.subtitle}>
            Lunara Premium unlocks your whole archive, voice notes, your full weekly recap, and
            the complete date-night playbook — for both of you, with a single subscription.
          </Text>
        </Animated.View>

         <Animated.View style={styles.options}>
          {OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              style={[
                styles.option,
                selected === opt.key && styles.optionSelected,
              ]}
              onPress={() => handleSelect(opt.key)}
            >
              <View style={[styles.optionIcon, selected === opt.key && styles.optionIconSelected]}>
                <Ionicons
                  name={opt.icon}
                  size={20}
                  color={selected === opt.key ? '#FF9A8B' : '#C0B8D4'}
                />
              </View>
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, selected === opt.key && styles.optionLabelSelected]}>
                  {opt.label}
                </Text>
                <Text style={styles.optionSub}>{opt.sub}</Text>
              </View>
              {selected === opt.key && (
                <Ionicons name="checkmark-circle" size={22} color="#FF9A8B" />
              )}
            </Pressable>
          ))}
        </Animated.View>

         <Animated.View style={styles.footer}>
          <LunaraButton
            title="Continue"
            onPress={handleContinue}
            disabled={!selected}
          />
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 26 },
  header: { marginBottom: 28, gap: 10 },
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
    lineHeight: 21,
  },
  options: { gap: 12, marginBottom: 32 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
     borderRadius: radius.lg,
     borderCurve: 'continuous',
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
     backgroundColor: '#1A1730',
  },
  optionSelected: {
    borderColor: 'rgba(255,154,139,0.45)',
    backgroundColor: 'rgba(255,154,139,0.08)',
  },
   optionIcon: {},
   optionIconSelected: {},
  optionText: { flex: 1, gap: 2 },
  optionLabel: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#C0B8D4',
  },
  optionLabelSelected: { color: '#F5F2FB' },
  optionSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#948BAC',
  },
  footer: {},
});
