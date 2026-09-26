import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Keyboard,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { haptic } from '@/lib/haptics';
import { useApp } from '@/context/AppContext';
import { radius, space } from '@/constants/tokens';
import { palette, tint } from '@/constants/colors';

/**
 * One field: the name your partner will see. Birthday and pronouns used to be
 * here too — two optional questions at the exact moment someone is deciding
 * whether this app is worth their evening. Every extra field on a first-run form
 * is a place to leave, so they are gone from onboarding.
 */
/** Room under the field for the Continue button: its height plus the gap above it. */
const BUTTON_CLEARANCE = 58 + 28 + space.lg;

export default function ProfileSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useApp();
  const { intent } = useLocalSearchParams<{ intent?: string }>();

  const [name, setName] = useState(user?.name ?? '');
  const [loading, setLoading] = useState(false);

  const isValid = name.trim().length >= 2;

  const handleContinue = async () => {
    if (!isValid) return;
    Keyboard.dismiss();
    setLoading(true);
    try {
      // Pass through anything already on the profile, so saving a name never
      // clears it.
      await updateProfile({
        name: name.trim(),
        birthday: user?.birthday,
        pronouns: user?.pronouns,
      });
      // Carry "Invite my partner" through, so pairing goes straight to the code.
      router.push((intent === 'invite' ? '/(onboarding)/pairing?intent=invite' : '/(onboarding)/pairing') as never);
    } catch (error: any) {
      haptic.error();
      Alert.alert(
        'Your name didn’t save',
        `${error?.message ?? 'We couldn’t reach Lunara just now.'} It’s still in the field — try again in a moment.`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[palette.ink[0], palette.ink[1], palette.ink[3]]} style={styles.container}>
      <StarField />
      {/* Keeps the field *and* the Continue button under it above the
          keyboard, so the one action on this screen is never hidden. */}
      <KeyboardAwareScrollViewCompat
        bottomOffset={BUTTON_CLEARANCE}
        keyboardDismissMode="interactive"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
         <Animated.View style={styles.header}>
          <Text style={styles.title}>What should your{'\n'}partner call you?</Text>
        </Animated.View>

         <Animated.View style={styles.form}>
          {/* Name */}
          <View style={styles.field}>
            <TextInput
              style={[styles.input, name.length > 0 && styles.inputFilled]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Alex, Mia, Sunshine..."
              placeholderTextColor={tint.cream(0.22)}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={24}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              accessibilityLabel="Your name or nickname"
            />
          </View>

        </Animated.View>

         <Animated.View>
          <LunaraButton
            title="Continue"
            onPress={handleContinue}
            disabled={!isValid}
            loading={loading}
          />
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 26, gap: 28 },
  header: { gap: 8 },
  title: {
    fontSize: 26,
    fontFamily: 'Nunito_800ExtraBold',
    color: palette.content[0],
    lineHeight: 38,
  },
  form: { gap: 20 },
  field: { gap: 6 },
  input: {
     backgroundColor: palette.ink[2],
     borderRadius: radius.lg,
     borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(247, 241, 232,0.1)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'Nunito_400Regular',
    color: palette.content[0],
  },
  inputFilled: {
    borderColor: 'rgba(255, 184, 107,0.35)',
    backgroundColor: 'rgba(255, 184, 107,0.07)',
  },
});
