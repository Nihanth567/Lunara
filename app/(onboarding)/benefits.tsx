import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';

const BENEFITS = [
  {
    icon: 'heart-outline' as const,
    color: '#FF9A8B',
    title: 'Feel closer without pressure',
    body: 'The more you notice what you appreciate in each other, the more of it you tend to find',
  },
  {
    icon: 'eye-outline' as const,
    color: '#C3B1E1',
    title: 'Be truly seen',
    body: 'The little moments you point out are often the ones that quietly become your story',
  },
  {
    icon: 'trending-up-outline' as const,
    color: '#A8D8A8',
    title: 'Grow before things get hard',
    body: 'Naming a small thing early is so much softer than letting it grow quietly on its own',
  },
  {
    icon: 'time-outline' as const,
    color: '#FFD6A5',
    title: 'Just a few minutes a night',
    body: 'A few honest minutes each night, and somehow the rest of the day feels lighter too',
  },
  {
    icon: 'lock-closed-outline' as const,
    color: '#A5C8FF',
    title: 'Completely private',
    body: 'What you share here stays between the two of you — no public profiles, no feeds, ever',
  },
] as const;

export default function BenefitsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
        <View style={styles.heroImageFrame}>
          <Image
            source={require('../../assets/images/ob-benefits.jpg')}
            style={styles.heroImage}
            resizeMode="cover"
          />
        </View>

         <Animated.View style={styles.header}>
          <Text style={styles.eyebrow}>Why it works</Text>
          <Text style={styles.title}>Small on purpose.{'\n'}Deeply felt.</Text>
          <Text style={styles.subtitle}>
            Lunara borrows from what actually helps couples stay close — gentle honesty,
            noticing the good, and never letting small things quietly pile up. No therapy-speak,
            no framework to learn. Just three soft questions, every night.
          </Text>
        </Animated.View>

        <View style={styles.benefits}>
          {BENEFITS.map((b, i) => (
            <Animated.View
              key={b.title}
              style={styles.benefitRow}
            >
               <View>
                <Ionicons name={b.icon} size={20} color={b.color} />
              </View>
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitBody}>{b.body}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

         <Animated.View style={styles.footer}>
          <LunaraButton
            title="This sounds right for us"
            onPress={() => router.push('/(onboarding)/who-pays')}
          />
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 26 },
  heroImageFrame: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
  },
  heroImage: { width: '100%', height: '100%' },
  header: { marginBottom: 28, gap: 10 },
  eyebrow: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#C3B1E1',
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
    lineHeight: 23,
  },
  benefits: { gap: 20, marginBottom: 36 },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  benefitText: { flex: 1, gap: 3 },
  benefitTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#F8F5FF',
  },
  benefitBody: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
    lineHeight: 20,
  },
  footer: {},
});
