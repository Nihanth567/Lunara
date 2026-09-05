import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StarField } from '@/components/StarField';
import { radius } from '@/constants/tokens';

const SECTIONS: { heading: string; body?: string; bullets?: { label: string; text: string }[] }[] = [
  {
    heading: '1. Information We Collect',
    bullets: [
      { label: 'Account Data', text: 'Email address, phone number, or credentials supplied via Apple Sign-In or Google Sign-In.' },
      { label: 'Relationship Inputs', text: 'Partner linkage status, routine check-ins, custom nudges, and interactive prompt responses.' },
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
      { label: 'OpenAI', text: 'Generative model processing for contextual relationship guidance.' },
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
    <LinearGradient colors={['#0A0817', '#141127', '#23203D']} style={styles.container}>
      <StarField />
      <Pressable
        style={[styles.closeButton, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        hitSlop={10}
      >
        <Ionicons name="close" size={22} color="#C0B8D4" />
      </Pressable>

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
    backgroundColor: '#1A1730',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { paddingHorizontal: 26 },
  title: { fontSize: 28, fontFamily: 'Fraunces_600SemiBold', color: '#F5F2FB', marginBottom: 4 },
  effectiveDate: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#948BAC', marginBottom: 24 },
  section: { marginBottom: 22, gap: 8 },
  heading: { fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#F5F2FB' },
  body: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: '#C0B8D4', lineHeight: 21 },
  bulletList: { gap: 10, marginTop: 2 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#C3B1E1',
    marginTop: 7,
  },
  bulletText: { flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: '#C0B8D4', lineHeight: 21 },
  bulletLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#DCD1EF' },
  link: { color: '#C3B1E1', textDecorationLine: 'underline' },
});
