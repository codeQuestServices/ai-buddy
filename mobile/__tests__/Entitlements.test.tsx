/**
 * Unit tests for Phase 5: RevenueCat Entitlements & Billing Guardrails.
 */

import { describe, test, expect } from '@jest/globals';
import {
  resolveEntitlementTier,
  calculateRemainingSessionSeconds,
  shouldTriggerSessionCap,
  FREE_TIER_MAX_SESSION_SECONDS,
  PLUS_TIER_MAX_SESSION_SECONDS,
} from '../src/hooks/useEntitlements';
import {
  SUBSCRIPTION_TIERS,
  CONSUMABLE_TOPUPS,
} from '../src/components/PaywallModal';

describe('RevenueCat Entitlement Tier Resolution', () => {
  test('resolves null or empty customer info to free tier', () => {
    expect(resolveEntitlementTier(null)).toBe('free');
    expect(resolveEntitlementTier({})).toBe('free');
    expect(resolveEntitlementTier({ entitlements: {} })).toBe('free');
    expect(resolveEntitlementTier({ entitlements: { active: {} } })).toBe('free');
  });

  test('resolves plus tier for active plus or pro entitlements', () => {
    const plusCustomer = {
      entitlements: {
        active: {
          plus: { identifier: 'plus', isActive: true },
        },
      },
    };
    expect(resolveEntitlementTier(plusCustomer)).toBe('plus');

    const proCustomer = {
      entitlements: {
        active: {
          voice_plus: { identifier: 'voice_plus', isActive: true },
        },
      },
    };
    expect(resolveEntitlementTier(proCustomer)).toBe('plus');
  });

  test('resolves unlimited tier for active unlimited entitlements', () => {
    const unlimitedCustomer = {
      entitlements: {
        active: {
          unlimited: { identifier: 'unlimited', isActive: true },
        },
      },
    };
    expect(resolveEntitlementTier(unlimitedCustomer)).toBe('unlimited');

    const proUnlimitedCustomer = {
      entitlements: {
        active: {
          pro_unlimited: { identifier: 'pro_unlimited', isActive: true },
        },
      },
    };
    expect(resolveEntitlementTier(proUnlimitedCustomer)).toBe('unlimited');
  });
});

describe('Session Cap Countdown & Trigger Boundary Conditions', () => {
  test('validates 20-minute (1200 seconds) free tier maximum limit', () => {
    expect(FREE_TIER_MAX_SESSION_SECONDS).toBe(1200);
    expect(PLUS_TIER_MAX_SESSION_SECONDS).toBe(3600);
  });

  test('accurately calculates remaining session countdown seconds', () => {
    // Free tier
    expect(calculateRemainingSessionSeconds(0, 'free')).toBe(1200);
    expect(calculateRemainingSessionSeconds(300, 'free')).toBe(900);
    expect(calculateRemainingSessionSeconds(1199, 'free')).toBe(1);
    expect(calculateRemainingSessionSeconds(1200, 'free')).toBe(0);
    expect(calculateRemainingSessionSeconds(1300, 'free')).toBe(0); // clamped at 0

    // Plus tier (60m)
    expect(calculateRemainingSessionSeconds(0, 'plus')).toBe(3600);
    expect(calculateRemainingSessionSeconds(1800, 'plus')).toBe(1800);

    // Unlimited tier
    expect(calculateRemainingSessionSeconds(5000, 'unlimited')).toBe(Infinity);
  });

  test('evaluates session cap trigger boundary conditions precisely', () => {
    // Free tier: triggers at >= 1200s
    expect(shouldTriggerSessionCap(0, 'free')).toBe(false);
    expect(shouldTriggerSessionCap(1199, 'free')).toBe(false);
    expect(shouldTriggerSessionCap(1200, 'free')).toBe(true);
    expect(shouldTriggerSessionCap(1201, 'free')).toBe(true);

    // Plus tier: triggers at >= 3600s
    expect(shouldTriggerSessionCap(1200, 'plus')).toBe(false);
    expect(shouldTriggerSessionCap(3599, 'plus')).toBe(false);
    expect(shouldTriggerSessionCap(3600, 'plus')).toBe(true);

    // Unlimited tier: never triggers
    expect(shouldTriggerSessionCap(99999, 'unlimited')).toBe(false);
  });
});

describe('Paywall Modal Package Configurations', () => {
  test('contains required Monthly and Annual subscription tiers', () => {
    expect(SUBSCRIPTION_TIERS.length).toBeGreaterThanOrEqual(2);
    const tierIds = SUBSCRIPTION_TIERS.map((t) => t.id);
    expect(tierIds).toContain('monthly_plus');
    expect(tierIds).toContain('annual_unlimited');
  });

  test('contains consumable Relay Boost top-up options', () => {
    expect(CONSUMABLE_TOPUPS.length).toBeGreaterThanOrEqual(2);
    const topUpIds = CONSUMABLE_TOPUPS.map((t) => t.id);
    expect(topUpIds).toContain('relay_boost_30m');
    expect(topUpIds).toContain('relay_boost_60m');
  });
});
