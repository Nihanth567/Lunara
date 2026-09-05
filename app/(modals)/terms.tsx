import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StarField } from '@/components/StarField';
import { radius } from '@/constants/tokens';

interface TermsSection {
  heading: string;
  body: string;
  /** When present the section becomes a link out to the full document. */
  link?: string;
}

const SECTIONS: TermsSection[] = [
  {
    heading: '1. Acceptance of Terms',
    body: 'By downloading or accessing Lunara, you agree to be bound by these terms. If you do not agree, discontinue use immediately.',
  },
  {
    heading: '2. Subscriptions & Billing',
    // The only price written down anywhere in the app. Everywhere a price is
    // *shown* — the paywall's plan rows, its subtitle, the CTA — it comes from
    // RevenueCat's `priceString`, so it is already correct in every storefront
    // and currency. This sentence is the exception because Apple requires the
    // terms to state the price in prose, and prose can't be interpolated from a
    // package that may not have loaded.
    //
    // It must be kept in step by hand with the App Store Connect / Play Console
    // products. If those say anything other than $3/month and $30/year, this
    // line is the thing that's wrong.
    body: 'Lunara Pro offers optional auto-renewing subscriptions ($30/year or $3/month), which may include a 7-day free trial. Charges are billed directly to your Apple ID account upon trial expiration unless canceled at least 24 hours prior in your iOS Account Settings.',
  },
  {
    heading: '3. General Disclaimer',
    body: 'Lunara offers AI-driven tools designed for self-reflection and communication. Lunara is not a licensed medical provider, legal consultant, or clinical therapy service.',
  },
  {
    heading: '4. Standard EULA',
    body: "Except as supplemented herein, usage is governed under Apple's Standard Licensed Application End User License Agreement (EULA). Tap to read it in full.",
    link: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
  },
];

export default function TermsScreen() {
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
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.effectiveDate}>Effective Date: August 26, 2026</Text>

        {SECTIONS.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.link ? (
              <Pressable
                onPress={() => Linking.openURL(section.link!)}
                accessibilityRole="link"
                accessibilityLabel={`${section.heading} — opens in your browser`}
                style={styles.linkRow}
              >
                <Text style={[styles.body, styles.bodyLink]}>{section.body}</Text>
                <Ionicons name="open-outline" size={14} color="#C3B1E1" />
              </Pressable>
            ) : (
              <Text style={styles.body}>{section.body}</Text>
            )}
          </View>
        ))}
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
  bodyLink: { color: '#C3B1E1', flexShrink: 1 },
  // minHeight keeps the tappable row at the 48pt floor even when the copy is short.
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
});
