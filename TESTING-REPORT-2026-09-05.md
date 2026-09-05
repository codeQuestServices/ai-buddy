# AI Buddy Local Testing & Quality Audit Report
**Date:** September 5, 2026  
**Environment:** Local Testing (macOS, Python 3.13 / Node 20 / Expo SDK 57 / LiveKit Agents 0.8)  
**Scope:** Python Backend (`/backend`), Expo Mobile App (`/mobile`), Integration Tests (`/tests`), and System Architecture.

---

## Executive Summary

A comprehensive end-to-end local test suite and static code analysis was executed across the AI Buddy companion platform. 
- **Automated Test Results:**
  - Backend Unit & Integration Tests: **35 / 35 Passed (100%)** (`./.venv/bin/pytest tests`)
  - Mobile Jest Tests: **19 / 19 Passed (100%)** (`npm test` in `/mobile`)
  - Mobile TypeScript Compilation: **0 Errors** (`npx tsc --noEmit` in `/mobile`)
  - Design Token Linter: **0 Errors, 0 Warnings** (`npx -y @google/design.md lint DESIGN.md`)
  - FastAPI HTTP Endpoints: **Verified** (Healthcheck `GET /healthz`, Token Minting `POST /api/v1/auth/token`, and validation edge cases).

While the foundational architecture and test suite demonstrate high structural integrity, the audit identified several **critical functional bugs**, **runtime edge-case issues**, and **key opportunities for improvements and enhancements** required before production release.

---

## 1. Critical Bugs & Runtime Defects

### 1.1 Viseme Interpolation Loop Disconnect (`useVisemeSync.ts` & `Avatar.tsx`)
- **Severity:** High (Broken Feature)
- **Component:** `mobile/src/hooks/useVisemeSync.ts` and `mobile/src/components/Avatar.tsx`
- **Description:**  
  `useVisemeSync` provides a frame interpolation function `updateFrame(deltaSeconds)` designed to advance `currentWeightsRef.current` towards `targetWeightsRef.current`. However, neither `CompanionScreen.tsx` nor `Avatar.tsx` calls `updateFrame` in their render loop (`useFrame` or `requestAnimationFrame`).
- **Impact:**  
  `currentWeightsRef.current` remains permanently at default initial values (`viseme_sil: 1.0`, all others `0.0`). When real-time viseme data frames are received over the LiveKit data channel, the 3D avatar's mouth never interpolates or animates.
- **Recommended Fix:**  
  Pass `updateFrame` into `<Avatar />` and invoke `updateFrame(delta)` inside `ProceduralAvatarMesh` and `GLTFAvatarMesh`'s `useFrame` hook, or run an animation frame loop directly within `useVisemeSync`.

---

### 1.2 Backend Missing Viseme Audio Stream Generation (`agent.py`)
- **Severity:** High (Architectural Gap)
- **Component:** `backend/app/agent.py`
- **Description:**  
  The mobile client listens for real-time Oculus viseme data packets on the LiveKit data channel (`dataReceived`). However, `backend/app/agent.py` configures `voice.Agent` with OpenAI Realtime API and Silero VAD, but **does not compute or publish any viseme frames** via `ctx.room.local_participant.publish_data()`.
- **Impact:**  
  In live LiveKit sessions, zero viseme data packets are transmitted. The client's `activeViseme` remains permanently on `viseme_sil`.
- **Recommended Fix:**  
  Implement a phonetic / acoustic alignment pipeline or audio amplitude FFT analyzer on the Python worker (or client audio track tap) that emits normalized Oculus viseme target weights (`viseme_AA`, `viseme_O`, `viseme_E`, `viseme_PP`) over the data channel at 30-60 fps.

---

### 1.3 Mobile Client Lacks LiveKit Token Minting & Room Connection Flow
- **Severity:** High (Simulation Only)
- **Component:** `mobile/App.tsx` and `mobile/src/screens/CompanionScreen.tsx`
- **Description:**  
  `mobile/App.tsx` renders `<CompanionScreen />` without passing an active `room` or `user_id` prop. Additionally, there is no service or hook in `mobile/src` that sends an HTTP request to `POST /api/v1/auth/token` to fetch a LiveKit access token and instantiate `new Room().connect(...)`.
- **Impact:**  
  The mobile application only operates in mock state-toggle mode (`idle`, `listening`, `speaking`), completely decoupled from the LiveKit backend worker.
- **Recommended Fix:**  
  Create a `useLiveKitRoom(userId)` hook in `mobile/src/hooks/` that fetches a token from `${BACKEND_URL}/api/v1/auth/token`, connects to LiveKit via `livekit-react-native`, and passes the live `room` instance into `CompanionScreen`.

---

### 1.4 Session Countdown Timer Runs Unconditionally on Mount (`CompanionScreen.tsx`)
- **Severity:** Medium (UX Defect)
- **Component:** `mobile/src/screens/CompanionScreen.tsx` (Lines 57–71)
- **Description:**  
  The 1-second interval timer in `CompanionScreen.tsx` starts counting elapsed time immediately when the screen mounts, even when the user is disconnected, idle, or hasn't started a conversation.
- **Impact:**  
  A free-tier user who leaves the application open in an idle state for 20 minutes will have their session cap triggered and the Paywall modal forced open without ever speaking to the companion.
- **Recommended Fix:**  
  Only increment `elapsedSeconds` when the companion is actively connected and conversing (e.g., `companionState !== 'idle' && room?.state === 'connected'`).

---

### 1.5 State Update Triggered Inside `setState` Functional Updater (`CompanionScreen.tsx`)
- **Severity:** Medium (React Anti-Pattern)
- **Component:** `mobile/src/screens/CompanionScreen.tsx` (Lines 63–65)
- **Description:**  
  ```tsx
  setElapsedSeconds((prev) => {
    const next = prev + 1;
    if (shouldTriggerSessionCap(next, activeTier)) {
      handleSessionCapReached(); // Invokes setIsPaywallVisible(true)
    }
    return next;
  });
  ```
  Calling `handleSessionCapReached()`, which executes `setIsPaywallVisible(true)`, from inside the functional updater of `setElapsedSeconds` triggers state updates during another component's state calculation.
- **Impact:**  
  Can cause React state warning logs ("Cannot update a component while rendering a different component"), batching delays, or unexpected re-renders in React 18/19.
- **Recommended Fix:**  
  Separate the timer increment from the threshold check by using a `useEffect` keyed on `[elapsedSeconds, activeTier]`.

---

### 1.6 Missing `<Suspense>` Boundary for GLTF Avatars (`Avatar.tsx`)
- **Component:** `mobile/src/components/Avatar.tsx` (Line 223)
- **Severity:** High (Crash Hazard)
- **Description:**  
  `GLTFAvatarMesh` invokes `@react-three/drei`'s `useGLTF(modelUrl)`, which suspends React rendering while downloading assets. When a `modelUrl` prop is provided to `<Avatar />`, there is no `<Suspense fallback={...}>` component surrounding the mesh inside the Three.js Canvas.
- **Impact:**  
  Loading any custom 3D model immediately throws an unhandled React suspense promise, crashing the 3D Canvas.
- **Recommended Fix:**  
  Wrap `GLTFAvatarMesh` in `<React.Suspense fallback={<ProceduralAvatarMesh ... />}>`.

---

### 1.7 Memory Leak: Missing Cleanup for RevenueCat Listener (`useEntitlements.ts`)
- **Severity:** Medium (Resource Leak)
- **Component:** `mobile/src/hooks/useEntitlements.ts` (Lines 124–127)
- **Description:**  
  `Purchases.addCustomerInfoUpdateListener(customerInfoListener)` is registered in `useEffect`, but the returned cleanup function does not remove the listener.
- **Impact:**  
  Every time the component mounting `useEntitlements` remounts or fast-refreshes in development, duplicate listeners accumulate in memory.
- **Recommended Fix:**  
  Add `Purchases.removeCustomerInfoUpdateListener(customerInfoListener)` in the effect cleanup.

---

### 1.8 Unawaited Background Task During Worker Shutdown (`agent.py`)
- **Severity:** Medium (Data Loss)
- **Component:** `backend/app/agent.py` (Lines 239–244)
- **Description:**  
  In the shutdown callback, `asyncio.create_task(store_user_facts(...))` is created inside a synchronous callback function.
- **Impact:**  
  Because the shutdown callback is synchronous and not awaited by the event loop during container teardown, the background fact extraction task can be aborted before Mem0 writes complete.
- **Recommended Fix:**  
  Make `on_shutdown` an `async` function and await `store_user_facts(...)` directly so LiveKit waits for persistent memory storage before terminating the process.

---

## 2. Structural & Environment Issues

### 2.1 Nested `SafeAreaView` & Conflicting Status Bars
- **Component:** `mobile/App.tsx` and `mobile/src/screens/CompanionScreen.tsx`
- **Issue:** `App.tsx` wraps `<CompanionScreen />` in `<SafeAreaView>`, and `CompanionScreen.tsx` renders its own internal `<SafeAreaView>`. This creates double insets on iOS devices with Dynamic Island. Additionally, both `expo-status-bar` and `react-native`'s `StatusBar` are rendered simultaneously.
- **Fix:** Consolidate safe area handling to `App.tsx` or use `react-native-safe-area-context`'s `useSafeAreaInsets()`. Standardize on `expo-status-bar`.

### 2.2 RevenueCat Package Object Mismatch (`PaywallModal.tsx`)
- **Component:** `mobile/src/components/PaywallModal.tsx`
- **Issue:** `PaywallModal.tsx` invokes `onPurchase({ identifier: planId })` with a synthetic object literal. In the production RevenueCat SDK, `Purchases.purchasePackage` requires a full `PurchasesPackage` object from `PurchasesOfferings.current.availablePackages`.
- **Fix:** Connect `PaywallModal` to `offerings` from `useEntitlements()` and pass the resolved `PurchasesPackage` directly to `purchasePackage`.

### 2.3 Unhandled Configuration Cast Exceptions (`config.py`)
- **Component:** `backend/app/config.py`
- **Issue:** `int(os.getenv("TOKEN_TTL_MINUTES", "15"))` crashes with an uncaught `ValueError` if the environment variable is set to an empty string or invalid number.
- **Fix:** Add a try-except fallback:
  ```python
  raw_ttl = os.getenv("TOKEN_TTL_MINUTES", "15")
  self.token_ttl_minutes = int(raw_ttl) if raw_ttl and raw_ttl.isdigit() else 15
  ```

### 2.4 Modal Deployment Package Root Resolution (`modal_app.py`)
- **Component:** `backend/app/modal_app.py`
- **Issue:** Code files inside `backend/app/` use imports like `from backend.app.services.memory import ...`. If `add_local_python_source("backend")` mounts the inner directory without preserving the top-level `backend` module prefix, container execution can fail with `ModuleNotFoundError: No module named 'backend'`.
- **Fix:** Include the repository root or configure `sys.path.insert(0, "/root")` inside the container function.

---

## 3. Recommended Improvements & Enhancements

| Area | Feature / Enhancement | Description | Benefit |
|---|---|---|---|
| **Audio / Animation** | Client-Side Audio Amplitude Fallback | Use Web Audio API / Native audio peak metering to drive jaw blendshapes when viseme packets are not available. | Ensures companion lips move even if data channel visemes drop. |
| **Animation Physics** | Spring-Damped Viseme Smoothing | Replace linear lerp with critically damped spring interpolation in `useVisemeSync.ts`. | Eliminates mouth jitter and produces organic lip sync transitions. |
| **Auth / Security** | Supabase Session Auth Integration | Pass user Supabase JWT in `Authorization` header to `/api/v1/auth/token` instead of arbitrary client strings. | Enforces strict authentication and prevents unauthorized room minting. |
| **Telemetry** | LiveKit Connection Quality Badge | Listen to `RoomEvent.ConnectionQualityChanged` and display ping / RTT latency in the header. | Gives users transparent feedback during network fluctuations. |
| **Reliability** | Exponential Backoff Reconnection | Add automatic retry logic with exponential backoff on unexpected room disconnections. | Seamless recovery from temporary mobile Wi-Fi/cellular handoffs. |
| **Monetization** | Dynamic Multi-Currency Offerings | Display localized pricing and introductory trials directly from RevenueCat `PurchasesOffering`. | Increases global conversion and complies with international App Store pricing. |
| **Performance** | Three.js Asset Preloading | Pre-cache ReadyPlayerMe GLTF models using `useGLTF.preload(url)`. | Instant avatar appearance with zero loading flash when opening the app. |
| **Testing** | Automated Viseme Interpolation Tests | Add unit tests in Jest verifying that `updateFrame` correctly interpolates blendshape weights over simulated frame deltas. | Guarantees regression-free lip sync animation mechanics. |

---

## 4. Priority Action Checklist

- [ ] **P0:** Wire `updateFrame(delta)` into `Avatar.tsx`'s `useFrame` so visemes interpolate and drive procedural/GLTF blendshapes.
- [ ] **P0:** Implement viseme data generation on backend worker (`agent.py`) or client-side audio track volume follower.
- [ ] **P0:** Build `useLiveKitRoom` hook in mobile to connect live audio and data channels to `CompanionScreen`.
- [ ] **P1:** Only activate session countdown timer when room connection status is active (`connected`).
- [ ] **P1:** Wrap `GLTFAvatarMesh` in `<React.Suspense>` with procedural fallback to prevent Canvas crashes.
- [ ] **P1:** Remove duplicate `SafeAreaView` and status bar components between `App.tsx` and `CompanionScreen.tsx`.
- [ ] **P2:** Add cleanup for `Purchases.addCustomerInfoUpdateListener` in `useEntitlements.ts`.
- [ ] **P2:** Await `store_user_facts` in an async `on_shutdown` callback to guarantee persistent memory storage.
- [ ] **P2:** Wire live RevenueCat `PurchasesPackage` objects from `offerings` into `PaywallModal.tsx`.
