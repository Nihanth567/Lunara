import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';
import { useApp } from '@/context/AppContext';
import { requestNotificationPermissions, getNotificationPermissionStatus } from '@/services/notifications';

/**
 * A soft pre-ask before the OS permission dialog, whose own wording we can't
 * customize. Only shown once, and only if permission hasn't been decided yet.
 */
async function maybeAskForNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  const status = await getNotificationPermissionStatus();
  if (status !== 'undetermined') return;
  await new Promise<void>((resolve) => {
    Alert.alert(
      'One quiet reminder a night?',
      'If the night is slipping by and you haven’t shared with your partner yet, we’ll send one gentle nudge — never more than that.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve() },
        {
          text: 'Sounds good',
          onPress: async () => {
            await requestNotificationPermissions().catch(() => {});
            resolve();
          },
        },
      ],
    );
  });
}

const { width } = Dimensions.get('window');

const STEPS = [
  {
    icon: 'pencil-outline' as const,
    color: '#FF9A8B',
    title: 'Answer privately',
    body: 'Fill in your three cards — Grateful, Cute, Grow. Your partner won\'t see your answers until you both reveal.',
    example: 'e.g. "You made me laugh at the exact right moment today"',
    image: require('../../assets/images/tutorial-1.jpg'),
  },
  {
    icon: 'time-outline' as const,
    color: '#C3B1E1',
    title: 'Wait for each other',
    body: 'Once you share your answers, you\'ll see when your partner has also shared theirs.',
    example: 'A gentle nudge can be sent if they forget',
    image: require('../../assets/images/tutorial-2.jpg'),
  },
  {
    icon: 'sparkles-outline' as const,
    color: '#FFD6A5',
    title: 'Reveal together',
    body: 'When you\'re both ready, tap Reveal — and see what your partner wrote just for you.',
    example: 'A quiet, beautiful moment every night',
    image: require('../../assets/images/tutorial-3.jpg'),
  },
];

export default function TutorialScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completeOnboarding, couple } = useApp();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const handleNext = async () => {
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    setLoading(true);
    await maybeAskForNotifications();
    await completeOnboarding();
    setLoading(false);
    router.replace('/(app)/' as never);
    if (couple) {
      router.push('/keepsakes?intro=1' as never);
    }
  };

  return (
    <LinearGradient colors={['#0F0C29', '#1A1635', '#302B63', '#0F0C29']} style={styles.container}>
      <StarField />
      <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 44 }]}>

        {/* Step dots */}
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === step && styles.dotActive,
                i < step && styles.dotPast,
              ]}
            />
          ))}
        </View>

        {/* Main card */}
         <Animated.View key={step} style={styles.card}>
           <View style={styles.stepImageFrame}>
             <Image
               source={current.image}
               style={styles.stepImage}
               resizeMode="cover"
             />
           </View>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.body}>{current.body}</Text>
          <View style={styles.exampleBubble}>
            <Text style={styles.exampleText}>{current.example}</Text>
          </View>
        </Animated.View>

        {/* Partner greeting for demo mode */}
        {isLast && couple?.isDemoMode && (
           <Animated.View style={styles.demoGreeting}>
             <View>
              <Ionicons name="moon" size={20} color="#C3B1E1" />
            </View>
            <View style={styles.demoText}>
              <Text style={styles.demoName}>Luna is waiting for you</Text>
              <Text style={styles.demoSub}>She has already shared her thoughts for tonight</Text>
            </View>
          </Animated.View>
        )}

        {/* Button */}
        <View style={styles.footer}>
          <LunaraButton
            title={isLast ? (couple?.isDemoMode ? 'Open Lunara' : "Let's begin") : 'Next'}
            onPress={handleNext}
            loading={loading}
          />
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dotActive: { backgroundColor: '#FF9A8B', width: 24 },
  dotPast: { backgroundColor: 'rgba(255,154,139,0.4)' },
  card: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 8,
  },
  stepImageFrame: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  stepImage: { width: '100%', height: '100%' },
  title: {
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    color: '#F8F5FF',
    textAlign: 'center',
  },
  body: {
    fontSize: 17,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
    textAlign: 'center',
    lineHeight: 26,
  },
  exampleBubble: {
     backgroundColor: '#1E1B3A',
     borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  exampleText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#C3B1E1',
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  demoGreeting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(195,177,225,0.1)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(195,177,225,0.2)',
    padding: 16,
    marginBottom: 8,
    width: '100%',
  },
  demoText: { flex: 1, gap: 2 },
  demoName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#F8F5FF',
  },
  demoSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
  },
  footer: { width: '100%' },
});
