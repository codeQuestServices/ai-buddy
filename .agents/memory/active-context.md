# Active Context

## Current Status
- **Phase**: Post-Audit Quality & Bug Fixes Implementation Complete ([APPROVED])
- **Overall Project Status**: **All 8 Critical Bugs, 4 Structural/Environment Issues, and Key Enhancements from TESTING-REPORT-2026-09-05.md Fully Implemented and Verified**.
- **Test Suite Status**: 38 Backend Pytest tests passed (100%), 27 Mobile Jest tests passed (100%), 0 TypeScript compilation errors (`npx tsc --noEmit`), 0 DESIGN.md linter errors/warnings (`@google/design.md lint`).

## Recent Changes
- Resolved all findings from `TESTING-REPORT-2026-09-05.md`:
  - **Critical Bug 1.1**: Connected `updateFrame(delta)` inside Three.js `useFrame` loop in both `ProceduralAvatarMesh` and `GLTFAvatarMesh` (`mobile/src/components/Avatar.tsx`). Added critically damped spring smoothing (`interpolateVisemeWeightsSpring`) and procedural audio amplitude fallback (`generateProceduralVisemes`) in `mobile/src/hooks/useVisemeSync.ts`.
  - **Critical Bug 1.2**: Implemented `VisemeStreamEmitter` in `backend/app/agent.py` broadcasting real-time Oculus viseme frames at 30 fps over the LiveKit data channel during agent speaking turns, emitting clean silence frames on stop.
  - **Critical Bug 1.3**: Created `mobile/src/services/api.ts` (token minting with Supabase bearer token support) and `mobile/src/hooks/useLiveKitRoom.ts` (room connection lifecycle, automatic exponential backoff reconnection, connection quality telemetry). Connected to `App.tsx` and `CompanionScreen.tsx`.
  - **Critical Bug 1.4**: Fixed session countdown timer in `CompanionScreen.tsx` to only run when the companion is in an active conversational state (`companionState !== 'idle'`).
  - **Critical Bug 1.5**: Eliminated state updates inside `setElapsedSeconds` functional updater by moving session cap threshold checks into an isolated `useEffect([elapsedSeconds, activeTier])`.
  - **Critical Bug 1.6**: Wrapped `GLTFAvatarMesh` inside `<React.Suspense fallback={<ProceduralAvatarMesh ... />}>` and exported `preloadAvatarModel` utility.
  - **Critical Bug 1.7**: Added listener cleanup `Purchases.removeCustomerInfoUpdateListener` in `mobile/src/hooks/useEntitlements.ts`.
  - **Critical Bug 1.8**: Changed `on_shutdown` callback in `backend/app/agent.py` to `async` and awaited `store_user_facts` directly to guarantee persistent memory storage before worker teardown.
  - **Structural Issues 2.1 - 2.4**: Consolidated safe area views to root `App.tsx`, resolved live `PurchasesPackage` objects with dynamic localized currency strings in `PaywallModal.tsx`, safeguarded `TOKEN_TTL_MINUTES` parsing with try-except in `backend/app/config.py`, and added container `sys.path` resolution in `backend/app/modal_app.py`.

## Next Steps / Post-MVP
- Deploy LiveKit worker to Modal via `modal deploy backend/app/modal_app.py`.
- Submit iOS app bundle via `eas build --platform ios --profile production`.
