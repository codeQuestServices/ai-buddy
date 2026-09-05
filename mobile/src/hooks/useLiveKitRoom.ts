/**
 * Production LiveKit Room Connection Hook with Token Minting,
 * Exponential Backoff Reconnection, and Latency Monitoring.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Room, RoomEvent, ConnectionQuality } from 'livekit-client';
import { registerGlobals } from 'livekit-react-native';
import { mintRoomToken } from '../services/api';

// Initialize WebRTC and audio polyfills for React Native
try {
  if (typeof registerGlobals === 'function') {
    registerGlobals();
  }
} catch {
  // Ignored in non-native / test environments
}

export type LiveKitConnectionStatus =
  | 'idle'
  | 'minting_token'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export interface UseLiveKitRoomOptions {
  autoConnect?: boolean;
  userId?: string;
  roomName?: string;
  livekitUrl?: string;
  maxReconnectAttempts?: number;
}

export interface UseLiveKitRoomResult {
  room: Room | null;
  status: LiveKitConnectionStatus;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
  error: string | null;
  connect: (userId?: string, roomName?: string) => Promise<boolean>;
  disconnect: () => void;
  isAudioEnabled: boolean;
  toggleMicrophone: () => Promise<boolean>;
}

export function useLiveKitRoom(options: UseLiveKitRoomOptions = {}): UseLiveKitRoomResult {
  const {
    autoConnect = false,
    userId: initialUserId = 'default_user',
    roomName: initialRoomName,
    livekitUrl: customLiveKitUrl,
    maxReconnectAttempts = 5,
  } = options;

  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<LiveKitConnectionStatus>('idle');
  const [connectionQuality, setConnectionQuality] = useState<
    'excellent' | 'good' | 'poor' | 'unknown'
  >('unknown');
  const [error, setError] = useState<string | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);

  const roomRef = useRef<Room | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<any>(null);
  const manualDisconnectRef = useRef<boolean>(false);
  const lastCredentialsRef = useRef<{ userId: string; roomName?: string }>({
    userId: initialUserId,
    roomName: initialRoomName,
  });

  const getLiveKitUrl = useCallback((): string => {
    if (customLiveKitUrl) return customLiveKitUrl;
    if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_LIVEKIT_URL) {
      return process.env.EXPO_PUBLIC_LIVEKIT_URL;
    }
    return 'ws://localhost:7880';
  }, [customLiveKitUrl]);

  const cleanupRoom = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (roomRef.current) {
      try {
        roomRef.current.removeAllListeners();
        roomRef.current.disconnect();
      } catch {}
      roomRef.current = null;
    }
    setRoom(null);
  }, []);

  const connect = useCallback(
    async (overrideUserId?: string, overrideRoomName?: string): Promise<boolean> => {
      cleanupRoom();
      manualDisconnectRef.current = false;
      setError(null);

      const activeUserId = overrideUserId || lastCredentialsRef.current.userId || 'default_user';
      const activeRoomName = overrideRoomName || lastCredentialsRef.current.roomName;
      lastCredentialsRef.current = { userId: activeUserId, roomName: activeRoomName };

      try {
        setStatus('minting_token');
        const tokenData = await mintRoomToken({
          userId: activeUserId,
          roomName: activeRoomName,
        });

        setStatus('connecting');
        const newRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        // Register room lifecycle listeners
        newRoom.on(RoomEvent.Reconnecting, () => {
          setStatus('reconnecting');
        });

        newRoom.on(RoomEvent.Reconnected, () => {
          setStatus('connected');
          reconnectAttemptRef.current = 0;
          setConnectionQuality('good');
        });

        newRoom.on(RoomEvent.Disconnected, () => {
          if (!manualDisconnectRef.current) {
            // Attempt automatic exponential backoff retry
            if (reconnectAttemptRef.current < maxReconnectAttempts) {
              const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttemptRef.current));
              reconnectAttemptRef.current += 1;
              setStatus('reconnecting');
              reconnectTimeoutRef.current = setTimeout(() => {
                connect(lastCredentialsRef.current.userId, lastCredentialsRef.current.roomName);
              }, delay);
              return;
            }
          }
          setStatus('disconnected');
          setConnectionQuality('unknown');
        });

        newRoom.on(RoomEvent.ConnectionQualityChanged, (quality: ConnectionQuality) => {
          switch (quality) {
            case ConnectionQuality.Excellent:
              setConnectionQuality('excellent');
              break;
            case ConnectionQuality.Good:
              setConnectionQuality('good');
              break;
            case ConnectionQuality.Poor:
              setConnectionQuality('poor');
              break;
            default:
              setConnectionQuality('unknown');
          }
        });

        const targetUrl = getLiveKitUrl();
        await newRoom.connect(targetUrl, tokenData.token);

        try {
          if (typeof newRoom.localParticipant?.setMicrophoneEnabled === 'function') {
            await newRoom.localParticipant.setMicrophoneEnabled(true);
            setIsAudioEnabled(true);
          }
        } catch (audioErr: any) {
          console.warn('[useLiveKitRoom] Could not enable microphone automatically:', audioErr);
        }

        roomRef.current = newRoom;
        setRoom(newRoom);
        setStatus('connected');
        return true;
      } catch (err: any) {
        const msg = err?.message || 'Failed to connect to companion room';
        setError(msg);
        setStatus('error');
        return false;
      }
    },
    [cleanupRoom, getLiveKitUrl, maxReconnectAttempts]
  );

  const disconnect = useCallback(() => {
    manualDisconnectRef.current = true;
    cleanupRoom();
    setStatus('disconnected');
    setConnectionQuality('unknown');
  }, [cleanupRoom]);

  const toggleMicrophone = useCallback(async (): Promise<boolean> => {
    if (!roomRef.current || !roomRef.current.localParticipant) {
      return false;
    }
    try {
      const nextState = !isAudioEnabled;
      await roomRef.current.localParticipant.setMicrophoneEnabled(nextState);
      setIsAudioEnabled(nextState);
      return nextState;
    } catch {
      return isAudioEnabled;
    }
  }, [isAudioEnabled]);

  useEffect(() => {
    if (autoConnect) {
      connect(initialUserId, initialRoomName);
    }
    return () => {
      cleanupRoom();
    };
  }, [autoConnect, initialUserId, initialRoomName, connect, cleanupRoom]);

  return {
    room,
    status,
    connectionQuality,
    error,
    connect,
    disconnect,
    isAudioEnabled,
    toggleMicrophone,
  };
}
