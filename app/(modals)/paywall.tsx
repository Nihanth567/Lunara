import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, Linking } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PACKAGE_TYPE, type PurchasesPackage } from 'react-native-purchases';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';
import { CoupleCompanion } from '@/components/CoupleCompanion';
import { ScreenLoading } from '@/components/ScreenLoading';
import { SpringPressable } from '@/components/SpringPressable';
import {
  defaultPackage,
  getCurrentOffering,
  isPurchasesConfigured,
  orderPackages,
  purchase,
  restore,
} from '@/lib/purchases';
import { PREMIUM_FEATURES, coupleCoverageSummary } from '@/lib/entitlements';
import { trialDays, trialLength, yearlySavingsPercent } from '@/lib/pricing';
import { useApp } from '@/context/AppContext';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { hitSlopFor, pressScale, radius, space } from '@/constants/tokens';
import { gradients, palette, tint } from '@/constants/colors';
import { type as text } from '@/constants/typography';

/** Apple's Standard Licensed Application EULA — the licence Lunara ships under. */
const APPLE_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/**
 * What Pro is comes from `lib/entitlements.ts`, which is also what the Us tab
 * and the onboarding preview render — see the note there for why this screen no
 * longer keeps its own copy of the list.
 */

/** "21-day free trial", from the store's own intro offer — never assumed. */
function trialLabel(pkg: PurchasesPackage): string | null {
  const intro = pkg.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  const length = trialLength(intro.periodUnit, intro.periodNumberOfUnits);
  return length ? `${length} free trial` : null;
}

function periodSuffix(pkg: PurchasesPackage): string {
  if (pkg.packageType === PACKAGE_TYPE.ANNUAL) return '/year';
  if (pkg.packageType === PACKAGE_TYPE.MONTHLY) return '/month';
  // Weekly is the default plan now, so the one package whose price used to
  // render bare — "$2.99" with no period at all — is the one most people see.
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
  return trialDays(intro.periodUnit, intro.periodNumberOfUnits) ?? undefined;
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
  const {
    refreshSharedState,
    refreshEntitlement,
    canPurchase,
    couple,
    signOut,
    notificationSettings,
  } = useApp();
  // The fox on this screen shows the couple's real streak, so the thing being
  // sold is visibly *theirs* rather than a stock illustration of a product.
  const streak = couple?.currentStreak ?? 0;
  /** Have these two ever finished a night together? Drives the pitch. */
  const hasHistory = (couple?.longestStreak ?? 0) > 0;
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * The plans didn't arrive. Previously a network failure here fell through to
   * the "plans aren't configured yet — add products in RevenueCat" branch: a
   * message for the developer, shown to someone trying to pay, with no way to
   * ask again.
   */
  const [loadFailed, setLoadFailed] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  const dismiss = () => {
    if (isGate) {
      // Nothing to dismiss to. Recorded rather than silently ignored, because
      // "how many people try to leave" is the number that says whether the
      // gate is set at the right place.
      track('paywall_dismiss_blocked', { plan: planLabel(selected), paired: canPurchase });
      return;
    }
    router.back();
  };

  /**
   * Where a successful purchase or restore goes.
   *
   * From onboarding (`source=onboarding`, always opened in gate mode) the paywall
   * sits *before* sign-in: the trial is running on an anonymous account, so the
   * next stop is the late sign-in that makes that account permanent, then
   * pairing. From the front gate there is nothing underneath, so this is the
   * moment the app opens. As an upsell, it simply closes.
   */
  const afterUnlock = () => {
    if (fromOnboarding) router.replace('/(onboarding)/auth?after=trial' as never);
    else if (isGate) router.replace('/(app)/' as never);
    else dismiss();
  };

  useEffect(() => {
    track('paywall_view', { source: fromOnboarding ? 'onboarding' : isGate ? 'gate' : 'modal', paired: canPurchase });
  }, [isGate, fromOnboarding, canPurchase]);

  const loadOffering = async () => {
    if (!isPurchasesConfigured()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadFailed(false);
    try {
      const offering = await getCurrentOffering();
      const available = offering?.availablePackages ?? [];
      setPackages(available);
      // Weekly, or nothing — never annual — see `defaultPackage` in lib/purchases.ts.
      setSelected(defaultPackage(available));
      // In a release build an offering with nothing to list is a store that
      // didn't answer, not a missing configuration — say so and offer to try
      // again. Counted after filtering, so an offering holding only unlisted
      // plans (a leftover monthly) doesn't fall through to the developer copy.
      if (orderPackages(available).length === 0 && !__DEV__) setLoadFailed(true);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOffering();
  }, []);

  const orderedPackages = useMemo(() => orderPackages(packages), [packages]);

  /**
   * The yearly saving against paying weekly for a year, from the two prices
   * the store actually returned — 69% at $2.99 and $48. Computed rather than
   * written as "Save 69%", so a price change in one storefront can't leave a
   * badge claiming a saving that isn't there.
   */
  const weeklyPkg = orderedPackages.find((p) => p.packageType === PACKAGE_TYPE.WEEKLY);
  const yearlyPkg = orderedPackages.find((p) => p.packageType === PACKAGE_TYPE.ANNUAL);
  const yearlySaving =
    weeklyPkg && yearlyPkg
      ? yearlySavingsPercent(weeklyPkg.product.price, yearlyPkg.product.price)
      : null;

  // The button never promises a trial the store isn't offering on the plan the
  // user actually has selected.
  const selectedTrial = selected ? trialLabel(selected) : null;
  const ctaTitle = !selected
    ? 'Choose a plan'
    : selectedTrial
      ? `Start ${selectedTrial}`
      : `Subscribe — ${selected.product.priceString}${periodSuffix(selected)}`;

  /**
   * Only a trial the selected plan really carries. This used to fall back to
   * "21 days free" whenever the store reported none, which is the one promise
   * the rest of this screen is careful never to make.
   */
  const selectedTrialDays = trialDaysOf(selected);

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
        haptic.success();
        // Unlock from RevenueCat's own answer, right now. `refreshSharedState`
        // only reads the server mirror, which the webhook hasn't written yet —
        // relying on it alone left a paying customer looking at a paywall.
        await refreshEntitlement().catch(() => {});
        await refreshSharedState().catch(() => {});
        track('couple_premium_granted', { plan: planLabel(selected), paired: canPurchase });
        afterUnlock();
      } else {
        haptic.error();
        Alert.alert(
          'Almost there',
          'The store completed your purchase but hasn’t confirmed it yet. Give it a moment, then tap Restore Purchases.',
        );
      }
    } catch (error: any) {
      if (!error?.userCancelled) {
        haptic.error();
        Alert.alert(
          'That didn’t go through',
          `${error?.message ?? 'The store didn’t complete the purchase.'} Try again whenever you’re ready.`,
        );
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
        track('restore_completed', { source: fromOnboarding ? 'onboarding' : isGate ? 'gate' : 'modal' });
        haptic.success();
        afterUnlock();
      } else {
        haptic.error();
        Alert.alert(
          'No active subscription found',
          'Restore looked for a previous purchase on this account but did not find one.',
        );
      }
    } catch (error: any) {
      haptic.error();
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
        <SpringPressable
          style={[styles.closeButton, { top: insets.top + 12 }]}
          onPress={dismiss}
          hitSlop={hitSlopFor(40)}
          scaleTo={pressScale.icon}
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={22} color={palette.content[1]} />
        </SpringPressable>
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
            One of you unlocks Lunara for both.
            {selectedTrialDays
              ? hasHistory
                ? ` ${selectedTrialDays} days free.`
                : ` Free for ${selectedTrialDays} days — long enough to find out if it's yours.`
              : ''}
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
          // The app's one wait: it fades in after a beat, so plans that come
          // back quickly never flash a loader on the way to the list.
          <ScreenLoading fullScreen={false} accessibilityLabel="Loading Lunara Premium" />
        ) : !canPurchase ? (
          <View style={styles.demoNotice}>
            <Ionicons name="people-outline" size={16} color={palette.content[1]} />
            <Text style={styles.demoNoticeText}>
              You&apos;re exploring Lunara on your own. Pro is one subscription for two people, so
              it unlocks once your partner has joined you — nothing to pay for until then.
            </Text>
          </View>
        ) : loadFailed ? (
          <View style={styles.loadFailed}>
            <Text style={styles.loadFailedText}>
              The plans didn&apos;t load — the connection may have dropped.
            </Text>
            <SpringPressable onPress={() => void loadOffering()} style={styles.retryBtn}>
              <Ionicons name="refresh" size={15} color={palette.accent.glow} />
              <Text style={styles.retryText}>Try again</Text>
            </SpringPressable>
          </View>
        ) : orderedPackages.length === 0 ? (
          // Development only: a release build treats this as `loadFailed`.
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
              // RevenueCat's own localised figure: about $0.92 at $48 a year.
              const perWeek = pkg.product.pricePerWeekString;
              // "Then $2.99/week · cancel anytime" / "$48/year · Save 69%".
              const planLine = isWeekly
                ? `${trial ? 'Then ' : ''}${pkg.product.priceString}/week · cancel anytime`
                : isAnnual
                  ? `${pkg.product.priceString}/year${yearlySaving ? ` · Save ${yearlySaving}%` : ''}`
                  : `${pkg.product.priceString}${periodSuffix(pkg)}`;

              return (
                <SpringPressable
                  key={pkg.identifier}
                  style={[styles.packageOption, isSelected && styles.packageOptionSelected]}
                  scaleTo={pressScale.card}
                  // Choosing between plans is a selection, not a tap.
                  haptic="selection"
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setSelected(pkg)}
                >
                  {(isWeekly || isAnnual) && (
                    <View style={styles.badgeRow}>
                      {trial && (
                        <View style={styles.trialBadge}>
                          <Text style={styles.trialBadgeText}>{trial}</Text>
                        </View>
                      )}
                      {isAnnual && perWeek && (
                        <View style={styles.valueBadge}>
                          <Text style={styles.valueBadgeText}>{perWeek}/week, billed yearly</Text>
                        </View>
                      )}
                    </View>
                  )}
                  <View style={styles.packageRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.packageTitle}>
                        {isAnnual ? 'Yearly' : isWeekly ? 'Weekly' : pkg.product.title || pkg.identifier}
                      </Text>
                      <Text style={styles.packagePrice}>{planLine}</Text>
                    </View>
                    <View style={[styles.radio, isSelected && styles.radioSelected]}>
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                  </View>
                </SpringPressable>
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
          {/*
            Trial safety, said where the finger is. Only on a plan that really
            carries a trial, and the reminder line only when notifications are
            on — the day-18 notice is a local notification, and it can't be
            promised to someone who turned them off.
          */}
          {selectedTrial ? (
            <Text style={styles.trialSafety}>
              No payment due now. Cancel anytime.
              {notificationSettings.enabled ? ' We’ll remind you before your trial ends.' : ''}
            </Text>
          ) : null}
          {fromOnboarding ? (
            // Onboarding's quiet exit: the person who already subscribed on
            // another phone. Signing in finds their account; Restore, above,
            // finds their purchase.
            <SpringPressable
              feedback="highlight"
              haptic="none"
              onPress={() => router.push('/(onboarding)/auth' as never)}
              disabled={purchasing}
              style={styles.freeBtn}
            >
              <Text style={styles.freeText}>Already have an account? Sign in</Text>
            </SpringPressable>
          ) : !isGate ? (
            <SpringPressable
              onPress={dismiss}
              disabled={purchasing}
              feedback="highlight"
              haptic="none"
              style={styles.freeBtn}
            >
              <Text style={styles.freeText}>Not now</Text>
            </SpringPressable>
          ) : (
            /*
              The gate has no close button, which means somebody who signed in
              with the wrong Apple ID has no way off this screen at all — their
              subscription is on the other account and Restore will never find
              it. That is a trap, and App Review treats a screen with no exit as
              one. Sign-out is the exit; it is deliberately the quietest control
              here.
            */
            <SpringPressable
              feedback="highlight"
              haptic="none"
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
                          .catch(() => {
                            haptic.error();
                            Alert.alert(
                              'Couldn’t sign out',
                              'Something got in the way just now. Check your connection and try once more.',
                            );
                          });
                      },
                    },
                  ],
                );
              }}
              disabled={purchasing}
              style={styles.freeBtn}
            >
              <Text style={styles.freeText}>Use a different account</Text>
            </SpringPressable>
          )}
          <SpringPressable
            onPress={handleRestore}
            disabled={purchasing}
            feedback="highlight"
            style={styles.restoreBtn}
          >
            <Text style={styles.restoreText}>Restore purchases</Text>
          </SpringPressable>
          {/*
            Guideline 3.1.2 requires a subscription screen to link the licence
            terms and the privacy policy. "Terms of Service" alone did not
            satisfy it: the EULA was named in prose on the Terms screen and
            linked from nowhere. Apple's standard agreement is linked directly
            here, which is what Review looks for.
          */}
          <View style={styles.legalRow}>
            <SpringPressable
              onPress={() => router.push('/(modals)/terms')}
              feedback="highlight"
              haptic="none"
              accessibilityRole="link"
              hitSlop={12}
            >
              <Text style={styles.legalText}>Terms</Text>
            </SpringPressable>
            <Text style={styles.legalDivider}>·</Text>
            <SpringPressable
              onPress={() => void Linking.openURL(APPLE_EULA_URL).catch(() => {})}
              feedback="highlight"
              haptic="none"
              accessibilityRole="link"
              hitSlop={12}
            >
              <Text style={styles.legalText}>EULA</Text>
            </SpringPressable>
            <Text style={styles.legalDivider}>·</Text>
            <SpringPressable
              onPress={() => router.push('/(modals)/privacy')}
              feedback="highlight"
              haptic="none"
              accessibilityRole="link"
              hitSlop={12}
            >
              <Text style={styles.legalText}>Privacy Policy</Text>
            </SpringPressable>
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
    fontFamily: 'Nunito_400Regular',
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
  featureText: { fontSize: 14, fontFamily: 'Nunito_400Regular', color: palette.content[1], flex: 1 },
  noOfferings: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: palette.content[2],
    textAlign: 'center',
    lineHeight: 19,
    marginVertical: 24,
  },
  loadFailed: { alignItems: 'center', gap: space.md, marginVertical: space.xl },
  loadFailedText: { ...text.callout, color: palette.content[1], textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 44,
    paddingHorizontal: space.xl,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: tint.glow(0.1),
    borderWidth: 1,
    borderColor: tint.glow(0.28),
  },
  retryText: { ...text.label, fontSize: 14, color: palette.accent.glow },
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
    fontFamily: 'Nunito_400Regular',
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
  trialBadgeText: { fontSize: 12, fontFamily: 'Nunito_700Bold', color: palette.content[1] },
  valueBadge: {
    backgroundColor: 'rgba(255, 184, 107,0.16)',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 107,0.32)',
  },
  valueBadgeText: { fontSize: 12, fontFamily: 'Nunito_700Bold', color: palette.accent.glow },
  packageRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  packageTitle: { fontSize: 16, fontFamily: 'Nunito_700Bold', color: palette.content[0] },
  packagePrice: { fontSize: 14, fontFamily: 'Nunito_400Regular', color: palette.content[1], marginTop: 2 },
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
  freeText: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', color: palette.content[1] },
  trialSafety: { ...text.caption, color: palette.content[1], textAlign: 'center' },
  restoreBtn: { alignItems: 'center', paddingVertical: 4, marginTop: 6 },
  restoreText: { fontSize: 14, fontFamily: 'Nunito_400Regular', color: palette.content[1] },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  legalText: { fontSize: 12, fontFamily: 'Nunito_400Regular', color: palette.content[2], textDecorationLine: 'underline' },
  legalDivider: { fontSize: 12, color: palette.ink[4] },
});
