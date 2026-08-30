# AI Buddy PROJECT ARCHITECTURE CONTRACT

## Mandatory Tech Stack
- Frontend: Expo (React Native), React Three Fiber (R3F) for 3D GLTF rendering.
- Backend: Python 3.11+, LiveKit Agents SDK (`livekit-agents`), OpenAI Realtime API.
- Billing: RevenueCat SDK (`react-native-purchases`).
- Memory: Supabase (pgvector) + Mem0 Python SDK.

## Strict Rules & Non-Negotiables
1. NEVER write direct native WebRTC code in React Native; always route through `livekit-react-native`.
2. NEVER store API keys on the mobile client. RevenueCat handles entitlement validation; Supabase mints short-lived LiveKit room tokens.
3. Every Python backend module must have a corresponding `pytest` unit test in `/tests`.
4. Viseme morph target names in the 3D canvas must strictly adhere to Oculus standards (`viseme_AA`, `viseme_E`, `viseme_O`, `viseme_PP`).
5. All Expo code must compile cleanly with `npx tsc --noEmit` with zero type errors.


## Directory Structure & Isolation
- `/mobile`: Expo (React Native) iOS app container.
- `/backend`: Python 3.11+ LiveKit Agent worker and endpoints.
- `/tests`: Python unit and integration tests.
- `.agents/memory/`: Project state memory bank.

## Required Environment Schemas (Never commit actual secrets)
- Backend (`/backend/.env`):
  - `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
  - `OPENAI_API_KEY`
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - `MEM0_API_KEY`
- Mobile (`/mobile/.env`):
  - `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_REVENUECAT_APPLE_KEY`
