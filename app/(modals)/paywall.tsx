import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator, ScrollView, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PACKAGE_TYPE, type PurchasesPackage } from 'react-native-purchases';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';
import { getCurrentOffering, isPurchasesConfigured, purchase, restore } from '@/lib/purchases';
import { PRO_FEATURES, freeTierSummary } from '@/lib/entitlements';
import { useApp } from '@/context/AppContext';
import { radius } from '@/constants/tokens';

/** Apple's Standard Licensed Application EULA — the licence Lunara ships under. */
const APPLE_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/**
 * What Pro is comes from `lib/entitlements.ts`, which is also what the Us tab
 * and the onboarding preview render — see the note there for why this screen no
 * longer keeps its own copy of the list.
 */

/** A free intro period, as RevenueCat reports it — never assumed. */
function trialLabel(pkg: PurchasesPackage): string | null {
  const intro = pkg.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  const unit = intro.periodUnit.charAt(0) + intro.periodUnit.slice(1).toLowerCase();
  const label = intro.periodNumberOfUnits === 1 ? unit : `${unit}s`;
  return `${intro.periodNumberOfUnits}-${label} Free Trial`;
}

function periodSuffix(pkg: PurchasesPackage): string {
  if (pkg.packageType === PACKAGE_TYPE.ANNUAL) return '/year';
  if (pkg.packageType === PACKAGE_TYPE.MONTHLY) return '/month';
  return '';
}

/**
 * The one line that has to be exactly true, built entirely from the store's own
 * numbers. It previously read "$39.99/year after a 7-day free trial" as static
 * text — wrong the moment pricing, currency, region, or the trial changed, and
 * it was shown even when RevenueCat had returned no products at all.
 */
function periodNoun(pkg: PurchasesPackage): string {
  if (pkg.packageType === PACKAGE_TYPE.ANNUAL) return 'year';
  if (pkg.packageType === PACKAGE_TYPE.MONTHLY) return 'month';
  return 'period';
}

/**
 * The subscription disclosure, which guideline 3.1.2 requires on the screen
 * where the purchase happens — not only in the Terms.
 *
 * It has to state four things: what the subscription is called, how long one
 * period lasts, what it costs, and that it renews by itself until cancelled.
 * This previously ended with "Cancel anytime", which reads like a reassurance
 * and is not an auto-renewal disclosure — the user is never actually told the
 * charge repeats. Reviewers check for that sentence specifically, and its
 * absence is one of the most common 3.1.2 rejections.
 *
 * A free trial has its own requirement: say what happens when it ends, so the
 * conversion to a paid period is never a surprise.
 *
 * Every number still comes from RevenueCat, so this stays true in any
 * storefront or currency.
 */
function priceSentence(pkg: PurchasesPackage | null): string {
  if (!pkg) return 'One subscription covers both of you.';
  const price = `${pkg.product.priceString}${periodSuffix(pkg)}`;
  const noun = periodNoun(pkg);
  const trial = trialLabel(pkg);
  const renewal = `Automatically renews every ${noun} at ${pkg.product.priceString} until you cancel. Cancel anytime in your Apple ID settings.`;
  return trial
    ? `Lunara Pro — one subscription covers both of you. ${trial}, then ${price}. ${renewal}`
    : `Lunara Pro — one subscription covers both of you. ${price}. ${renewal}`;
}

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const fromOnboarding = source === 'onboarding';
  const { refreshSharedState, refreshEntitlement, canPurchase, couple } = useApp();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  // Onboarding has already completed by the time this screen is reached from
  // there, so closing or finishing here should land in the app, not pop back
  // into the (now-stale) onboarding stack.
  const dismiss = () => {
    if (fromOnboarding) {
      router.replace('/(app)/' as never);
      if (couple) {
        router.push('/keepsakes?intro=1' as never);
      }
    } else {
      router.back();
    }
  };

  useEffect(() => {
    (async () => {
      if (!isPurchasesConfigured()) {
        setLoading(false);
        return;
      }
      try {
        const offering = await getCurrentOffering();
        const available = offering?.availablePackages ?? [];
        setPackages(available);
        const annual = available.find((p) => p.packageType === PACKAGE_TYPE.ANNUAL);
        setSelected(annual ?? available[0] ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const orderedPackages = useMemo(() => {
    const rank = (p: PurchasesPackage) => (p.packageType === PACKAGE_TYPE.ANNUAL ? 0 : p.packageType === PACKAGE_TYPE.MONTHLY ? 1 : 2);
    return [...packages].sort((a, b) => rank(a) - rank(b));
  }, [packages]);

  // The button never promises a trial the store isn't offering on the plan the
  // user actually has selected.
  const ctaTitle = !selected
    ? 'Choose a plan'
    : (trialLabel(selected) ?? null) !== null
      ? `Start ${trialLabel(selected)}`
      : `Subscribe — ${selected.product.priceString}${periodSuffix(selected)}`;

  const handlePurchase = async () => {
    if (!selected || purchasing) return;
    // Demo mode has no couple on the server, so there is nothing a subscription
    // could unlock for two people — and no webhook could ever attribute it. The
    // charge was real; the Pro was not. Nobody pays until there's someone to
    // share it with.
    if (!canPurchase) {
      Alert.alert(
        'Pair with your partner first',
        'You’re exploring Lunara on your own right now. Pro covers both of you, so it’s worth waiting until your partner has joined — then one subscription unlocks it for the two of you.',
      );
      return;
    }
    setPurchasing(true);
    try {
      const entitled = await purchase(selected);
      if (entitled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Unlock from RevenueCat's own answer, right now. `refreshSharedState`
        // only reads the server mirror, which the webhook hasn't written yet —
        // relying on it alone left a paying customer looking at a paywall.
        await refreshEntitlement().catch(() => {});
        await refreshSharedState().catch(() => {});
        dismiss();
      } else {
        Alert.alert(
          'Almost there',
          'The store completed your purchase but hasn’t confirmed it yet. Give it a moment, then tap Restore Purchases.',
        );
      }
    } catch (error: any) {
      if (!error?.userCancelled) {
        Alert.alert('Could not complete purchase', error?.message ?? 'Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (purchasing) return;
    setPurchasing(true);
    try {
      const entitled = await restore();
      if (entitled) {
        // Same reason as above, and more sharply: a restore emits no RevenueCat
        // webhook at all, so the server mirror would never have caught up. This
        // is the line that makes Restore Purchases actually restore anything.
        await refreshEntitlement().catch(() => {});
        await refreshSharedState().catch(() => {});
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        dismiss();
      } else {
        Alert.alert(
          'No active subscription found',
          'Restore looked for a previous purchase on this account but did not find one.',
        );
      }
    } catch (error: any) {
      Alert.alert('Could not restore purchases', error?.message ?? 'Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <LinearGradient colors={['#0A0817', '#141127', '#23203D']} style={styles.container}>
      <StarField />
      <Pressable
        style={[styles.closeButton, { top: insets.top + 12 }]}
        onPress={dismiss}
        hitSlop={10}
      >
        <Ionicons name="close" size={22} color="#C0B8D4" />
      </Pressable>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="sparkles" size={26} color="#FF9A8B" />
          </View>
          <Text style={styles.title}>Unlock Your Shared Galaxy with Lunara Pro</Text>
          <Text style={styles.subtitle}>{priceSentence(selected)}</Text>
          <View style={styles.coversBadge}>
            <Ionicons name="people-outline" size={13} color="#C3B1E1" />
            <Text style={styles.coversBadgeText}>One Subscription Covers Both of You</Text>
          </View>
        </View>

        <View style={styles.features}>
          {PRO_FEATURES.map((f) => (
            <View key={f.text} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon as any} size={16} color="#A8D8A8" />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.guaranteeBanner}>
          <Ionicons name="heart-outline" size={13} color="#948BAC" />
          {/*
            The free tier stated in full, including the archive window — the one
            Pro claim that is also a restriction. Saying "daily prompts and
            partner sync are free" while the first bullet above sells the
            archive told two different stories about the same product.
          */}
          <Text style={styles.guaranteeText}>{freeTierSummary()}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#FF9A8B" style={{ marginVertical: 32 }} />
        ) : !canPurchase ? (
          <View style={styles.demoNotice}>
            <Ionicons name="people-outline" size={16} color="#C3B1E1" />
            <Text style={styles.demoNoticeText}>
              You&apos;re exploring Lunara on your own. Pro is one subscription for two people, so
              it unlocks once your partner has joined you — nothing to pay for until then.
            </Text>
          </View>
        ) : orderedPackages.length === 0 ? (
          <Text style={styles.noOfferings}>
            Subscription plans aren&apos;t configured yet. Add products in RevenueCat and they&apos;ll appear here.
          </Text>
        ) : (
          <View style={styles.packages}>
            {orderedPackages.map((pkg) => {
              const isSelected = selected?.identifier === pkg.identifier;
              const isAnnual = pkg.packageType === PACKAGE_TYPE.ANNUAL;
              const trial = trialLabel(pkg);
              const perMonth = pkg.product.pricePerMonthString;

              return (
                <Pressable
                  key={pkg.identifier}
                  style={[styles.packageOption, isSelected && styles.packageOptionSelected]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelected(pkg);
                  }}
                >
                  {isAnnual && (
                    <View style={styles.badgeRow}>
                      {trial && (
                        <View style={styles.trialBadge}>
                          <Text style={styles.trialBadgeText}>{trial}</Text>
                        </View>
                      )}
                      <View style={styles.valueBadge}>
                        <Text style={styles.valueBadgeText}>
                          Best Value{perMonth ? ` • ${perMonth}/mo` : ''}
                        </Text>
                      </View>
                    </View>
                  )}
                  <View style={styles.packageRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.packageTitle}>{isAnnual ? 'Annual' : pkg.product.title || pkg.identifier}</Text>
                      <Text style={styles.packagePrice}>
                        {pkg.product.priceString}
                        {periodSuffix(pkg)}
                      </Text>
                    </View>
                    <View style={[styles.radio, isSelected && styles.radioSelected]}>
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.footer}>
          <LunaraButton
            title={ctaTitle}
            onPress={handlePurchase}
            loading={purchasing}
            disabled={!selected || !canPurchase}
          />
          <Pressable onPress={dismiss} disabled={purchasing} style={styles.freeBtn}>
            <Text style={styles.freeText}>Continue with Free Version</Text>
          </Pressable>
          <Pressable onPress={handleRestore} disabled={purchasing} style={styles.restoreBtn}>
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </Pressable>
          {/*
            Guideline 3.1.2 requires a subscription screen to link the licence
            terms and the privacy policy. "Terms of Service" alone did not
            satisfy it: the EULA was named in prose on the Terms screen and
            linked from nowhere. Apple's standard agreement is linked directly
            here, which is what Review looks for.
          */}
          <View style={styles.legalRow}>
            <Pressable onPress={() => router.push('/(modals)/terms')}>
              <Text style={styles.legalText}>Terms</Text>
            </Pressable>
            <Text style={styles.legalDivider}>·</Text>
            <Pressable onPress={() => Linking.openURL(APPLE_EULA_URL)}>
              <Text style={styles.legalText}>EULA</Text>
            </Pressable>
            <Text style={styles.legalDivider}>·</Text>
            <Pressable onPress={() => router.push('/(modals)/privacy')}>
              <Text style={styles.legalText}>Privacy Policy</Text>
            </Pressable>
          </View>
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
  header: { alignItems: 'center', gap: 10, marginBottom: 28 },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,154,139,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,154,139,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 28, fontFamily: 'Fraunces_600SemiBold', color: '#F5F2FB', textAlign: 'center' },
  subtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#C0B8D4',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  coversBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(195,177,225,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  coversBadgeText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#C3B1E1' },
  features: { gap: 14, marginBottom: 18 },
  guaranteeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  guaranteeText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#948BAC',
    lineHeight: 17,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(168,216,168,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: '#DCD1EF', flex: 1 },
  noOfferings: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#948BAC',
    textAlign: 'center',
    lineHeight: 19,
    marginVertical: 24,
  },
  demoNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#1A1730',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: 16,
    marginVertical: 12,
  },
  demoNoticeText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#C0B8D4',
    lineHeight: 19,
  },
  packages: { gap: 12, marginBottom: 8 },
  packageOption: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#1A1730',
  },
  packageOptionSelected: {
    borderColor: 'rgba(255,154,139,0.45)',
    backgroundColor: 'rgba(255,154,139,0.08)',
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  trialBadge: {
    backgroundColor: 'rgba(195,177,225,0.16)',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(195,177,225,0.3)',
  },
  trialBadgeText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#C3B1E1' },
  valueBadge: {
    backgroundColor: 'rgba(255,154,139,0.16)',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,154,139,0.32)',
  },
  valueBadgeText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#FF9A8B' },
  packageRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  packageTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#F5F2FB' },
  packagePrice: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: '#C0B8D4', marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: { borderColor: '#FF9A8B' },
  radioDot: { width: 11, height: 11, borderRadius: radius.sm, backgroundColor: '#FF9A8B' },
  footer: { gap: 4, marginTop: 12 },
  freeBtn: { alignItems: 'center', paddingVertical: 10 },
  freeText: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: '#C3B1E1' },
  restoreBtn: { alignItems: 'center', paddingVertical: 4, marginTop: 6 },
  restoreText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: '#C0B8D4' },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  legalText: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: '#948BAC', textDecorationLine: 'underline' },
  legalDivider: { fontSize: 12, color: '#2E2A4C' },
});
