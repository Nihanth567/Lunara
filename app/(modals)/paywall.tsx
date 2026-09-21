import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, Linking } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PACKAGE_TYPE, type PurchasesPackage } from 'react-native-purchases';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';
import { CoupleCompanion } from '@/components/CoupleCompanion';
import { ThinkingOrb } from '@/components/ThinkingOrb';
import {
  defaultPackage,
  getCurrentOffering,
  isPurchasesConfigured,
  orderPackages,
  purchase,
  restore,
} from '@/lib/purchases';
import { PREMIUM_FEATURES, coupleCoverageSummary } from '@/lib/entitlements';
import { useApp } from '@/context/AppContext';
import { track } from '@/lib/analytics';
import { radius, space } from '@/constants/tokens';
import { gradients, palette, tint } from '@/constants/colors';
import { type as text } from '@/constants/typography';

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
  // Weekly is the default plan now, so the one package whose price used to
  // render bare — "$4.99" with no period at all — is the one most people see.
  if (pkg.packageType === PACKAGE_TYPE.WEEKLY) return '/week';
  return '';
}

/**
 * The one line that has to be exactly true, built entirely from the store's own
 * numbers. It previously read "$39.99/year after a 7-day free trial" as static
 * text — wrong the moment pricing, currency, region, or the trial changed, and
 * it was shown even when RevenueCat had returned no products at all.
 */
/** Coarse plan shape for analytics. Never a price. */
function planLabel(pkg: PurchasesPackage | null): string {
  if (!pkg) return 'none';
  if (pkg.packageType === PACKAGE_TYPE.WEEKLY) return 'weekly';
  if (pkg.packageType === PACKAGE_TYPE.ANNUAL) return 'annual';
  if (pkg.packageType === PACKAGE_TYPE.MONTHLY) return 'monthly';
  return 'other';
}

function trialDaysOf(pkg: PurchasesPackage | null): number | undefined {
  const intro = pkg?.product.introPrice;
  if (!intro || intro.price !== 0) return undefined;
  const per = intro.periodUnit === 'WEEK' ? 7 : intro.periodUnit === 'MONTH' ? 30 : 1;
  return intro.periodNumberOfUnits * per;
}

function periodNoun(pkg: PurchasesPackage): string {
  if (pkg.packageType === PACKAGE_TYPE.ANNUAL) return 'year';
  if (pkg.packageType === PACKAGE_TYPE.MONTHLY) return 'month';
  if (pkg.packageType === PACKAGE_TYPE.WEEKLY) return 'week';
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
    ? `Lunara Premium — one subscription covers both of you. ${trial}, then ${price}. ${renewal}`
    : `Lunara Premium — one subscription covers both of you. ${price}. ${renewal}`;
}

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { source, gate } = useLocalSearchParams<{ source?: string; gate?: string }>();
  const fromOnboarding = source === 'onboarding';
  /**
   * Gate mode: this screen is the front door, not an upsell.
   *
   * `app/index.tsx` sends people here when they have no entitlement, and in
   * that mode there is nothing behind the paywall to go back to — so the close
   * button, the swipe-down gesture and the "not now" escape are all removed
   * rather than left pointing at a screen the person is not allowed to see.
   * Restore stays, because App Review requires it and because a returning
   * subscriber's only way back in is through it.
   */
  const isGate = gate === '1';
  const { refreshSharedState, refreshEntitlement, canPurchase, couple, signOut } = useApp();
  // The fox on this screen shows the couple's real streak, so the thing being
  // sold is visibly *theirs* rather than a stock illustration of a product.
  const streak = couple?.currentStreak ?? 0;
  /** Have these two ever finished a night together? Drives the pitch. */
  const hasHistory = (couple?.longestStreak ?? 0) > 0;
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  // Onboarding has already completed by the time this screen is reached from
  // there, so closing or finishing here should land in the app, not pop back
  // into the (now-stale) onboarding stack.
  const dismiss = () => {
    if (isGate) {
      // Nothing to dismiss to. Recorded rather than silently ignored, because
      // "how many people try to leave" is the number that says whether the
      // gate is set at the right place.
      track('paywall_dismiss_blocked', { plan: planLabel(selected), paired: canPurchase });
      return;
    }
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
    track('paywall_view', { source: isGate ? 'gate' : fromOnboarding ? 'onboarding' : 'modal', paired: canPurchase });
  }, [isGate, fromOnboarding, canPurchase]);

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
        // Weekly, not annual — see `packageRank` in lib/purchases.ts.
        setSelected(defaultPackage(available));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const orderedPackages = useMemo(() => orderPackages(packages), [packages]);

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
    track(
      selected.packageType === PACKAGE_TYPE.ANNUAL ? 'paywall_cta_yearly' : 'paywall_cta_weekly_trial',
      { plan: planLabel(selected), trialDays: trialDaysOf(selected), source: isGate ? 'gate' : 'modal' },
    );
    setPurchasing(true);
    try {
      const entitled = await purchase(selected);
      if (entitled) {
        const inTrial = (trialDaysOf(selected) ?? 0) > 0;
        track(inTrial ? 'trial_started' : 'purchase_completed', {
          plan: planLabel(selected),
          trialDays: trialDaysOf(selected),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Unlock from RevenueCat's own answer, right now. `refreshSharedState`
        // only reads the server mirror, which the webhook hasn't written yet —
        // relying on it alone left a paying customer looking at a paywall.
        await refreshEntitlement().catch(() => {});
        await refreshSharedState().catch(() => {});
        track('couple_premium_granted', { plan: planLabel(selected), paired: canPurchase });
        // In gate mode there is no screen underneath to return to, so this is
        // the moment the app actually opens.
        if (isGate) {
          router.replace('/(app)/' as never);
        } else {
          dismiss();
        }
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
        // Only once it actually found something — firing on entry counted every
        // tap of the button as a successful restore.
        track('restore_completed', { source: isGate ? 'gate' : 'modal' });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (isGate) {
          router.replace('/(app)/' as never);
        } else {
          dismiss();
        }
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

  // Warm, like a finished night — this screen is selling more of those.
  return (
    <LinearGradient
      colors={gradients.warm}
      locations={gradients.warmLocations}
      style={styles.container}
    >
      {/*
        In gate mode the screen must not be swipe-dismissible either. Setting it
        here rather than in `(modals)/_layout.tsx` because the layout options are
        static per route and this one route is both a modal upsell and the front
        door depending on how it was opened.
      */}
      <Stack.Screen options={{ gestureEnabled: !isGate }} />
      <StarField />
      {!isGate && (
        <Pressable
          style={[styles.closeButton, { top: insets.top + 12 }]}
          onPress={dismiss}
          hitSlop={10}
        >
          <Ionicons name="close" size={22} color={palette.content[1]} />
        </Pressable>
      )}

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          {/*
            The fox, not a sparkle in a circle.
            "Unlock Your Shared Galaxy with Lunara Pro" was Title Case, it was
            about a galaxy that does not exist in this product, and the word
            "unlock" frames the free tier as something withheld. A person who
            reaches this screen has already had good nights here; the honest
            pitch is *more of the thing you already like*, said in the same
            voice as the rest of the app.
          */}
          <CoupleCompanion state="glowing" streak={streak} size="lg" />
          {/*
            "Keep your nights together" is the right line for somebody with
            nights to keep. On the front gate it is usually said to a couple who
            has had none — they paired ninety seconds ago — and a promise about
            continuity is incoherent before there is anything continuous. The
            copy follows the couple's actual history rather than assuming it.
          */}
          <Text style={styles.title}>
            {hasHistory ? 'Keep your nights together' : 'Start tonight, together'}
          </Text>
          <Text style={styles.lede}>
            {hasHistory
              ? `One of you unlocks Lunara for both. ${trialDaysOf(selected) ?? 21} days free.`
              : `One of you unlocks Lunara for both. Free for ${trialDaysOf(selected) ?? 21} days — long enough to find out if it's yours.`}
          </Text>
          <Text style={styles.subtitle}>{priceSentence(selected)}</Text>
          <View style={styles.coversBadge}>
            <Ionicons name="people" size={13} color={palette.accent.heart} />
            <Text style={styles.coversBadgeText}>One of you pays. Both of you get it.</Text>
          </View>
        </View>

        <View style={styles.features}>
          {PREMIUM_FEATURES.map((f) => (
            <View key={f.text} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon as any} size={16} color={palette.accent.glow} />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.guaranteeBanner}>
          <Ionicons name="heart-outline" size={13} color={palette.content[2]} />
          {/*
            The free tier stated in full, including the archive window — the one
            Pro claim that is also a restriction. Saying "daily prompts and
            partner sync are free" while the first bullet above sells the
            archive told two different stories about the same product.
          */}
          <Text style={styles.guaranteeText}>{coupleCoverageSummary()}</Text>
        </View>

        {loading ? (
          <View style={{ alignItems: 'center', marginVertical: 32 }}>
            <ThinkingOrb
              state="working"
              size={64}
              theme="dark"
              accessibilityLabel="Loading Lunara Premium"
            />
          </View>
        ) : !canPurchase ? (
          <View style={styles.demoNotice}>
            <Ionicons name="people-outline" size={16} color={palette.content[1]} />
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
              const isWeekly = pkg.packageType === PACKAGE_TYPE.WEEKLY;
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
                  {(isWeekly || isAnnual) && (
                    <View style={styles.badgeRow}>
                      {trial && (
                        <View style={styles.trialBadge}>
                          <Text style={styles.trialBadgeText}>{trial}</Text>
                        </View>
                      )}
                      {isAnnual && (
                        <View style={styles.valueBadge}>
                          <Text style={styles.valueBadgeText}>
                            Best if you&apos;re in it for the long run
                            {perMonth ? ` • ${perMonth}/mo` : ''}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                  <View style={styles.packageRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.packageTitle}>
                        {isAnnual ? 'Yearly' : isWeekly ? 'Weekly' : pkg.product.title || pkg.identifier}
                      </Text>
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
          {!isGate ? (
            <Pressable onPress={dismiss} disabled={purchasing} style={styles.freeBtn}>
              <Text style={styles.freeText}>Not now</Text>
            </Pressable>
          ) : (
            /*
              The gate has no close button, which means somebody who signed in
              with the wrong Apple ID has no way off this screen at all — their
              subscription is on the other account and Restore will never find
              it. That is a trap, and App Review treats a screen with no exit as
              one. Sign-out is the exit; it is deliberately the quietest control
              here.
            */
            <Pressable
              onPress={() => {
                Alert.alert(
                  'Use a different account?',
                  'This signs you out of Lunara on this device. Nothing you have written is deleted, and signing back in brings it all with you.',
                  [
                    { text: 'Stay', style: 'cancel' },
                    {
                      text: 'Sign out',
                      style: 'destructive',
                      onPress: () => {
                        // Back to the entry gate, which re-resolves from
                        // scratch. Without this the sign-out succeeds and the
                        // person is left sitting on the paywall they just tried
                        // to leave — this route does not re-route itself.
                        signOut()
                          .then(() => router.replace('/' as never))
                          .catch(() => {});
                      },
                    },
                  ],
                );
              }}
              disabled={purchasing}
              style={styles.freeBtn}
            >
              <Text style={styles.freeText}>Use a different account</Text>
            </Pressable>
          )}
          <Pressable onPress={handleRestore} disabled={purchasing} style={styles.restoreBtn}>
            <Text style={styles.restoreText}>Restore purchases</Text>
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
    right: space.xl,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: tint.cream(0.08),
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { paddingHorizontal: space.xl + 2 },
  header: { alignItems: 'center', gap: space.sm + 2, marginBottom: space.xxl },
  title: { ...text.hero, color: palette.content[0], textAlign: 'center' },
  /**
   * The one warm line under the headline. Above the auto-renewal sentence,
   * which is legally required and reads like it — this is the line a person
   * actually takes in, so it says the two things that matter: one of you pays,
   * and the first three weeks are free.
   */
  lede: {
    ...text.body,
    color: palette.content[1],
    textAlign: 'center',
    marginTop: space.xs,
  },
  subtitle: {
    ...text.callout,
    color: palette.content[1],
    textAlign: 'center',
    paddingHorizontal: space.sm,
  },
  coversBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: tint.heart(0.12),
    borderWidth: 1,
    borderColor: tint.heart(0.24),
  },
  coversBadgeText: { ...text.caption, color: palette.accent.heart },
  features: { gap: 14, marginBottom: 18 },
  guaranteeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(247, 241, 232,0.04)',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(247, 241, 232,0.07)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  guaranteeText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: palette.content[2],
    lineHeight: 17,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(125, 222, 181,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: palette.content[1], flex: 1 },
  noOfferings: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: palette.content[2],
    textAlign: 'center',
    lineHeight: 19,
    marginVertical: 24,
  },
  demoNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: palette.ink[2],
    borderWidth: 1,
    borderColor: 'rgba(247, 241, 232,0.08)',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: 16,
    marginVertical: 12,
  },
  demoNoticeText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: palette.content[1],
    lineHeight: 19,
  },
  packages: { gap: 12, marginBottom: 8 },
  packageOption: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(247, 241, 232,0.08)',
    backgroundColor: palette.ink[2],
  },
  packageOptionSelected: {
    borderColor: 'rgba(255, 184, 107,0.45)',
    backgroundColor: 'rgba(255, 184, 107,0.08)',
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  trialBadge: {
    backgroundColor: 'rgba(247, 241, 232,0.16)',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(247, 241, 232,0.3)',
  },
  trialBadgeText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: palette.content[1] },
  valueBadge: {
    backgroundColor: 'rgba(255, 184, 107,0.16)',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 107,0.32)',
  },
  valueBadgeText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: palette.accent.glow },
  packageRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  packageTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold', color: palette.content[0] },
  packagePrice: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: palette.content[1], marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: 'rgba(247, 241, 232,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: { borderColor: palette.accent.glow },
  radioDot: { width: 11, height: 11, borderRadius: radius.sm, backgroundColor: palette.accent.glow },
  footer: { gap: 4, marginTop: 12 },
  freeBtn: { alignItems: 'center', paddingVertical: 10 },
  freeText: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: palette.content[1] },
  restoreBtn: { alignItems: 'center', paddingVertical: 4, marginTop: 6 },
  restoreText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: palette.content[1] },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  legalText: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: palette.content[2], textDecorationLine: 'underline' },
  legalDivider: { fontSize: 12, color: palette.ink[4] },
});
