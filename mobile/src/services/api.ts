/**
 * Backend API Client for LiveKit Room Token Minting & Companion Services.
 */

export interface TokenResponse {
  token: string;
  room: string;
  expires_at: number;
}

export interface MintTokenOptions {
  userId: string;
  roomName?: string;
  authToken?: string;
  backendUrl?: string;
}

/**
 * Resolves active backend endpoint URL from environment or local development defaults.
 */
export function getBackendBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL.replace(/\/+$/, '');
  }
  return 'http://localhost:8000';
}

/**
 * Requests short-lived signed LiveKit room JWT token from the backend server.
 */
export async function mintRoomToken(options: MintTokenOptions): Promise<TokenResponse> {
  const { userId, roomName, authToken, backendUrl } = options;
  const baseUrl = backendUrl || getBackendBaseUrl();
  const endpoint = `${baseUrl}/api/v1/auth/token`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const payload = {
    user_id: userId,
    room_name: roomName,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = `Failed to mint token (status ${response.status})`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.detail) {
        errorMessage = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
      }
    } catch {
      if (errorBody) errorMessage = errorBody;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}
