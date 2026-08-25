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
          <Text style={styles.eyebrow}>Subscription</Text>
          <Text style={styles.title}>One of you pays.{'\n'}Both of you get everything.</Text>
          <View style={styles.pricePill}>
            <Text style={styles.priceText}>$4.99 / month  ·  $29.99 / year</Text>
          </View>
          <Text style={styles.subtitle}>
            Lunara Premium unlocks unlimited history, voice notes, photos, custom prompts,
            and full widget customization — for both of you, with a single subscription.
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
                  color={selected === opt.key ? '#FF9A8B' : '#9B89C2'}
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
  pricePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,154,139,0.12)',
     borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,154,139,0.25)',
  },
  priceText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#FF9A8B',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
    lineHeight: 21,
  },
  options: { gap: 12, marginBottom: 32 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
     borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
     backgroundColor: '#1E1B3A',
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
    fontFamily: 'Inter_500Medium',
    color: '#9B89C2',
  },
  optionLabelSelected: { color: '#F8F5FF' },
  optionSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#7A6D98',
  },
  footer: {},
});
