/**
 * Unit tests for Phase 4: 3D Avatar & Oculus Viseme Synchronization.
 */

import { describe, test, expect } from '@jest/globals';
import {
  OCULUS_VISEME_KEYS,
  createDefaultVisemeWeights,
  normalizeVisemeKey,
  parseVisemePayload,
  interpolateVisemeWeights,
  VisemeWeights,
} from '../src/hooks/useVisemeSync';

describe('Oculus Viseme Standard Mappings', () => {
  test('strictly adheres to Oculus viseme morph target naming standard', () => {
    const requiredKeys = [
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
    ];

    expect(OCULUS_VISEME_KEYS).toEqual(requiredKeys);
    expect(OCULUS_VISEME_KEYS.length).toBe(15);
  });

  test('normalizes standard and shorthand viseme names to canonical Oculus keys', () => {
    expect(normalizeVisemeKey('viseme_AA')).toBe('viseme_AA');
    expect(normalizeVisemeKey('viseme_aa')).toBe('viseme_AA');
    expect(normalizeVisemeKey('AA')).toBe('viseme_AA');
    expect(normalizeVisemeKey('aa')).toBe('viseme_AA');
    expect(normalizeVisemeKey('viseme_E')).toBe('viseme_E');
    expect(normalizeVisemeKey('e')).toBe('viseme_E');
    expect(normalizeVisemeKey('viseme_O')).toBe('viseme_O');
    expect(normalizeVisemeKey('o')).toBe('viseme_O');
    expect(normalizeVisemeKey('viseme_PP')).toBe('viseme_PP');
    expect(normalizeVisemeKey('pp')).toBe('viseme_PP');
    expect(normalizeVisemeKey('viseme_I')).toBe('viseme_I');
    expect(normalizeVisemeKey('i')).toBe('viseme_I');
    expect(normalizeVisemeKey('viseme_U')).toBe('viseme_U');
    expect(normalizeVisemeKey('u')).toBe('viseme_U');
    expect(normalizeVisemeKey('invalid_blendshape')).toBeNull();
  });

  test('creates neutral default viseme weights with silence enabled', () => {
    const weights = createDefaultVisemeWeights();
    expect(weights.viseme_sil).toBe(1.0);
    expect(weights.viseme_AA).toBe(0.0);
    expect(weights.viseme_E).toBe(0.0);
    expect(weights.viseme_O).toBe(0.0);
    expect(weights.viseme_PP).toBe(0.0);
    expect(weights.viseme_I).toBe(0.0);
    expect(weights.viseme_U).toBe(0.0);
  });
});

describe('LiveKit Data Channel Viseme Frame Parsing', () => {
  test('parses JSON string with nested visemes object', () => {
    const rawJson = JSON.stringify({
      visemes: {
        viseme_AA: 0.85,
        viseme_O: 0.45,
      },
    });

    const parsed = parseVisemePayload(rawJson);
    expect(parsed).not.toBeNull();
    expect(parsed?.viseme_AA).toBe(0.85);
    expect(parsed?.viseme_O).toBe(0.45);
  });

  test('parses JSON array of tuple pairs', () => {
    const rawArrayJson = JSON.stringify([
      ['viseme_E', 0.65],
      ['viseme_PP', 0.9],
    ]);

    const parsed = parseVisemePayload(rawArrayJson);
    expect(parsed).not.toBeNull();
    expect(parsed?.viseme_E).toBe(0.65);
    expect(parsed?.viseme_PP).toBe(0.9);
  });

  test('parses binary Uint8Array data packets', () => {
    const payloadObj = { viseme_I: 0.72, viseme_U: 0.55 };
    const jsonStr = JSON.stringify(payloadObj);
    const uint8 = new TextEncoder().encode(jsonStr);

    const parsed = parseVisemePayload(uint8);
    expect(parsed).not.toBeNull();
    expect(parsed?.viseme_I).toBe(0.72);
    expect(parsed?.viseme_U).toBe(0.55);
  });

  test('clamps out-of-bounds weight values to [0.0, 1.0]', () => {
    const rawJson = JSON.stringify({
      viseme_AA: 1.75,
      viseme_O: -0.5,
    });

    const parsed = parseVisemePayload(rawJson);
    expect(parsed?.viseme_AA).toBe(1.0);
    expect(parsed?.viseme_O).toBe(0.0);
  });

  test('returns null gracefully on empty or malformed data', () => {
    expect(parseVisemePayload(null)).toBeNull();
    expect(parseVisemePayload('')).toBeNull();
    expect(parseVisemePayload('{ invalid json')).toBeNull();
  });
});

describe('Viseme Weight Interpolation & Damping', () => {
  test('smoothly interpolates weights towards targets over delta time', () => {
    const current = createDefaultVisemeWeights();
    const target = { viseme_AA: 1.0, viseme_O: 0.5 };
    const deltaSeconds = 0.016; // ~60fps frame
    const speed = 20.0;

    const next = interpolateVisemeWeights(current, target, deltaSeconds, speed);

    // Should move closer to target (factor = 0.016 * 20 = 0.32)
    expect(next.viseme_AA).toBeGreaterThan(0.0);
    expect(next.viseme_AA).toBeLessThanOrEqual(1.0);
    expect(next.viseme_AA).toBeCloseTo(0.32, 2);

    expect(next.viseme_O).toBeGreaterThan(0.0);
    expect(next.viseme_O).toBeLessThanOrEqual(0.5);
    expect(next.viseme_O).toBeCloseTo(0.16, 2);
  });

  test('fully reaches target after sufficient elapsed frames', () => {
    let weights = createDefaultVisemeWeights();
    const target = { viseme_E: 0.8 };

    // Simulate 30 frames at 60fps (~0.5 seconds)
    for (let i = 0; i < 30; i++) {
      weights = interpolateVisemeWeights(weights, target, 0.016, 20.0);
    }

    expect(weights.viseme_E).toBeCloseTo(0.8, 1);
  });

  test('guarantees clamped bounds between 0.0 and 1.0 under large deltas', () => {
    const current = createDefaultVisemeWeights();
    const target = { viseme_PP: 1.0 };
    const largeDelta = 2.0; // 2 seconds

    const next = interpolateVisemeWeights(current, target, largeDelta, 50.0);
    expect(next.viseme_PP).toBe(1.0);
  });
});
