import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  FUNNEL,
  OnboardingFrame,
  OnboardingHeading,
  OnboardingPhoto,
} from '@/components/OnboardingFrame';
import { ONBOARDING_PHOTOS } from '@/assets/images/onboarding';
import { LunaraButton } from '@/components/LunaraButton';
import { useApp } from '@/context/AppContext';
import { useOnboardingFunnel } from '@/hooks/useOnboardingFunnel';
import { requestNotificationPermissions } from '@/services/notifications';
import { haptic } from '@/lib/haptics';
import { palette } from '@/constants/colors';
import { radius, space } from '@/constants/tokens';
import { type as text, maxFontScale } from '@/constants/typography';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * What notifications are for, before the system asks.
 *
 * This screen *is* the reason, so the button goes straight to the system
 * dialog rather than through `askWithReason`'s own sentence — that would be
 * the same explanation twice. The three rows are the three things Lunara
 * actually sends; the list is short because the list is short.
 *
 * Either answer is remembered (`notificationsAsked`), so pairing's last step
 * doesn't ask a second time a minute later.
 */
const REASONS: { icon: IconName; text: string }[] = [
  { icon: 'heart-outline', text: 'When your partner has shared theirs' },
  { icon: 'sparkles-outline', text: 'When tonight is ready to open together' },
  { icon: 'moon-outline', text: 'A gentle reminder at night, if you haven’t written yet' },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const { notificationSettings, setNotificationSettings } = useApp();
  const { markNotificationsAsked } = useOnboardingFunnel();
  const [asking, setAsking] = useState(false);

  const goOn = () => {
    markNotificationsAsked();
    router.push('/(onboarding)/building' as never);
  };

  const turnOn = async () => {
    setAsking(true);
    try {
      const granted = await requestNotificationPermissions().catch(() => false);
      if (granted) {
        await setNotificationSettings({ ...notificationSettings, enabled: true });
        haptic.success();
      }
    } catch {
      // The permission is granted even if scheduling the reminder failed; the
      // Us tab can switch it on again. Not worth stopping onboarding for.
    } finally {
      setAsking(false);
      goOn();
    }
  };

  return (
    <OnboardingFrame
      step={FUNNEL.notifications}
      canGoBack={!asking}
      footer={
        <>
          <LunaraButton title="Turn on notifications" onPress={turnOn} loading={asking} />
          <LunaraButton title="Not now" variant="ghost" onPress={goOn} disabled={asking} />
        </>
      }
    >
      <OnboardingPhoto photo={ONBOARDING_PHOTOS.glow} aspectRatio={16 / 10} />

      <OnboardingHeading
        title="Know when they’re waiting"
        body="Lunara only speaks up when there’s something between the two of you."
      />

      <View style={styles.reasons}>
        {REASONS.map((reason) => (
          <View key={reason.text} style={styles.reason}>
            <Ionicons name={reason.icon} size={20} color={palette.content[1]} />
            <Text style={styles.reasonText} maxFontSizeMultiplier={maxFontScale}>
              {reason.text}
            </Text>
          </View>
        ))}
      </View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  reasons: {
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: space.xl,
    gap: space.lg,
  },
  reason: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  reasonText: { ...text.callout, color: palette.content[0], flex: 1 },
});
