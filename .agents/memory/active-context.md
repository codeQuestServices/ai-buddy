# Active Context

## Current Status
- **Phase**: Phase 1 (Security & Token Infrastructure) Complete & Verified ([APPROVED])
- **Active Task**: FastAPI authentication and token minting service operational with automated test suite passing (10/10 tests).

## Recent Changes
- Created FastAPI backend entry point at `backend/app/main.py` with CORS support, health check `/healthz`, and custom request validation handler returning 400 Bad Request on invalid/missing payloads.
- Implemented `backend/app/auth.py` providing `POST /api/v1/auth/token` endpoint for minting short-lived (15-min) LiveKit access tokens with room join/publish/subscribe permissions.
- Implemented `backend/app/services/entitlements.py` for user entitlement verification against Supabase user metadata and RevenueCat customer info using service keys.
- Created `backend/app/config.py` loading server configuration and secrets (`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) from environment variables while ensuring no secrets are exposed in API responses.
- Created root `pytest.ini` and `backend/__init__.py`.
- Scaffolding test suite `tests/test_auth.py` covering successful token generation, default and custom room names, parameter validation (400 Bad Request), entitlement rejection (403 Forbidden), mocked entitlement dependency overrides, TTL claims verification, and response secret isolation.
- Verified test suite with `pytest tests/test_auth.py` (100% passing).

## Next Steps
- Phase 2: LiveKit Agent Python worker implementation with OpenAI Realtime API for two-way voice streaming.
- Phase 3: Supabase (pgvector) + Mem0 long-term memory integration.
- Phase 4: Expo React Native 3D Avatar canvas with Oculus visemes in React Three Fiber.
- Phase 5: RevenueCat mobile subscription paywall & client integration.
