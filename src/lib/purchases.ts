import { Platform } from 'react-native';

import { backend } from './index';
import { DEMO_PLANS, euro, type Plan } from './plans';

/**
 * Store purchases through RevenueCat (App Store + Google Play in one SDK).
 * Without RevenueCat keys (demo mode / web) purchases are simulated locally.
 * The server never trusts the app: premium is granted by the RevenueCat webhook.
 */
export interface StorePlan extends Plan {
  priceString: string;
  perMonthString?: string;
  /** native package object, opaque to the UI */
  pkg?: unknown;
}

const apiKey = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});
export const storeEnabled = backend.mode === 'supabase' && Platform.OS !== 'web' && !!apiKey;

let configuredFor: string | null = null;

async function rc() {
  const mod = await import('react-native-purchases');
  return mod.default;
}

/** Call after login so purchases are attributed to the Supabase user id. */
export async function identifyPurchaser(userId: string | null) {
  if (!storeEnabled || !userId || configuredFor === userId) return;
  const Purchases = await rc();
  if (!configuredFor) Purchases.configure({ apiKey: apiKey!, appUserID: userId });
  else await Purchases.logIn(userId);
  configuredFor = userId;
}

export async function resetPurchaser() {
  if (!storeEnabled || !configuredFor) return;
  const Purchases = await rc();
  await Purchases.logOut().catch(() => {});
  configuredFor = null;
}

const fallback = (p: Plan): StorePlan => ({
  ...p,
  priceString: euro(p.price),
  perMonthString: p.months && p.months > 1 ? `${euro(p.price / p.months)} / Monat` : undefined,
});

export async function loadPlans(): Promise<StorePlan[]> {
  if (!storeEnabled) return DEMO_PLANS.map(fallback);
  const Purchases = await rc();
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  return packages
    .map((pkg): StorePlan | null => {
      const known = DEMO_PLANS.find((d) => d.id === pkg.product.identifier.split(':')[0]);
      if (!known) return null;
      const months = known.months;
      return {
        ...known,
        price: pkg.product.price,
        priceString: pkg.product.priceString,
        perMonthString: months && months > 1
          ? `${(pkg.product.price / months).toLocaleString('de-DE', { style: 'currency', currency: pkg.product.currencyCode })} / Monat`
          : undefined,
        pkg,
      };
    })
    .filter((p): p is StorePlan => !!p);
}

/** Returns false if the user cancelled. */
export async function buy(plan: StorePlan): Promise<boolean> {
  if (!storeEnabled) {
    await backend.simulatePurchase?.(plan.id);
    return true;
  }
  const Purchases = await rc();
  try {
    await Purchases.purchasePackage(plan.pkg as Parameters<typeof Purchases.purchasePackage>[0]);
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return false;
    throw e;
  }
  // The webhook updates Supabase within seconds; poll briefly so the UI reflects it.
  for (let i = 0; i < 8; i++) {
    const l = await backend.getLimits().catch(() => null);
    if (plan.kind === 'subscription' ? l?.premium : (l?.boostCredits ?? 0) > 0) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return true;
}

export async function restore(): Promise<void> {
  if (!storeEnabled) return;
  const Purchases = await rc();
  await Purchases.restorePurchases();
}

export const manageSubscriptionsUrl = Platform.select({
  ios: 'https://apps.apple.com/account/subscriptions',
  android: 'https://play.google.com/store/account/subscriptions',
  default: 'https://apps.apple.com/account/subscriptions',
});
