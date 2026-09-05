/**
 * Unit tests for API token minting, LiveKit room connection, and billing cleanup.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { getBackendBaseUrl, mintRoomToken } from '../src/services/api';

describe('Backend API Token Minting Service', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('resolves default backend base URL if env variable is unset', () => {
    const url = getBackendBaseUrl();
    expect(url).toBe('http://localhost:8000');
  });

  test('successfully mints LiveKit token from backend', async () => {
    const mockTokenResponse = {
      token: 'jwt_mock_access_token_xyz',
      room: 'room_test_user',
      expires_at: 1757000000,
    };

    (global as any).fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => mockTokenResponse,
      })
    );

    const result = await mintRoomToken({
      userId: 'test_user',
      roomName: 'custom_room',
    });

    expect(result.token).toBe('jwt_mock_access_token_xyz');
    expect(result.room).toBe('room_test_user');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/auth/token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ user_id: 'test_user', room_name: 'custom_room' }),
      })
    );
  });

  test('includes Authorization Bearer header when Supabase authToken is provided', async () => {
    (global as any).fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ token: 'mock', room: 'mock', expires_at: 123 }),
      })
    );

    await mintRoomToken({
      userId: 'test_user',
      authToken: 'supabase_jwt_session_token',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer supabase_jwt_session_token',
        }),
      })
    );
  });

  test('throws descriptive error on backend 403 / 400 error responses', async () => {
    (global as any).fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ detail: 'User does not have an active entitlement' }),
      })
    );

    await expect(
      mintRoomToken({
        userId: 'unentitled_user',
      })
    ).rejects.toThrow('User does not have an active entitlement');
  });
});
