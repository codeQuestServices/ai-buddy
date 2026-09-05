/**
 * Subscription Paywall & Session Top-Up Modal.
 * Includes App Store compliance links (Restore, Terms, Privacy).
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { PurchasesPackage, PurchasesOffering } from 'react-native-purchases';

export interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onPurchase?: (pkg: any) => Promise<boolean>;
  onRestore?: () => Promise<boolean>;
  offerings?: PurchasesOffering | null;
  packages?: PurchasesPackage[];
  isLoading?: boolean;
}

export const SUBSCRIPTION_TIERS = [
  {
    id: 'monthly_plus',
    title: 'Echo Plus Monthly',
    price: '$9.99 / mo',
    badge: 'Popular',
    features: ['60-Minute Voice Sessions', 'Unlimited Memory Storage', 'Custom 3D Blendshapes'],
  },
  {
    id: 'annual_unlimited',
    title: 'Echo Unlimited Annual',
    price: '$79.99 / yr',
    badge: 'Best Value - Save 33%',
    features: ['Unlimited Voice Sessions', 'Ultra-Low Latency Priority', 'All 3D Avatars & Voices'],
  },
];

export const CONSUMABLE_TOPUPS = [
  {
    id: 'relay_boost_30m',
    title: 'Relay Boost (+30m)',
    price: '$2.99',
    description: 'Instant 30-minute extension for current session',
  },
  {
    id: 'relay_boost_60m',
    title: 'Relay Boost (+60m)',
    price: '$4.99',
    description: 'Instant 60-minute extension for current session',
  },
];

export function PaywallModal({
  visible,
  onClose,
  onPurchase,
  onRestore,
  offerings,
  packages,
  isLoading = false,
}: PaywallModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<string>('annual_unlimited');
  const [purchasing, setPurchasing] = useState(false);

  // Helper to resolve live PurchasesPackage from RevenueCat offerings
  const findMatchingPackage = (planId: string): PurchasesPackage | undefined => {
    const available = offerings?.availablePackages || packages || [];
    return available.find(
      (p) =>
        p.identifier === planId ||
        p.product?.identifier === planId ||
        (planId.includes('monthly') && (p.packageType === 'MONTHLY' || p.identifier.toLowerCase().includes('monthly'))) ||
        (planId.includes('annual') && (p.packageType === 'ANNUAL' || p.identifier.toLowerCase().includes('annual')))
    );
  };

  const handlePurchase = async (planId: string) => {
    if (!onPurchase) return;
    try {
      setPurchasing(true);
      const matchedPkg = findMatchingPackage(planId);
      // Pass full RevenueCat PurchasesPackage object if resolved, fallback to synthetic identifier
      const success = await onPurchase(matchedPkg || { identifier: planId });
      if (success) {
        onClose();
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (!onRestore) return;
    try {
      setPurchasing(true);
      const success = await onRestore();
      if (success) {
        onClose();
      }
    } finally {
      setPurchasing(false);
    }
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeContainer}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Close Button Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Hero Banner */}
          <View style={styles.heroSection}>
            <Text style={styles.badgeText}>SESSION TIME LIMIT REACHED</Text>
            <Text style={styles.heroTitle}>Unlock Unlimited Echo</Text>
            <Text style={styles.heroSubtitle}>
              Experience seamless, uninterrupted conversations with long-term memory and zero time limits.
            </Text>
          </View>

          {/* Subscription Plans */}
          <Text style={styles.sectionHeader}>Subscription Plans</Text>
          {SUBSCRIPTION_TIERS.map((tier) => {
            const isSelected = selectedPlan === tier.id;
            return (
              <TouchableOpacity
                key={tier.id}
                style={[styles.planCard, isSelected && styles.planCardActive]}
                onPress={() => setSelectedPlan(tier.id)}
                activeOpacity={0.85}
              >
                {tier.badge && (
                  <View style={[styles.cardBadge, isSelected && styles.cardBadgeActive]}>
                    <Text style={styles.cardBadgeText}>{tier.badge}</Text>
                  </View>
                )}
                <View style={styles.planHeader}>
                  <Text style={styles.planTitle}>{tier.title}</Text>
                  <Text style={styles.planPrice}>
                    {findMatchingPackage(tier.id)?.product?.priceString || tier.price}
                  </Text>
                </View>
                <View style={styles.featureList}>
                  {tier.features.map((feat, idx) => (
                    <Text key={idx} style={styles.featureText}>
                      ✓ {feat}
                    </Text>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Consumable Session Top-Ups */}
          <Text style={styles.sectionHeader}>One-Time Relay Boosts</Text>
          <View style={styles.topUpRow}>
            {CONSUMABLE_TOPUPS.map((topUp) => (
              <TouchableOpacity
                key={topUp.id}
                style={styles.topUpCard}
                onPress={() => handlePurchase(topUp.id)}
                disabled={purchasing || isLoading}
              >
                <Text style={styles.topUpTitle}>{topUp.title}</Text>
                <Text style={styles.topUpDesc}>{topUp.description}</Text>
                <View style={styles.topUpPriceTag}>
                  <Text style={styles.topUpPriceText}>{topUp.price}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Main Purchase Action Button */}
          <TouchableOpacity
            style={styles.primaryPurchaseBtn}
            onPress={() => handlePurchase(selectedPlan)}
            disabled={purchasing || isLoading}
          >
            {purchasing || isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryPurchaseBtnText}>Continue with Subscription</Text>
            )}
          </TouchableOpacity>

          {/* Restore Purchases Action */}
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestore}
            disabled={purchasing || isLoading}
          >
            <Text style={styles.restoreBtnText}>Restore Existing Purchases</Text>
          </TouchableOpacity>

          {/* App Store Compliance Footer Links */}
          <View style={styles.legalFooter}>
            <TouchableOpacity onPress={() => openLink('https://ai-buddy.app/terms')}>
              <Text style={styles.legalLinkText}>Terms of Service</Text>
            </TouchableOpacity>
            <Text style={styles.legalDivider}>•</Text>
            <TouchableOpacity onPress={() => openLink('https://ai-buddy.app/privacy')}>
              <Text style={styles.legalLinkText}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#0a0d18',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  header: {
    alignItems: 'flex-end',
    paddingVertical: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  badgeText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 12,
    marginTop: 8,
  },
  planCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  planCardActive: {
    borderColor: '#8b5cf6',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
  },
  cardBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#6366f1',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
  },
  cardBadgeActive: {
    backgroundColor: '#8b5cf6',
  },
  cardBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  planTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f8fafc',
  },
  planPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#38bdf8',
  },
  featureList: {
    gap: 4,
  },
  featureText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  topUpRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  topUpCard: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'space-between',
  },
  topUpTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  topUpDesc: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 12,
    lineHeight: 15,
  },
  topUpPriceTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  topUpPriceText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  primaryPurchaseBtn: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryPurchaseBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  restoreBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  restoreBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  legalFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  legalLinkText: {
    color: '#64748b',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  legalDivider: {
    color: '#475569',
    fontSize: 12,
  },
});

export default PaywallModal;
