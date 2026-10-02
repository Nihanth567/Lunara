import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StarField } from '@/components/StarField';
import { SpringPressable } from '@/components/SpringPressable';
import { pressScale, radius } from '@/constants/tokens';
import { palette } from '@/constants/colors';

const SECTIONS: { heading: string; body?: string; bullets?: { label: string; text: string }[] }[] = [
  {
    heading: '1. Information We Collect',
    bullets: [
      { label: 'Account Data', text: 'Your name, and the email address Apple or Google shares when you sign in (Apple lets you hide it). A partner who joins with an invite code can do so with just a name.' },
      { label: 'Relationship Inputs', text: 'Partner linkage status, your nightly answers and any voice notes you record, keepsake answers, shared list items, reactions and nudges.' },
      { label: 'Transactions', text: 'In-app purchase verification handled through RevenueCat and Apple. We do not process or store financial account details.' },
    ],
  },
  {
    heading: '2. How We Use Information',
    body: 'Data is used exclusively to facilitate partner synchronization, execute personalized AI guidance, process active subscription entitlements, and maintain system security.',
  },
  {
    heading: '3. Third-Party Services',
    body: 'Operational data is strictly processed through secure infrastructure providers:',
    bullets: [
      { label: 'Supabase', text: 'Authentication, cloud database, and serverless edge functions.' },
      { label: 'OpenAI', text: 'Generates Grow suggestions from your Grow answers, and transcribes a voice note only when you tap "Turn this into text" on your own recording.' },
      { label: 'RevenueCat & Apple', text: 'Payment receipt validation and subscription state tracking.' },
    ],
  },
  {
    heading: '4. Data Retention & Deletion',
    // App Review reads this screen. It previously said removal happened "by
    // contacting support", which is exactly the answer guideline 5.1.1(v)
    // rejects — and it was also untrue once in-app deletion shipped. Naming
    // the actual path, and being explicit that deletion is immediate and
    // permanent rather than a deactivation, is what the guideline asks for.
    body: 'We transmit all data over encrypted SSL/TLS channels. You can permanently delete your account and everything in it at any time from inside the app: open the Us tab and choose "Delete my account". This erases your profile, every night you have written, your voice notes and your keepsakes immediately and irreversibly — it is a deletion, not a deactivation. Because nights are shared with your partner, your entries are removed from their history too. Deleting your account does not cancel an active subscription; manage that in your Apple ID subscription settings.',
  },
];

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient colors={[palette.ink[0], palette.ink[1], palette.ink[3]]} style={styles.container}>
      <StarField />
      <SpringPressable
        style={[styles.closeButton, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        hitSlop={10}
        scaleTo={pressScale.icon}
        accessibilityLabel="Close"
      >
        <Ionicons name="close" size={22} color={palette.content[1]} />
      </SpringPressable>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.effectiveDate}>Effective Date: August 26, 2026</Text>

        {SECTIONS.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.body && <Text style={styles.body}>{section.body}</Text>}
            {section.bullets && (
              <View style={styles.bulletList}>
                {section.bullets.map((b) => (
                  <View key={b.label} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>
                      <Text style={styles.bulletLabel}>{b.label}: </Text>
                      {b.text}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        <View style={styles.section}>
          <Text style={styles.heading}>5. Contact</Text>
          <Text style={styles.body}>
            For inquiries, reach out to:{' '}
            <Text style={styles.link} onPress={() => Linking.openURL('mailto:support@lunara.app')}>
              support@lunara.app
            </Text>
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  closeButton: {
    position: 'absolute',
    right: 22,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: palette.ink[2],
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { paddingHorizontal: 26 },
  title: { fontSize: 26, fontFamily: 'Nunito_800ExtraBold', color: palette.content[0], marginBottom: 4 },
  effectiveDate: { fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: palette.content[2], marginBottom: 24 },
  section: { marginBottom: 22, gap: 8 },
  heading: { fontSize: 16, fontFamily: 'Nunito_700Bold', color: palette.content[0] },
  body: { fontSize: 14, fontFamily: 'Nunito_400Regular', color: palette.content[1], lineHeight: 21 },
  bulletList: { gap: 10, marginTop: 2 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.content[1],
    marginTop: 7,
  },
  bulletText: { flex: 1, fontSize: 14, fontFamily: 'Nunito_400Regular', color: palette.content[1], lineHeight: 21 },
  bulletLabel: { fontFamily: 'Nunito_700Bold', color: palette.content[1] },
  link: { color: palette.content[1], textDecorationLine: 'underline' },
});
