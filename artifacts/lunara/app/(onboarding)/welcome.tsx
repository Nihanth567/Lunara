import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';

const { width } = Dimensions.get('window');

function LunaMoon() {
  const pulse = useSharedValue(1);
  const glowOpacity = useSharedValue(0.5);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.12, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    glowOpacity.value = withRepeat(
      withTiming(0.9, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={styles.moonContainer}>
      <Animated.View style={[styles.moonAmbient, glowStyle]} />
      <Animated.View style={[styles.moonRing, pulseStyle]} />
      <View style={styles.moonBody} />
    </View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Staggered fade-in animations
  const moonOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(14);
  const actionsOpacity = useSharedValue(0);
  const actionsY = useSharedValue(14);

  useEffect(() => {
    moonOpacity.value = withTiming(1, { duration: 600 });
    titleOpacity.value = withDelay(100, withTiming(1, { duration: 450 }));
    titleY.value = withDelay(100, withTiming(0, { duration: 450 }));
    actionsOpacity.value = withDelay(180, withTiming(1, { duration: 400 }));
    actionsY.value = withDelay(180, withTiming(0, { duration: 400 }));
  }, []);

  const moonStyle = useAnimatedStyle(() => ({ opacity: moonOpacity.value }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));
  const actionsStyle = useAnimatedStyle(() => ({
    opacity: actionsOpacity.value,
    transform: [{ translateY: actionsY.value }],
  }));

  return (
    <LinearGradient
      colors={['#0F0C29', '#1A1635', '#302B63', '#1A1635', '#0F0C29']}
      locations={[0, 0.25, 0.5, 0.75, 1]}
      style={styles.container}
    >
      <StarField />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 70,
            paddingBottom: insets.bottom + 44,
          },
        ]}
      >
        {/* Moon */}
        <Animated.View style={[styles.moonSection, moonStyle]}>
          <LunaMoon />
        </Animated.View>

        {/* Wordmark + tagline */}
        <Animated.View style={[styles.titleSection, titleStyle]}>
          <Text style={styles.wordmark}>Lunara</Text>
          <Text style={styles.tagline}>A soft daily ritual for couples</Text>
        </Animated.View>

        {/* Actions */}
        <Animated.View style={[styles.actions, actionsStyle]}>
          <LunaraButton
            title="Get Started"
            onPress={() => router.push('/(onboarding)/intro')}
          />
          <Pressable
            onPress={() => router.push('/(onboarding)/auth')}
            style={styles.signInRow}
          >
            <Text style={styles.signInText}>Already have an account?</Text>
            <Text style={styles.signInAction}> Sign in</Text>
          </Pressable>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  moonSection: { alignItems: 'center', justifyContent: 'center' },
  moonContainer: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moonAmbient: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(195,177,225,0.08)',
    shadowColor: '#C3B1E1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 50,
    elevation: 8,
  },
  moonRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    borderColor: 'rgba(195,177,225,0.2)',
  },
  moonBody: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F0EBFF',
    shadowColor: '#F8F5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 24,
    elevation: 12,
  },
  titleSection: { alignItems: 'center', gap: 10 },
  wordmark: {
    fontSize: 54,
    fontFamily: 'Inter_700Bold',
    color: '#F8F5FF',
    letterSpacing: 3,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 17,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  actions: {
    width: '100%',
    alignItems: 'center',
    gap: 18,
  },
  signInRow: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  signInText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#7A6D98',
  },
  signInAction: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: '#C3B1E1',
  },
});
