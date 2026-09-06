/**
 * Main Companion Screen featuring 3D Avatar Canvas, Viseme Sync, Session Cap Timer, and Paywall Guardrail.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Canvas } from '@react-three/fiber/native';
import { Avatar } from '../components/Avatar';
import { useVisemeSync, OculusVisemeKey } from '../hooks/useVisemeSync';
import {
  useEntitlements,
  calculateRemainingSessionSeconds,
  shouldTriggerSessionCap,
  FREE_TIER_MAX_SESSION_SECONDS,
} from '../hooks/useEntitlements';
import { PaywallModal } from '../components/PaywallModal';

export type CompanionState = 'connecting' | 'idle' | 'listening' | 'speaking';

export interface CompanionScreenProps {
  room?: any;
  user_id?: string;
  onDisconnect?: () => void;
}

export function CompanionScreen({
  room,
  user_id = 'user',
  onDisconnect,
}: CompanionScreenProps) {
  const [companionState, setCompanionState] = useState<CompanionState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isPaywallVisible, setIsPaywallVisible] = useState<boolean>(false);

  // RevenueCat Entitlements Hook
  const {
    activeTier,
    isSubscribed,
    offerings,
    purchasePackage,
    restorePurchases,
    loading: purchasesLoading,
  } = useEntitlements();

  // Synchronize LiveKit viseme frames
  const { currentWeightsRef, activeViseme, updateFrame, setTargetWeights } = useVisemeSync(room);

  // Active speech viseme simulation loop for test / state toggle mode
  useEffect(() => {
    if (companionState !== 'speaking') {
      setTargetWeights({ viseme_sil: 1.0 });
      return;
    }

    let step = 0;
    const phonemes: OculusVisemeKey[] = [
      'viseme_AA',
      'viseme_O',
      'viseme_E',
      'viseme_PP',
      'viseme_AA',
      'viseme_I',
      'viseme_FF',
      'viseme_TH',
    ];

    const interval = setInterval(() => {
      const p = phonemes[step % phonemes.length];
      const weight = 0.55 + Math.sin(step * 0.8) * 0.35;
      setTargetWeights({
        [p]: weight,
        viseme_sil: Math.max(0, 1.0 - weight),
      });
      step++;
    }, 120);

    return () => {
      clearInterval(interval);
      setTargetWeights({ viseme_sil: 1.0 });
    };
  }, [companionState, setTargetWeights]);

  // 1-second Session Duration Countdown Timer - only active during conversation
  useEffect(() => {
    if (companionState === 'idle') return;

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [companionState]);

  // Handle Room Disconnect on Session Limit Expiry
  const handleSessionCapReached = () => {
    if (room && typeof room.disconnect === 'function') {
      try {
        room.disconnect();
      } catch {}
    }
    if (onDisconnect) {
      onDisconnect();
    }
    setIsPaywallVisible(true);
  };

  // Dedicated threshold effect to avoid state updates inside setState functional updaters
  useEffect(() => {
    if (shouldTriggerSessionCap(elapsedSeconds, activeTier)) {
      handleSessionCapReached();
    }
  }, [elapsedSeconds, activeTier]);

  // Listen for backend room disconnects
  useEffect(() => {
    if (!room || typeof room.on !== 'function') return;

    const handleRoomDisconnected = () => {
      // If disconnected unexpectedly, check if it was due to backend circuit breaker
      if (shouldTriggerSessionCap(elapsedSeconds, activeTier)) {
        setIsPaywallVisible(true);
      }
    };

    room.on('disconnected', handleRoomDisconnected);
    return () => {
      if (typeof room.off === 'function') {
        room.off('disconnected', handleRoomDisconnected);
      }
    };
  }, [room, elapsedSeconds, activeTier]);

  const remainingSeconds = calculateRemainingSessionSeconds(elapsedSeconds, activeTier);

  const formatTimer = (totalSeconds: number): string => {
    if (totalSeconds === Infinity) return '∞ Unlimited';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getStatusBadgeConfig = () => {
    switch (companionState) {
      case 'connecting':
        return {
          label: 'Connecting...',
          bgColor: 'rgba(245, 158, 11, 0.15)',
          borderColor: '#f59e0b',
          dotColor: '#f59e0b',
        };
      case 'listening':
        return {
          label: 'Listening',
          bgColor: 'rgba(16, 185, 129, 0.15)',
          borderColor: '#10b981',
          dotColor: '#10b981',
        };
      case 'speaking':
        return {
          label: 'Speaking (Echo)',
          bgColor: 'rgba(139, 92, 246, 0.15)',
          borderColor: '#8b5cf6',
          dotColor: '#8b5cf6',
        };
      case 'idle':
      default:
        return {
          label: 'Ready',
          bgColor: 'rgba(148, 163, 184, 0.12)',
          borderColor: '#64748b',
          dotColor: '#38bdf8',
        };
    }
  };

  const statusBadge = getStatusBadgeConfig();

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Echo</Text>
          <Text style={styles.headerSubtitle}>3D AI Companion</Text>
        </View>

        {/* Dynamic Status Badge */}
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusBadge.bgColor, borderColor: statusBadge.borderColor },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: statusBadge.dotColor }]} />
          <Text style={[styles.statusText, { color: statusBadge.borderColor }]}>
            {statusBadge.label}
          </Text>
        </View>
      </View>

      {/* Session Timer & Upgrade Pill */}
      <View style={styles.sessionTimerBar}>
        <View style={styles.timerContainer}>
          <Text style={styles.timerLabel}>Session Time Left:</Text>
          <Text
            style={[
              styles.timerValue,
              remainingSeconds < 300 && remainingSeconds !== Infinity && styles.timerValueWarning,
            ]}
          >
            {formatTimer(remainingSeconds)}
          </Text>
        </View>

        {!isSubscribed && (
          <TouchableOpacity
            style={styles.upgradeHeaderBtn}
            onPress={() => setIsPaywallVisible(true)}
          >
            <Text style={styles.upgradeHeaderBtnText}>⚡ Upgrade</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 3D Canvas View Container */}
      <View style={styles.canvasContainer}>
        <Canvas
          camera={{ position: [0, 0, 2.6], fov: 45 }}
          style={styles.canvas}
        >
          <Avatar
            visemeWeights={currentWeightsRef}
            updateFrame={updateFrame}
            isSpeaking={companionState === 'speaking'}
          />
        </Canvas>

        {/* Real-time Viseme Target Debug Overlay */}
        <View style={styles.visemeOverlay}>
          <Text style={styles.visemeDebugText}>
            Morph Target: {activeViseme}
          </Text>
        </View>
      </View>

      {/* Interactive Voice Controls */}
      <View style={styles.controlsContainer}>
        {/* State Toggle for Testing & Simulation */}
        <View style={styles.stateSelector}>
          {(['idle', 'listening', 'speaking'] as CompanionState[]).map((state) => (
            <TouchableOpacity
              key={state}
              style={[
                styles.stateButton,
                companionState === state && styles.stateButtonActive,
              ]}
              onPress={() => setCompanionState(state)}
            >
              <Text
                style={[
                  styles.stateButtonText,
                  companionState === state && styles.stateButtonTextActive,
                ]}
              >
                {state.charAt(0).toUpperCase() + state.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Main Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, isMuted && styles.actionBtnActive]}
            onPress={() => setIsMuted(!isMuted)}
          >
            <Text style={styles.actionBtnText}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.disconnectBtn]}
            onPress={onDisconnect || handleSessionCapReached}
          >
            <Text style={styles.disconnectBtnText}>End Call</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Subscription Paywall Modal */}
      <PaywallModal
        visible={isPaywallVisible}
        onClose={() => setIsPaywallVisible(false)}
        onPurchase={purchasePackage}
        onRestore={restorePurchases}
        offerings={offerings}
        isLoading={purchasesLoading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0d18',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sessionTimerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  timerValue: {
    fontSize: 13,
    color: '#38bdf8',
    fontWeight: '700',
    fontFamily: 'Courier',
  },
  timerValueWarning: {
    color: '#f59e0b',
  },
  upgradeHeaderBtn: {
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8b5cf6',
  },
  upgradeHeaderBtnText: {
    color: '#c4b5fd',
    fontSize: 11,
    fontWeight: '700',
  },
  canvasContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  canvas: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  visemeOverlay: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  visemeDebugText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Courier',
  },
  controlsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  stateSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 4,
  },
  stateButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  stateButtonActive: {
    backgroundColor: '#6366f1',
  },
  stateButtonText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
  },
  stateButtonTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  actionBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
  },
  actionBtnText: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '600',
  },
  disconnectBtn: {
    backgroundColor: '#dc2626',
    borderColor: '#b91c1c',
  },
  disconnectBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default CompanionScreen;
