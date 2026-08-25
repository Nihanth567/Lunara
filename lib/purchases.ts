import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

export const ENTITLEMENT_ID = 'premium';

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
