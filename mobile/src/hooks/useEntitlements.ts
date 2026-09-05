/**
 * RevenueCat Entitlements & Subscription Management Hook.
 */

import { useState, useEffect, useCallback } from 'react';
import Purchases, {
  CustomerInfo,
  PurchasesPackage,
  PurchasesOffering,
} from 'react-native-purchases';

export type EntitlementTier = 'free' | 'plus' | 'unlimited';

export const FREE_TIER_MAX_SESSION_SECONDS = 1200; // 20 minutes
export const PLUS_TIER_MAX_SESSION_SECONDS = 3600; // 60 minutes
export const UNLIMITED_TIER_MAX_SESSION_SECONDS = Infinity;

/**
 * Pure helper function to resolve user entitlement tier from RevenueCat CustomerInfo.
 */
export function resolveEntitlementTier(customerInfo: any): EntitlementTier {
  if (!customerInfo || !customerInfo.entitlements || !customerInfo.entitlements.active) {
    return 'free';
  }

  const active = customerInfo.entitlements.active;

  if (active['unlimited'] || active['pro_unlimited']) {
    return 'unlimited';
  }

  if (active['plus'] || active['voice_plus'] || active['pro']) {
    return 'plus';
  }

  // Check if any generic entitlement is active
  if (Object.keys(active).length > 0) {
    return 'plus';
  }

  return 'free';
}

/**
 * Calculates remaining session seconds for the given tier.
 */
export function calculateRemainingSessionSeconds(
  elapsedSeconds: number,
  tier: EntitlementTier = 'free'
): number {
  const maxSeconds =
    tier === 'unlimited'
      ? UNLIMITED_TIER_MAX_SESSION_SECONDS
      : tier === 'plus'
      ? PLUS_TIER_MAX_SESSION_SECONDS
      : FREE_TIER_MAX_SESSION_SECONDS;

  if (maxSeconds === Infinity) {
    return Infinity;
  }

  return Math.max(0, maxSeconds - elapsedSeconds);
}

/**
 * Determines whether the session time limit has been reached.
 */
export function shouldTriggerSessionCap(
  elapsedSeconds: number,
  tier: EntitlementTier = 'free'
): boolean {
  if (tier === 'unlimited') {
    return false;
  }

  const maxSeconds =
    tier === 'plus' ? PLUS_TIER_MAX_SESSION_SECONDS : FREE_TIER_MAX_SESSION_SECONDS;

  return elapsedSeconds >= maxSeconds;
}

/**
 * React hook for RevenueCat SDK integration.
 */
export function useEntitlements() {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [activeTier, setActiveTier] = useState<EntitlementTier>('free');
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize RevenueCat SDK
  useEffect(() => {
    const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY || 'appl_mock_revenuecat_key';

    const initRevenueCat = async () => {
      try {
        if (apiKey && typeof Purchases.configure === 'function') {
          Purchases.configure({ apiKey });
          const info = await Purchases.getCustomerInfo();
          setCustomerInfo(info);
          setActiveTier(resolveEntitlementTier(info));

          const currentOfferings = await Purchases.getOfferings();
          if (currentOfferings.current) {
            setOfferings(currentOfferings.current);
          }
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to initialize purchases');
      } finally {
        setLoading(false);
      }
    };

    initRevenueCat();

    // Listen for customer info updates
    const customerInfoListener = (info: CustomerInfo) => {
      setCustomerInfo(info);
      setActiveTier(resolveEntitlementTier(info));
    };

    if (typeof Purchases.addCustomerInfoUpdateListener === 'function') {
      Purchases.addCustomerInfoUpdateListener(customerInfoListener);
    }

    return () => {
      if (typeof Purchases.removeCustomerInfoUpdateListener === 'function') {
        Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
      }
    };
  }, []);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const { customerInfo: updatedInfo } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(updatedInfo);
      const tier = resolveEntitlementTier(updatedInfo);
      setActiveTier(tier);
      return tier !== 'free';
    } catch (err: any) {
      if (!err.userCancelled) {
        setError(err?.message || 'Purchase failed');
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const restoredInfo = await Purchases.restorePurchases();
      setCustomerInfo(restoredInfo);
      const tier = resolveEntitlementTier(restoredInfo);
      setActiveTier(tier);
      return tier !== 'free';
    } catch (err: any) {
      setError(err?.message || 'Failed to restore purchases');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    customerInfo,
    activeTier,
    isSubscribed: activeTier !== 'free',
    offerings,
    loading,
    error,
    purchasePackage,
    restorePurchases,
  };
}
