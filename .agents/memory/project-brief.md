# AI Buddy - Project Brief

## Overview
**AI Buddy** is an intelligent, real-time conversational 3D avatar companion application. It provides users with natural voice-driven interactions with an expressive 3D character, persistent contextual memory across conversations, and seamless subscription monetization.

## Core Features & Capabilities
1. **Interactive 3D Companion Avatar**:
   - 3D GLTF rendering in React Native using React Three Fiber (R3F).
   - Real-time facial animation synchronized with speech using Oculus viseme morph targets (`viseme_AA`, `viseme_E`, `viseme_O`, `viseme_PP`, etc.).
2. **Real-time Voice & Audio Streaming**:
   - Ultra-low latency two-way voice communication via LiveKit Agents SDK and `livekit-react-native`.
   - OpenAI Realtime API integration for natural, conversational dialogue.
3. **Long-Term Memory & Personalization**:
   - Supabase (pgvector) + Mem0 Python SDK for user memory extraction, storage, and retrieval across sessions.
4. **Entitlements & Subscriptions**:
   - Integrated billing and subscription management via RevenueCat (`react-native-purchases`).

## Non-Negotiable Architectural Rules
- **No Direct WebRTC**: Never write direct native WebRTC code in React Native; always route through `livekit-react-native`.
- **Zero API Keys on Client**: RevenueCat handles client entitlement validation; Supabase mints short-lived LiveKit room tokens. No service keys on mobile.
- **Test Coverage**: Every Python backend module must have a corresponding `pytest` unit test in `/tests`.
- **Oculus Viseme Standard**: Viseme morph target names in the 3D canvas must strictly adhere to Oculus standards (`viseme_AA`, `viseme_E`, `viseme_O`, `viseme_PP`).
- **Clean TypeScript**: All Expo code must compile cleanly with `npx tsc --noEmit` with zero type errors.
