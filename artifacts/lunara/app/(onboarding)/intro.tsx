import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';

const CARDS = [
  {
    type: 'grateful',
    title: 'Grateful',
    body: 'Something specific you love or appreciate about your partner today',
    icon: 'heart-outline' as const,
    color: '#FF9A8B',
  },
  {
    type: 'cute',
    title: 'Cute',
    body: 'A cute, funny, or sweet moment you shared or noticed today',
    icon: 'happy-outline' as const,
    color: '#C3B1E1',
  },
  {
    type: 'grow',
    title: 'Grow',
    body: 'One gentle, positive thing you would love to try or improve together',
    icon: 'trending-up-outline' as const,
    color: '#A8D8A8',
  },
] as const;

export default function IntroScreen() {
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
           <Animated.View style={styles.header}>
          <Text style={styles.eyebrow}>Your daily ritual</Text>
          <Text style={styles.title}>Three soft questions,{'\n'}every night.</Text>
          <Text style={styles.subtitle}>
            Each of you answers privately. Then you reveal your responses together —
            a quiet, beautiful moment before bed.
          </Text>
          <View style={styles.durationBadge}>
            <Ionicons name="time-outline" size={13} color="#FF9A8B" />
            <Text style={styles.durationText}>Takes just 1–2 minutes</Text>
          </View>
        </Animated.View>

        <View style={styles.heroImageFrame}>
          <Image
            source={require('../../assets/images/ob-intro.jpg')}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.heroImageShade} />
        </View>

        <View style={styles.cards}>
          {CARDS.map((card, i) => (
            <Animated.View
              key={card.type}
            >
              <View
                style={[
                  styles.card,
                   { borderColor: card.color + '40', backgroundColor: '#1E1B3A' },
                ]}
              >
                 <View>
                  <Ionicons name={card.icon} size={20} color={card.color} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: card.color }]}>{card.title}</Text>
                  <Text style={styles.cardDesc}>{card.body}</Text>
                </View>
              </View>
            </Animated.View>
          ))}
        </View>

         <Animated.View style={styles.footer}>
          <LunaraButton title="Continue" onPress={() => router.push('/(onboarding)/benefits')} />
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 26 },
  header: { marginBottom: 28, gap: 10 },
  heroImageFrame: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
  },
  heroImage: { width: '100%', height: '100%' },
  heroImageShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
    backgroundColor: 'rgba(15,12,41,0.4)',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  eyebrow: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#FF9A8B',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 34,
    fontFamily: 'Inter_700Bold',
    color: '#F8F5FF',
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
    lineHeight: 24,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,154,139,0.1)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,154,139,0.2)',
  },
  durationText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#FF9A8B',
  },
  cards: { gap: 12, marginBottom: 32 },
  card: {
     borderRadius: 12,
    borderWidth: 1,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  cardDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#9B89C2', lineHeight: 20 },
  footer: {},
});
