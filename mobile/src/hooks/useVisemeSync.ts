/**
 * Oculus Viseme Synchronization & Interpolation Hook for LiveKit Data Channels.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export const OCULUS_VISEME_KEYS = [
  'viseme_sil',
  'viseme_PP',
  'viseme_FF',
  'viseme_TH',
  'viseme_DD',
  'viseme_kk',
  'viseme_CH',
  'viseme_SS',
  'viseme_nn',
  'viseme_RR',
  'viseme_AA',
  'viseme_E',
  'viseme_I',
  'viseme_O',
  'viseme_U',
] as const;

export type OculusVisemeKey = typeof OCULUS_VISEME_KEYS[number];
export type VisemeWeights = Record<OculusVisemeKey, number>;

/**
 * Creates an empty/neutral initial viseme weight mapping.
 */
export function createDefaultVisemeWeights(): VisemeWeights {
  return {
    viseme_sil: 1.0,
    viseme_PP: 0.0,
    viseme_FF: 0.0,
    viseme_TH: 0.0,
    viseme_DD: 0.0,
    viseme_kk: 0.0,
    viseme_CH: 0.0,
    viseme_SS: 0.0,
    viseme_nn: 0.0,
    viseme_RR: 0.0,
    viseme_AA: 0.0,
    viseme_E: 0.0,
    viseme_I: 0.0,
    viseme_O: 0.0,
    viseme_U: 0.0,
  };
}

/**
 * Normalizes any incoming viseme name to canonical Oculus viseme naming standard.
 */
export function normalizeVisemeKey(key: string): OculusVisemeKey | null {
  const clean = key.trim();
  const lower = clean.toLowerCase();

  // Exact match first
  for (const k of OCULUS_VISEME_KEYS) {
    if (k === clean || k.toLowerCase() === lower) {
      return k;
    }
  }

  // Handle shorthand names (e.g. 'aa' -> 'viseme_AA', 'e' -> 'viseme_E')
  const stripped = lower.startsWith('viseme_') ? lower.replace('viseme_', '') : lower;
  for (const k of OCULUS_VISEME_KEYS) {
    const kStripped = k.replace('viseme_', '').toLowerCase();
    if (kStripped === stripped) {
      return k;
    }
  }

  return null;
}

/**
 * Parses raw LiveKit data packet payloads into a normalized mapping of Oculus viseme weights.
 */
export function parseVisemePayload(data: unknown): Partial<Record<OculusVisemeKey, number>> | null {
  if (!data) return null;

  try {
    let jsonStr: string;

    if (typeof data === 'string') {
      jsonStr = data;
    } else if (data instanceof Uint8Array || (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer)) {
      const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
      if (typeof TextDecoder !== 'undefined') {
        jsonStr = new TextDecoder().decode(u8);
      } else {
        jsonStr = String.fromCharCode.apply(null, Array.from(u8));
      }
    } else if (typeof data === 'object') {
      jsonStr = JSON.stringify(data);
    } else {
      return null;
    }

    const parsed = typeof data === 'object' && !(data instanceof Uint8Array) ? data : JSON.parse(jsonStr);

    const result: Partial<Record<OculusVisemeKey, number>> = {};

    // Handle array of [viseme, weight] or object { viseme: weight } or { visemes: { ... } }
    const sourceObj: Record<string, any> =
      parsed && typeof parsed === 'object' && 'visemes' in parsed && typeof parsed.visemes === 'object'
        ? parsed.visemes
        : parsed;

    if (Array.isArray(sourceObj)) {
      for (const entry of sourceObj) {
        if (Array.isArray(entry) && entry.length >= 2) {
          const normKey = normalizeVisemeKey(String(entry[0]));
          if (normKey) {
            const rawWeight = Number(entry[1]);
            result[normKey] = Math.max(0.0, Math.min(1.0, isNaN(rawWeight) ? 0.0 : rawWeight));
          }
        }
      }
    } else if (sourceObj && typeof sourceObj === 'object') {
      for (const [rawKey, rawVal] of Object.entries(sourceObj)) {
        const normKey = normalizeVisemeKey(rawKey);
        if (normKey) {
          const numVal = Number(rawVal);
          result[normKey] = Math.max(0.0, Math.min(1.0, isNaN(numVal) ? 0.0 : numVal));
        }
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

/**
 * Linearly interpolates (lerps) viseme weights towards targets with damping speed.
 * Clamps result between 0.0 and 1.0 to prevent morph target distortion.
 */
export function interpolateVisemeWeights(
  current: VisemeWeights,
  target: Partial<Record<OculusVisemeKey, number>>,
  deltaSeconds: number,
  dampingSpeed: number = 20.0
): VisemeWeights {
  const factor = Math.min(1.0, Math.max(0.0, deltaSeconds * dampingSpeed));
  const nextWeights: VisemeWeights = { ...current };

  for (const key of OCULUS_VISEME_KEYS) {
    const targetVal = target[key] ?? (key === 'viseme_sil' ? 1.0 : 0.0);
    const clampedTarget = Math.max(0.0, Math.min(1.0, targetVal));
    const currentVal = current[key] ?? 0.0;
    const interpolated = currentVal + (clampedTarget - currentVal) * factor;
    nextWeights[key] = Math.max(0.0, Math.min(1.0, interpolated));
  }

  return nextWeights;
}

/**
 * Custom React hook managing real-time viseme stream subscriptions and smooth interpolation.
 */
export function useVisemeSync(room?: any) {
  const targetWeightsRef = useRef<Partial<Record<OculusVisemeKey, number>>>({});
  const currentWeightsRef = useRef<VisemeWeights>(createDefaultVisemeWeights());
  const [activeViseme, setActiveViseme] = useState<OculusVisemeKey>('viseme_sil');

  const onDataReceived = useCallback((payload: Uint8Array | string, participant?: any) => {
    const parsed = parseVisemePayload(payload);
    if (parsed) {
      targetWeightsRef.current = parsed;

      // Find highest influence viseme
      let maxKey: OculusVisemeKey = 'viseme_sil';
      let maxVal = 0.0;
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'number' && v > maxVal) {
          maxVal = v;
          maxKey = k as OculusVisemeKey;
        }
      }
      if (maxVal > 0.2) {
        setActiveViseme(maxKey);
      }
    }
  }, []);

  useEffect(() => {
    if (!room) return;

    // Listen to LiveKit room DataReceived event if present
    if (typeof room.on === 'function') {
      room.on('dataReceived', onDataReceived);
      return () => {
        if (typeof room.off === 'function') {
          room.off('dataReceived', onDataReceived);
        }
      };
    }
  }, [room, onDataReceived]);

  /**
   * Advance interpolation by delta frame time (called in useFrame).
   */
  const updateFrame = useCallback((deltaSeconds: number): VisemeWeights => {
    const next = interpolateVisemeWeights(
      currentWeightsRef.current,
      targetWeightsRef.current,
      deltaSeconds
    );
    currentWeightsRef.current = next;
    return next;
  }, []);

  return {
    targetWeightsRef,
    currentWeightsRef,
    activeViseme,
    onDataReceived,
    updateFrame,
  };
}
