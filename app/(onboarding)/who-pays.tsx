import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '@/lib/haptics';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';
import { SpringPressable } from '@/components/SpringPressable';
import { useApp } from '@/context/AppContext';
import { pressScale, radius } from '@/constants/tokens';
import { palette } from '@/constants/colors';

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
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      await setWhoPays(selected);
      router.push('/(onboarding)/pro-preview');
    } catch {
      // Unhandled, a failed write left Continue doing nothing at all.
      haptic.error();
      Alert.alert('That didn’t save', 'Something got in the way just now. Try once more.');
    } finally {
      setSaving(false);
    }
  };

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
            <SpringPressable
              key={opt.key}
              style={[
                styles.option,
                selected === opt.key && styles.optionSelected,
              ]}
              scaleTo={pressScale.card}
              // Choosing between options is a selection, not a tap.
              haptic="selection"
              accessibilityRole="radio"
              accessibilityState={{ selected: selected === opt.key }}
              accessibilityLabel={`${opt.label}. ${opt.sub}`}
              onPress={() => setSelected(opt.key)}
            >
              <View style={[styles.optionIcon, selected === opt.key && styles.optionIconSelected]}>
                <Ionicons
                  name={opt.icon}
                  size={20}
                  color={selected === opt.key ? palette.accent.glow : palette.content[1]}
                />
              </View>
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, selected === opt.key && styles.optionLabelSelected]}>
                  {opt.label}
                </Text>
                <Text style={styles.optionSub}>{opt.sub}</Text>
              </View>
              {selected === opt.key && (
                <Ionicons name="checkmark-circle" size={22} color={palette.accent.glow} />
              )}
            </SpringPressable>
          ))}
        </Animated.View>

         <Animated.View style={styles.footer}>
          <LunaraButton
            title="Continue"
            onPress={handleContinue}
            disabled={!selected}
            loading={saving}
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
    fontFamily: 'Nunito_600SemiBold',
    color: palette.accent.glow,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
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
    borderColor: 'rgba(247, 241, 232,0.1)',
     backgroundColor: palette.ink[2],
  },
  optionSelected: {
    borderColor: 'rgba(255, 184, 107,0.45)',
    backgroundColor: 'rgba(255, 184, 107,0.08)',
  },
   optionIcon: {},
   optionIconSelected: {},
  optionText: { flex: 1, gap: 2 },
  optionLabel: {
    fontSize: 16,
    fontFamily: 'Nunito_600SemiBold',
    color: palette.content[1],
  },
  optionLabelSelected: { color: palette.content[0] },
  optionSub: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: palette.content[2],
  },
  footer: {},
});
