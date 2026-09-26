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
    // products and with docs/MONETIZATION.md. If those say anything other than
    // $2.99/week and $48/year with a 21-day free trial, this line is the thing
    // that's wrong.
    body: 'Lunara Premium is an auto-renewing subscription, billed weekly ($2.99/week) or yearly ($48/year), each with a 21-day free trial for new subscribers. One subscription covers both partners in a couple. Prices are in US dollars; your local price is shown before you confirm. Payment is charged to your Apple ID account when the free trial ends, and the subscription renews automatically unless canceled at least 24 hours before the end of the current period in your iOS Account Settings.',
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
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.effectiveDate}>Effective Date: August 26, 2026</Text>

        {SECTIONS.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.link ? (
              <SpringPressable
                onPress={() => void Linking.openURL(section.link!).catch(() => {})}
                feedback="highlight"
                accessibilityRole="link"
                accessibilityLabel={`${section.heading} — opens in your browser`}
                style={styles.linkRow}
              >
                <Text style={[styles.body, styles.bodyLink]}>{section.body}</Text>
                <Ionicons name="open-outline" size={14} color={palette.content[1]} />
              </SpringPressable>
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
  bodyLink: { color: palette.content[1], flexShrink: 1 },
  // minHeight keeps the tappable row at the 48pt floor even when the copy is short.
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
});
