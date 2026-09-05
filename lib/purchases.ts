import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

export const ENTITLEMENT_ID = 'lunara_pro';

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
 * Whether *this device's* RevenueCat customer currently holds `lunara_pro`.
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
