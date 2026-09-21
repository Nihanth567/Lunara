import { Platform } from 'react-native';
import Purchases, {
  PACKAGE_TYPE,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';

/**
 * The single entitlement. Any active weekly / monthly / yearly subscription —
 * including one still inside its introductory free trial — grants it.
 *
 * Renamed from `lunara_pro`. If the RevenueCat dashboard still calls it
 * `lunara_pro`, the app will read every customer as unentitled and the front
 * gate will lock out paying users, so the dashboard rename is not optional and
 * has to land with this build rather than after it.
 */
export const ENTITLEMENT_ID = 'premium';

/**
 * The store products this app expects in the `default` offering.
 *
 * These are declared here for documentation and for the config check below —
 * nothing in the client hardcodes a price. Prices, trial length and
 * localisation all come from the store via RevenueCat, because a price written
 * into an app binary is a price that goes stale in a region you do not watch.
 */
export const PRODUCT_IDS = {
  weekly: 'lunara_premium_weekly',
  monthly: 'lunara_premium_monthly',
  yearly: 'lunara_premium_yearly',
} as const;

/**
 * The trial we ask the stores for. Declared for copy and for the day-18
 * reminder; the *authoritative* number is whatever `introPrice` reports on the
 * package the person is actually looking at, and the paywall reads that rather
 * than this.
 */
export const TRIAL_DAYS = 21;

const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

let configured = false;

function apiKeyForPlatform(): string | undefined {
  return Platform.OS === 'ios' ? IOS_API_KEY : Platform.OS === 'android' ? ANDROID_API_KEY : undefined;
}

/** Configure RevenueCat with the Supabase user id as the app_user_id, so the
 *  RevenueCat → Supabase webhook can attribute a purchase to the right profile. */
export async function configurePurchases(userId: string): Promise<void> {
  const apiKey = apiKeyForPlatform();
  if (!apiKey || Platform.OS === 'web') return;

  if (!configured) {
    Purchases.configure({ apiKey, appUserID: userId });
    configured = true;
  } else {
    await Purchases.logIn(userId);
  }
}

export async function logOutPurchases(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch {
    // Already anonymous — safe to ignore.
  }
}

export function isPurchasesConfigured(): boolean {
  return configured;
}

export async function getCurrentOffering() {
  if (!configured) return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

export function isEntitled(customerInfo: CustomerInfo): boolean {
  return typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
}

export async function purchase(pkg: PurchasesPackage): Promise<boolean> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return isEntitled(customerInfo);
}

export async function restore(): Promise<boolean> {
  const customerInfo = await Purchases.restorePurchases();
  return isEntitled(customerInfo);
}

/**
 * Whether *this device's* RevenueCat customer currently holds `premium`.
 *
 * This is the authoritative answer for the person who paid, and it is available
 * the instant a purchase or restore completes. The server's copy
 * (`profiles.is_subscribed`, written by the RevenueCat webhook) can be seconds
 * or minutes behind, and a restore emits no webhook at all — which is exactly
 * why Pro used to stay locked after a successful "Restore Purchases".
 */
export async function checkIsPro(): Promise<boolean> {
  if (!configured) return false;
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return isEntitled(customerInfo);
  } catch {
    return false;
  }
}

/**
 * Subscribe to entitlement changes RevenueCat notices on its own — a renewal
 * landing, a subscription lapsing, a purchase made on the user's other device.
 * Returns an unsubscribe function; a no-op if Purchases was never configured.
 */
export function onEntitlementChange(listener: (entitled: boolean) => void): () => void {
  if (!configured) return () => {};
  const handler = (customerInfo: CustomerInfo) => listener(isEntitled(customerInfo));
  Purchases.addCustomerInfoUpdateListener(handler);
  return () => Purchases.removeCustomerInfoUpdateListener(handler);
}

/**
 * Whether this customer is inside an introductory free trial rather than
 * paying. `isEntitled` is true for both, and the gate deliberately does not
 * distinguish — a trialing couple gets the whole product. This exists for copy
 * and for the trial-ending reminder.
 */
export function isTrialing(customerInfo: CustomerInfo): boolean {
  const ent = customerInfo.entitlements.active[ENTITLEMENT_ID];
  return ent?.periodType === 'TRIAL';
}

/** When the active entitlement lapses (ISO string), or null if there is none. */
export function entitlementExpiry(customerInfo: CustomerInfo): string | null {
  return customerInfo.entitlements.active[ENTITLEMENT_ID]?.expirationDate ?? null;
}

/**
 * Display order for the plan list, and the one genuinely load-bearing
 * monetisation decision in this file.
 *
 * **Weekly first, and weekly pre-selected.** Not annual.
 *
 * This inverts what the paywall used to do. The previous version sorted annual
 * to the top and called `setSelected(annual)`, so the default path was a
 * $59.99 commitment from somebody who had not yet finished a single night.
 *
 * The reason to change it is revenue, not taste: across Adapty's 2026 sample
 * (~16k apps, ~$3B), weekly-with-trial returns roughly $7 per user on day one
 * and about $54 by year end, against roughly $42 day-one and about $50 by year
 * end for annual-with-trial. Weekly plans are now around 55% of subscription
 * revenue, up from about 43% two years ago. Annual wins the first day and loses
 * the year.
 *
 * Annual is still *offered* — a couple who knows they want this should be able
 * to say so and pay less — it is simply no longer the silent default.
 */
export function packageRank(pkg: PurchasesPackage): number {
  switch (pkg.packageType) {
    case PACKAGE_TYPE.WEEKLY:
      return 0;
    case PACKAGE_TYPE.ANNUAL:
      return 1;
    case PACKAGE_TYPE.MONTHLY:
      return 2;
    default:
      return 3;
  }
}

/** The plan list, weekly first. */
export function orderPackages(packages: PurchasesPackage[]): PurchasesPackage[] {
  return [...packages].sort((a, b) => packageRank(a) - packageRank(b));
}

/**
 * The package that should be selected when the paywall opens: weekly if the
 * offering has one, otherwise whatever ranks highest. Never silently annual.
 */
export function defaultPackage(packages: PurchasesPackage[]): PurchasesPackage | null {
  return orderPackages(packages)[0] ?? null;
}

/**
 * Whether a RevenueCat key exists for this platform at all.
 *
 * Distinct from `isPurchasesConfigured()`, which says whether configuration has
 * *happened yet*. This says whether it could ever happen — and the front gate
 * needs the difference: no key means there is nothing to sell and nothing to
 * read, which is a misconfiguration in production and simply "web" in dev.
 */
export function hasStoreKey(): boolean {
  return Boolean(apiKeyForPlatform());
}

export interface TrialInfo {
  /** Inside a free introductory period rather than paying. */
  trialing: boolean;
  /** When the current period lapses, or null if there is no entitlement. */
  expiresAt: Date | null;
}

/**
 * Trial state for the person holding this phone.
 *
 * Deliberately separate from `checkIsPro()`: the gate does not care whether
 * someone is trialing or paying (both are entitled), and mixing the two
 * questions is how a gate ends up accidentally locking out trial users.
 */
export async function getTrialInfo(): Promise<TrialInfo> {
  if (!configured) return { trialing: false, expiresAt: null };
  try {
    const info = await Purchases.getCustomerInfo();
    const iso = entitlementExpiry(info);
    return { trialing: isTrialing(info), expiresAt: iso ? new Date(iso) : null };
  } catch {
    return { trialing: false, expiresAt: null };
  }
}
